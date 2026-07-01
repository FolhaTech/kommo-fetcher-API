import { Module } from '@nestjs/common';
import { KommoService } from './kommo.service';
import { KommoController } from './kommo.controller';

@Module({
  providers: [KommoService],
  exports: [KommoService],
  controllers: [KommoController],
})
export class KommoModule {}
