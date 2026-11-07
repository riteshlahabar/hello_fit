import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors/error-codes';
import type {
  Prisma,
  WalletDirection,
  WalletSource,
} from '../../generated/prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Wallet balance plus an append-only ledger (spec 7.5).
 *
 * The balance and the ledger row are always written in the same transaction,
 * and the row carries the resulting `runningBalance` — so finance can replay
 * the ledger and prove the balance, which is the whole point of keeping one.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(customerId: string) {
    return this.prisma.walletAccount.upsert({
      where: { customerId },
      create: { customerId, balance: 0 },
      update: {},
      select: { id: true, customerId: true, balance: true },
    });
  }

  async balanceOf(customerId: string): Promise<number> {
    const account = await this.getOrCreate(customerId);
    return Number(account.balance);
  }

  async transactions(customerId: string, limit = 50) {
    const account = await this.getOrCreate(customerId);

    return this.prisma.walletTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        direction: true,
        amount: true,
        source: true,
        runningBalance: true,
        reason: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
      },
    });
  }

  /** Money in: refunds, goodwill, cashback, referral rewards. */
  async credit(
    params: {
      customerId: string;
      amount: number;
      source: WalletSource;
      reason?: string;
      referenceType?: string;
      referenceId?: string;
      createdById?: string;
    },
    tx?: Tx,
  ) {
    return this.move({ ...params, direction: 'CREDIT' }, tx);
  }

  /** Money out: paying for a booking, or an admin correction. */
  async debit(
    params: {
      customerId: string;
      amount: number;
      source: WalletSource;
      reason?: string;
      referenceType?: string;
      referenceId?: string;
      createdById?: string;
    },
    tx?: Tx,
  ) {
    return this.move({ ...params, direction: 'DEBIT' }, tx);
  }

  /**
   * The single write path. Accepts an outer transaction so a refund can
   * credit the wallet and update the refund row atomically — a credit that
   * survives a rolled-back refund would be free money.
   */
  private async move(
    params: {
      customerId: string;
      amount: number;
      direction: WalletDirection;
      source: WalletSource;
      reason?: string;
      referenceType?: string;
      referenceId?: string;
      createdById?: string;
    },
    outerTx?: Tx,
  ) {
    if (params.amount <= 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Wallet amount must be greater than zero',
      });
    }

    const run = async (tx: Tx) => {
      const account = await tx.walletAccount.upsert({
        where: { customerId: params.customerId },
        create: { customerId: params.customerId, balance: 0 },
        update: {},
        select: { id: true, balance: true },
      });

      const current = Number(account.balance);
      const delta =
        params.direction === 'CREDIT' ? params.amount : -params.amount;
      const next = round2(current + delta);

      if (next < 0) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Insufficient wallet balance',
          details: { balance: current, requested: params.amount },
        });
      }

      await tx.walletAccount.update({
        where: { id: account.id },
        data: { balance: next },
      });

      const entry = await tx.walletTransaction.create({
        data: {
          accountId: account.id,
          direction: params.direction,
          amount: params.amount,
          source: params.source,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          runningBalance: next,
          reason: params.reason,
          createdById: params.createdById,
        },
        select: {
          id: true,
          direction: true,
          amount: true,
          runningBalance: true,
          createdAt: true,
        },
      });

      this.logger.log(
        `Wallet ${params.direction} ${params.amount} for customer ${params.customerId} (${params.source}) → ${next}`,
      );

      return entry;
    };

    return outerTx ? run(outerTx) : this.prisma.$transaction(run);
  }
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
