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
}
