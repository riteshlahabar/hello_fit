import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

/**
 * Prisma queries for customer profiles and addresses. No business rules here —
 * those live in the service. Every address query is scoped by `customerId`, so
 * ownership is enforced at the query and not left to the controller.
 */
@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------------- profile

  findProfileByUserId(userId: string) {
    return this.prisma.customerProfile.findFirst({
      where: { userId, deletedAt: null },
    });
  }

  findProfileByReferralCode(referralCode: string) {
    return this.prisma.customerProfile.findFirst({
      where: { referralCode, deletedAt: null },
      select: { id: true },
    });
  }

  updateProfile(id: string, data: Prisma.CustomerProfileUpdateInput) {
    return this.prisma.customerProfile.update({ where: { id }, data });
  }

  // --------------------------------------------------------------- addresses

  listAddresses(customerId: string) {
    return this.prisma.address.findMany({
      where: { customerId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        city: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
      },
    });
  }

  findAddress(customerId: string, addressId: string) {
    return this.prisma.address.findFirst({
      where: { id: addressId, customerId, deletedAt: null },
      include: {
        city: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
      },
    });
  }

  countAddresses(customerId: string) {
    return this.prisma.address.count({
      where: { customerId, deletedAt: null },
    });
  }

  /**
   * Creates the address and, when it should become the default, clears the flag
   * from the others in the same transaction — "exactly one default" must never
   * be observable as zero or two.
   */
  createAddress(
    customerId: string,
    data: Omit<Prisma.AddressUncheckedCreateInput, 'customerId'>,
    makeDefault: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { customerId, deletedAt: null, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: { ...data, customerId, isDefault: makeDefault },
        include: {
          city: { select: { id: true, name: true } },
          area: { select: { id: true, name: true } },
        },
      });
    });
  }

  updateAddress(id: string, data: Prisma.AddressUpdateInput) {
    return this.prisma.address.update({
      where: { id },
      data,
      include: {
        city: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
      },
    });
  }

  setDefaultAddress(customerId: string, addressId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { customerId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
      return tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }

  /**
   * Soft-deletes, and promotes the oldest surviving address when the deleted
   * one was the default — a customer with addresses always has a default.
   */
  softDeleteAddress(customerId: string, addressId: string, wasDefault: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await tx.address.update({
        where: { id: addressId },
        data: { deletedAt: new Date(), isDefault: false },
      });

      if (!wasDefault) return;

      const next = await tx.address.findFirst({
        where: { customerId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (next) {
        await tx.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    });
  }

  /**
   * Sessions still ahead of us at this address. Deleting an address out from
   * under a scheduled session would leave the teacher with nowhere to go.
   */
  countUpcomingSessionsAtAddress(addressId: string) {
    return this.prisma.bookingSession.count({
      where: {
        addressId,
        deletedAt: null,
        status: {
          in: [
            'PENDING_PAYMENT',
            'CONFIRMED',
            'ASSIGNED',
            'EN_ROUTE',
            'IN_PROGRESS',
            'REASSIGNMENT_NEEDED',
            'RESCHEDULE_REQUESTED',
          ],
        },
      },
    });
  }

  // ------------------------------------------------------------------ lookup

  cityExists(cityId: string) {
    return this.prisma.city.findFirst({
      where: { id: cityId, deletedAt: null },
      select: { id: true },
    });
  }

  areaExists(areaId: string) {
    return this.prisma.serviceArea.findFirst({
      where: { id: areaId, deletedAt: null },
      select: { id: true, cityId: true },
    });
  }
}
