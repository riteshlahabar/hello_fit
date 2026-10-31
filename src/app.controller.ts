import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/auth.decorators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Liveness plus a real database round-trip. Monitoring hits this, so it must
   * stay cheap and must not require authentication.
   */
  @Public()
  @Get('health')
  health() {
    return this.appService.health();
  }
}
