import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RolesGuard } from '../guards/roles.guard';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { EnvConfig } from '../../config/env.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { UserModule } from '../../users/user.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvConfig, true>) => {
        const secret = configService.get('jwt.secret', { infer: true });
        const expiresIn = configService.get('jwt.expiresIn', { infer: true });
        return {
          secret,
          signOptions: { expiresIn: expiresIn as StringValue },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
