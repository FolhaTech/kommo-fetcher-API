import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { KommoModule } from './kommo/kommo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    KommoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
