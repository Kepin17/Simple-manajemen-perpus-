import { Controller, Get, Header } from '@nestjs/common';
import pkg from '../package.json';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('version')
  @Header('Cache-Control', 'no-store')
  version() {
    return { name: pkg.name, version: pkg.version };
  }
}
