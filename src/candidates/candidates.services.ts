import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../db/supabase.service';
import { KommoService } from '../kommo/kommo.service';
import { SyncResponse } from './candidates.type';
import { CandidateResult } from '../kommo/kommo.types';

@Injectable()
export class CandidateService {
  private readonly logger = new Logger(CandidateService.name);

  constructor(
    private readonly db: SupabaseService,
    private readonly KommoService: KommoService,
  ) {}
  async sync(pipelineId: number): Promise<SyncResponse> {
    const startedAt = Date.now();

    const { data: log, error: logError } = await this.db.client
      .from('sync_logs')
      .insert({
        entity: 'candidates',
        total: 0,
        status: 'running',
      })
      .select('id')
      .single();

    if (logError || !log) {
      throw new Error('Failed to create sync log');
    }

    try {
      let total = 0;
      for await (const batch of this.KommoService.getCandidatesWithCvsPaginated(
        pipelineId,
      )) {
        await this.persistBatch(batch);
        total += batch.length;
        this.logger.log(`Persisted ${batch.length} candidates`);
      }

      await this.db.client
        .from('sync_logs')
        .update({
          total,
          status: 'success',
          duration_ms: Date.now() - startedAt,
        })
        .eq('id', log.id);

      this.logger.log(`Sync completed in ${Date.now() - startedAt}ms`);
      return {
        syncId: log.id,
        total,
        status: 'success',
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Sync falhou: ${message}`);

      await this.db.client
        .from('sync_logs')
        .update({
          status: 'error',
          error: message,
          finished_at: new Date().toISOString(),
        })
        .eq('id', log.id);

      return {
        syncId: log.id,
        total: 0,
        status: 'error',
        error: message,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  private async persistBatch(batch: CandidateResult[]): Promise<void> {
    const leadIds = batch.map((candidate) => candidate.leadId);
    const now = new Date().toISOString();

    const candidateRows = batch.map((c) => ({
      lead_id: c.leadId,
      name: c.name,
      status_id: c.statusId,
      pipeline_id: c.pipelineId,
      contact_ids: c.contactIds,
      synced_at: now,
      updated_at: now,
    }));

    const { error: upsertError } = await this.db.client
      .from('candidates')
      .upsert(candidateRows, { onConflict: 'lead_id' });

    if (upsertError) {
      throw new Error(`Failed to upsert candidates: ${upsertError.message}`);
    }

    const { error: deleteError } = await this.db.client
      .from('candidate_files')
      .delete()
      .in('candidate_id', leadIds);

    if (deleteError) {
      throw new Error(
        `Failed to delete old candidate files: ${deleteError.message}`,
      );
    }

    const fileRows = batch.flatMap((c) =>
      c.files.map((f) => ({
        candidate_id: c.leadId,
        file_uuid: f.uuid,
        name: f.name,
        extension: f.extension,
        download_url: f.downloadUrl,
      })),
    );

    if (fileRows.length > 0) {
      const { error: insertFilesError } = await this.db.client
        .from('candidate_files')
        .insert(fileRows);

      if (insertFilesError) {
        throw new Error(
          `Failed to insert candidate files: ${insertFilesError.message}`,
        );
      }
    }
  }
}
