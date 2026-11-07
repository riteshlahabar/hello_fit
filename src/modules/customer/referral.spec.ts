import {
  REFERRAL_ALPHABET,
  REFERRAL_BODY_LENGTH,
  REFERRAL_PREFIX,
  generateReferralCode,
  isValidReferralCode,
  normaliseReferralCode,
} from './referral';

describe('generateReferralCode', () => {
  it('produces the HF prefix and a fixed-length body', () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(REFERRAL_PREFIX.length + REFERRAL_BODY_LENGTH);
    expect(code.startsWith(REFERRAL_PREFIX)).toBe(true);
  });

  it('only uses the unambiguous alphabet', () => {
    for (let i = 0; i < 500; i += 1) {
      const body = generateReferralCode().slice(REFERRAL_PREFIX.length);
      for (const char of body) {
        expect(REFERRAL_ALPHABET).toContain(char);
      }
    }
  });

  it('excludes the characters people misread', () => {
    // 0/O and 1/I/L are the pairs that get mistyped when a code is read aloud.
    for (const char of ['0', 'O', '1', 'I', 'L', 'U']) {
      expect(REFERRAL_ALPHABET).not.toContain(char);
    }
  });

  it('is driven entirely by the injected random source', () => {
    const always = () => 0;
    expect(generateReferralCode(always)).toBe(
      REFERRAL_PREFIX + REFERRAL_ALPHABET[0].repeat(REFERRAL_BODY_LENGTH),
    );
  });

  it('never indexes past the end of the alphabet', () => {
    // Math.random() is [0,1); 0.999… must still land on the last character.
    const almostOne = () => 0.999999999;
    const code = generateReferralCode(almostOne);
    const last = REFERRAL_ALPHABET[REFERRAL_ALPHABET.length - 1];
    expect(code).toBe(REFERRAL_PREFIX + last.repeat(REFERRAL_BODY_LENGTH));
  });

  it('does not collide across a large sample', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5_000; i += 1) seen.add(generateReferralCode());
    // 30^6 keys: 5,000 draws colliding would mean the generator is broken.
    expect(seen.size).toBe(5_000);
  });
});

describe('normaliseReferralCode', () => {
  it('upper-cases and trims what the user typed', () => {
    expect(normaliseReferralCode('  hf7k2mq4 ')).toBe('HF7K2MQ4');
  });
});

describe('isValidReferralCode', () => {
  it('accepts a generated code in any case', () => {
    const code = generateReferralCode();
    expect(isValidReferralCode(code)).toBe(true);
    expect(isValidReferralCode(code.toLowerCase())).toBe(true);
  });

  it('rejects a missing prefix', () => {
    expect(isValidReferralCode('XX7K2MQ4')).toBe(false);
  });

  it('rejects the wrong body length', () => {
    expect(isValidReferralCode('HF7K2M')).toBe(false);
    expect(isValidReferralCode('HF7K2MQ44')).toBe(false);
  });

  it('rejects characters outside the alphabet', () => {
    // O and 0 are exactly what a user will type by mistake.
    expect(isValidReferralCode('HF7K2MQO')).toBe(false);
    expect(isValidReferralCode('HF7K2MQ0')).toBe(false);
  });

  it('rejects empty and junk input', () => {
    expect(isValidReferralCode('')).toBe(false);
    expect(isValidReferralCode('   ')).toBe(false);
  });
});
