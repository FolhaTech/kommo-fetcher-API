import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../config/env.config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private _client: SupabaseClient;
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  onModuleInit() {
    const url = this.configService.get('db.baseUrl', { infer: true });
    const key = this.configService.get('db.accessToken', { infer: true });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this._client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  get client(): SupabaseClient {
    return this._client;
  }
}
