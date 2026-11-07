import { Global, Module } from '@nestjs/common';
import { WalletService } from './wallet.service';

/** Global: refunds, payments and admin adjustments all credit or debit. */
@Global()
@Module({
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
