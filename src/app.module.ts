import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KommoModule } from './kommo/kommo.module';
import { UserModule } from './users/user.module';
import { AuthModule } from './auth/auth/auth.module';
import { loadEnvConfig } from './config/env.config';
import { SupabaseModule } from './db/supabase.module';
import { CandidatesModule } from './candidates/candidates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadEnvConfig],
    }),
    SupabaseModule,
    KommoModule,
    UserModule,
    AuthModule,
    CandidatesModule,
  ],
})
export class AppModule {}
