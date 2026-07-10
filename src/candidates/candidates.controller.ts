import { Controller, Get, Post } from '@nestjs/common';
import { CandidateService } from './candidates.services';
import { SyncResponse } from './candidates.type';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../config/env.config';
import { CandidateResult } from '../kommo/kommo.types';

@Controller('candidates')
export class CandidateController {
  private readonly pipelineId: number;
  constructor(
    private readonly candidateService: CandidateService,
    configService: ConfigService<EnvConfig, true>,
  ) {
    this.pipelineId = configService.get('kommo.pipelineId', { infer: true });
  }

  @Post('sync')
  async sync(): Promise<SyncResponse> {
    return this.candidateService.sync(this.pipelineId);
  }

  @Get('get-all')
  async findAll(): Promise<CandidateResult[]> {
    return this.candidateService.findAll();
  }
}
