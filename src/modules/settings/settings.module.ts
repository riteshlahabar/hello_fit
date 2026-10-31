import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';

/// Global because pricing, slot search, matching and refunds all read policy
/// on nearly every request, and there is one cached copy per process.
@Global()
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
