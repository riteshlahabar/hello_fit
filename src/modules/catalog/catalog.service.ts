import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors/error-codes';

/**
 * Read side of the service catalog. Admin CRUD lands in a separate
 * admin-facing service so the customer-facing queries stay narrow and
 * cacheable.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Category grid on the customer Home tab (spec 6.2). */
  async listCategories() {
    return this.prisma.serviceCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        imageUrl: true,
        description: true,
        _count: { select: { services: { where: { isActive: true } } } },
      },
    });
  }

  async listServices(params: { categoryId?: string; search?: string }) {
    return this.prisma.service.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        ...(params.search
          ? { name: { contains: params.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        durationMin: true,
        basePrice: true,
        level: true,
        maxParticipants: true,
        isHomeService: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /** Service detail screen — includes everything shown before booking. */
  async getService(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, isActive: true, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        packages: {
          where: { isActive: true, deletedAt: null },
          select: {
            id: true,
            name: true,
            sessionCount: true,
            validityDays: true,
            price: true,
            allowedWeekdays: true,
            fixedInstructorAllowed: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Service not found',
      });
    }

    return service;
  }

  /** Add-ons offered for a service; an empty list on the add-on means "all". */
  async listAddonsForService(serviceId: string) {
    const addons = await this.prisma.addon.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        applicableServiceIds: true,
      },
    });

    return addons.filter(
      (addon) =>
        addon.applicableServiceIds.length === 0 ||
        addon.applicableServiceIds.includes(serviceId),
    );
  }
}
