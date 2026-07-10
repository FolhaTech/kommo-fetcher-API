import { Module } from '@nestjs/common';
import { KommoModule } from '../kommo/kommo.module';
import { CandidateController } from './candidates.controller';
import { CandidateService } from './candidates.services';

@Module({
  imports: [KommoModule],
  controllers: [CandidateController],
  providers: [CandidateService],
})
export class CandidatesModule {}
