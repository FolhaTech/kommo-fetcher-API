import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { KommoService } from './kommo.service';

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

    const numPage = page ? Number.parseInt(page, 10) : undefined;
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
}
