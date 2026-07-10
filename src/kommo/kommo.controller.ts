import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { KommoService } from './kommo.service';
import type { Response } from 'express';
import { KommoFile, KommoLeadWithFiles } from './kommo.types';

@Controller('kommo')
export class KommoController {
  constructor(private readonly kommoService: KommoService) {}

  @Get('drive-url')
  async getDriveUrl(): Promise<{ drive_url: string }> {
    const driveUrl = await this.kommoService.getDriveUrl();
    return { drive_url: driveUrl };
  }

  @Get('contacts')
  async getContacts(@Query('tag') tag?: string, @Query('page') page?: string) {
    if (!tag) {
      throw new BadRequestException('tag is required');
    }

    const numPage = page ? Number.parseInt(page, 10) : 1;
    if (Number.isNaN(numPage) || numPage < 1) {
      throw new BadRequestException('page must be a positive integer');
    }

    return this.kommoService.getContactsByTag(tag, numPage);
  }

  @Get('contacts/stream')
  async getContactsStream(@Query('tag') tag?: string) {
    if (!tag) {
      throw new BadRequestException('tag is required');
    }

    const batches: unknown[] = [];
    for await (const batch of this.kommoService.getAllContactsWithFilesPaginated(
      tag,
    )) {
      batches.push(batch);
    }
    return batches;
  }

  @Get('contacts/:id/files')
  async getContactFiles(@Param('id') id: number) {
    const files = await this.kommoService.getContactFiles(id);
    return { contact_id: id, files };
  }

  @Get('files/download')
  async downloadFile(
    @Query('url') url: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!url) {
      throw new BadRequestException('url is required');
    }

    const buffer = await this.kommoService.downloadFile(url);

    res.setHeader(
      'Content-Type',
      res.getHeader('Content-Type') ?? 'application/octet-stream',
    );
    res.setHeader('Content-Length', buffer.length.toString());

    return new StreamableFile(buffer);
  }

  @Get('leads')
  async getLeads(
    @Query('pipeline_id') pipelineId?: string,
    @Query('page') page?: string,
  ) {
    if (!pipelineId) {
      throw new BadRequestException('pipeline_id is required');
    }

    const numPage = page ? Number.parseInt(page, 10) : 1;
    return this.kommoService.getLeadsByPipeline(Number(pipelineId), numPage);
  }

  @Get('leads/with-drive-files')
  async getLeadsWithDriveFiles(@Query('pipeline_id') pipelineId?: string) {
    if (!pipelineId) {
      throw new BadRequestException('pipeline_id is required');
    }

    const results: KommoLeadWithFiles[] = [];
    for await (const batch of this.kommoService.getLeadsWithDriveFilesPaginated(
      Number(pipelineId),
    )) {
      results.push(...batch);
    }
    return { count: results.length, leads: results };
  }

  @Get('drive/files')
  async getDriveFiles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const numPage = page ? Number.parseInt(page, 10) : 1;
    const numLimit = limit ? Number.parseInt(limit, 10) : 250;
    return this.kommoService.getDriveFiles(numPage, numLimit);
  }

  @Get('drive/files/filter')
  async getDriveFilesByExtension(@Query('ext') ext?: string | string[]) {
    if (!ext) {
      throw new BadRequestException('extension is required');
    }

    const extensions = Array.isArray(ext) ? ext : [ext];

    const batches: KommoFile[][] = [];
    for await (const batch of this.kommoService.getDriveFilesExtensionPaginated(
      extensions,
    )) {
      batches.push(batch);
    }
    return { extensions, batches };
  }

  // @Post('candidates/sync')
  // async syncCandidates(): Promise<{
  //   total: number;
  //   candidates: CandidateResult[];
  // }> {
  //   const candidates: CandidateResult[] = [];
  //   for await (const batch of this.kommoService.getCandidatesWithCvsPaginated(
  //     13538803,
  //   )) {
  //     candidates.push(...batch);
  //   }
  //   return { total: candidates.length, candidates };
  // }

  @Get('files/:uuid/download')
  async downloadByUuid(
    @Param('uuid') uuid: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!uuid) {
      throw new BadRequestException('uuid is required');
    }

    const { buffer, name, extension } =
      await this.kommoService.downloadFileByUuid(uuid);

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };

    const ext = (extension ?? 'pdf').toLowerCase();
    const contentType = mimeTypes[ext] ?? 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${name}.${ext}"`,
    );
    res.setHeader('Content-Length', buffer.length.toString());

    return new StreamableFile(buffer);
  }
}
