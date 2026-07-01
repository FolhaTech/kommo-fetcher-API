import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KommoAccount,
  KommoContact,
  KommoFile,
  KommoPaginatedResponse,
} from './kommo.types';

const REQUEST_DELAY_MS = 150;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

@Injectable()
export class KommoService {
  private readonly logger = new Logger(KommoService.name);
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private lastRequestTime = 0;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'KOMMO_BASE_URL',
      'https://genterrh.kommo.com',
    );

    this.accessToken =
      this.configService.get<string>('KOMMO_ACCESS_TOKEN') ?? '';

    if (!this.accessToken) {
      this.logger.error('No access token provided');
    }

    this.logger.log(`Kommo Service initialize with baseUrl: ${this.baseUrl}`);
  }

  // Private Helpers
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < REQUEST_DELAY_MS) {
      await this.sleep(REQUEST_DELAY_MS - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<number> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private resolveUrl(url: string): string {
    return url.startsWith('http') ? url : `${this.baseUrl}${url}`;
  }

  private buildJsonHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    url: string,
    options: RequestInit = {},
    attempt = 1,
  ): Promise<T | null> {
    await this.throttle();

    const fullUrl = this.resolveUrl(url);
    const headers = this.buildJsonHeaders();

    try {
      this.logger.debug(
        `[${attempt}/${MAX_RETRIES}] ${options.method ?? 'GET'} ${fullUrl}`,
      );

      const response = await globalThis.fetch(fullUrl, {
        ...options,
        headers: { ...headers, ...(options.headers ?? {}) },
      });

      if (response.status === 204) {
        return null;
      }

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        const wait = RETRY_BASE_MS * 2 ** (attempt - 1);
        this.logger.warn(
          `Kommo 5xx (${response.status}) em ${fullUrl}. Retry ${attempt}/${MAX_RETRIES - 1} em ${wait}ms.`,
        );
        await this.sleep(wait);
        return this.request<T>(url, options, attempt);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Kommo API erro ${response.status} ${response.statusText} em ${fullUrl}: ${errorBody}`,
        );
      }
      return (await response.json()) as T;
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      const isNetworkError =
        message.includes('fetch failed') ||
        message.includes('ECONNRESET') ||
        message.includes('ETIMEDOUT') ||
        message.includes('EAI_AGAIN') ||
        message.includes('ENOTFOUND');

      if (isNetworkError && attempt < MAX_RETRIES) {
        const wait = RETRY_BASE_MS * 2 ** (attempt - 1);
        this.logger.warn(
          `Falha de rede em ${fullUrl}: ${message}. Retry ${attempt}/${MAX_RETRIES - 1} em ${wait}ms.`,
        );
        await this.sleep(wait);
        return this.request<T>(url, options, attempt + 1);
      }

      this.logger.error(`Falha definitiva em ${fullUrl}: ${message}`);
      throw err;
    }
  }

  // Public Api
  async getDriveUrl(): Promise<string> {
    this.logger.log('Buscando drive_url da conta Kommo...');

    const account = await this.request<KommoAccount>(
      '/api/v4/account?with=drive_url',
    );

    if (!account?.drive_url) {
      throw new Error('[KommoService] resposta sem drive_url.');
    }
    this.logger.log(`drive_url obtida: ${account.drive_url}`);
    return account.drive_url;
  }

  async getContactsByTag(
    tag: string,
    page: number = 1,
  ): Promise<KommoPaginatedResponse<KommoContact>> {
    const url =
      `/api/v4/contacts?filter[tags][]=${encodeURIComponent(tag)}` +
      `&limit=250&page=${page}`;

    this.logger.log(`Buscando contatos tag="${tag}" — página ${page}`);

    const response =
      await this.request<KommoPaginatedResponse<KommoContact>>(url);

    if (!response) {
      throw new Error('[KommoService] Resposta vazia inesperada do Kommo');
    }

    return response;
  }

  async getContactFiles(contactId: number): Promise<KommoFile[]> {
    const url = `/api/v4/contacts/${contactId}/files`;
    this.logger.debug(`Buscando arquivos do contato ${contactId}`);

    const result = await this.request<KommoFile[]>(url);
    const files = result ?? [];
    this.logger.debug(`Contato ${contactId}: ${files.length} arquivos(s).`);
    return files;
  }

  async downloadFile(downloadUrl: string): Promise<Buffer> {
    await this.throttle();

    const fullUrl = this.resolveUrl(downloadUrl);
    this.logger.debug(`Baixando arquivo: ${fullUrl}`);

    try {
      const response = await globalThis.fetch(fullUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (!response.ok) {
        throw new Error(
          `Falha no download (${response.status} ${response.statusText}) em ${fullUrl}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      this.logger.debug(`Download OK: ${fullUrl} (${buffer.length} bytes)`);
      return buffer;
    } catch (err) {
      this.logger.error(`Erro ao baixar ${fullUrl}: ${(err as Error).message}`);
      throw err;
    }
  }

  async *getAllContactsWithFilesPaginated(
    tag: string,
  ): AsyncGenerator<KommoContact[]> {
    const firstPath =
      `/api/v4/contacts?filter[tags][]=${encodeURIComponent(tag)}` +
      `&limit=250&page=1`;

    let nextPath: string | null = firstPath;
    let pageNum = 0;

    while (nextPath) {
      pageNum += 1;
      this.logger.log(
        `Iterando tag="${tag}" — página ${pageNum} → ${nextPath}`,
      );

      const response: KommoPaginatedResponse<KommoContact> | null =
        await this.request<KommoPaginatedResponse<KommoContact>>(nextPath);

      if (!response) {
        this.logger.warn('Resposta nula ao paginar, encerrando.');
        return;
      }

      const contacts = response._embedded?.contacts ?? [];

      if (contacts.length === 0) {
        this.logger.warn(
          `Página ${pageNum} retornou 0 contatos${response._links?.next ? ' mas há _links.next' : ''}. Encerrando.`,
        );
        return;
      }
      yield contacts;

      const nextHref: string | null = response._links?.next?.href ?? null;
      nextPath = nextHref;
    }

    this.logger.log(
      `Paginação concluída para tag="${tag}" (${pageNum} página(s)).`,
    );
  }
}
