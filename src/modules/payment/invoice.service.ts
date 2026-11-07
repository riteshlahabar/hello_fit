import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import type { Prisma } from '../../generated/prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Invoice generation with the GST breakup (spec 7.5).
 *
 * Intra-state supply splits the tax into CGST and SGST at half each;
 * inter-state is a single IGST line. The institute operates per city, and a
 * home visit is consumed where it is delivered, so intra-state is the normal
 * case — the inter-state branch exists because the data model must not need
 * changing the first time it happens.
 */
@Injectable()
export class InvoiceService {
  constructor(private readonly settings: SettingsService) {}

  /**
   * Numbered sequentially per financial year (April to March in India), which
   * is what GST filing expects: HF/2026-27/000123.
   */
  async createForBooking(
    tx: Tx,
    booking: {
      id: string;
      taxableValue: number;
      tax: number;
      total: number;
    },
    options?: { interState?: boolean },
  ) {
    const taxPercent = this.settings.get('payment').taxPercent;
    const financialYear = currentFinancialYear();

    const issuedThisYear = await tx.invoice.count({
      where: { invoiceNo: { startsWith: `HF/${financialYear}/` } },
    });

    const invoiceNo = `HF/${financialYear}/${String(issuedThisYear + 1).padStart(6, '0')}`;

    const taxBreakup = options?.interState
      ? [{ type: 'IGST', percent: taxPercent, amount: booking.tax }]
      : [
          {
            type: 'CGST',
            percent: taxPercent / 2,
            amount: round2(booking.tax / 2),
          },
          {
            type: 'SGST',
            percent: taxPercent / 2,
            // Second half takes the rounding remainder so the two lines sum
            // back to the tax charged.
            amount: round2(booking.tax - round2(booking.tax / 2)),
          },
        ];

    return tx.invoice.create({
      data: {
        bookingId: booking.id,
        invoiceNo,
        taxableValue: booking.taxableValue,
        // No tax column: it is always total minus taxableValue, and the
        // breakup below carries the split for filing.
        taxBreakup,
        total: booking.total,
      },
      select: {
        id: true,
        invoiceNo: true,
        taxableValue: true,
        total: true,
        taxBreakup: true,
        issuedAt: true,
      },
    });
  }
}

/** April-to-March year, e.g. "2026-27". */
function currentFinancialYear(now = new Date()): string {
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
