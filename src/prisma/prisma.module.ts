import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so feature modules can inject PrismaService without importing this
 * module each time. It is the one exception to explicit imports: there is a
 * single client per process by design.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
