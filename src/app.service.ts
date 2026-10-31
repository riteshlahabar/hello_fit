import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  database: 'up' | 'down';
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async health(): Promise<HealthReport> {
    let database: HealthReport['database'] = 'up';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      database = 'down';
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      database,
    };
  }
}
