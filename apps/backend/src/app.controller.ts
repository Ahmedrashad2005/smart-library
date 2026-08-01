import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  health(): { status: 'ok'; service: 'backend' } {
    return { status: 'ok', service: 'backend' };
  }
}
