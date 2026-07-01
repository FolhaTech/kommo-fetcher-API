import { Module } from '@nestjs/common';
import { KommoService } from './kommo.service';

@Module({
  providers: [KommoService],
  exports: [KommoService],
})
export class KommoModule {}
