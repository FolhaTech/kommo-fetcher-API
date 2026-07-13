/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CandidateResult,
  KommoAccount,
  KommoContact,
  KommoDriveFileMeta,
  KommoDriveFilesResponse,
  KommoFile,
  KommoLead,
  KommoLeadFile,
  KommoLeadWithFiles,
  KommoPaginatedLeads,
  KommoPaginatedResponse,
} from './kommo.types';

const REQUEST_DELAY_MS = 150;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

@Injectable()
export class KommoService {
  private readonly logger = new Logger(KommoService.name);
  private readonly baseUrl: string;
  private readonly driveUrl: string;
  private readonly accessToken: string;
  private lastRequestTime = 0;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'KOMMO_BASE_URL',
      'https://genterrh.kommo.com',
    );

    this.driveUrl = this.configService.get<string>(
      'KOMMO_DRIVE_URL',
      'https://drive-c.kommo.com',
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
    if (url.startsWith('http')) return url;
    if (url.startsWith('/v1.0')) return `${this.driveUrl}${url}`;
    return `${this.baseUrl}${url}`;
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

    this.logger.debug(`Headers: ${JSON.stringify(headers)}`);

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

      if (response.status === 401) {
        this.logger.warn('Api Token not Found');
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

  async getLeadsByPipeline(
    pipelineId: number,
    page: number,
    withParams: string[] = ['contacts'],
  ): Promise<KommoPaginatedLeads> {
    const params = new URLSearchParams({
      'filter[pipeline_id]': String(pipelineId),
      limit: '250',
      page: String(page),
    });

    if (withParams.length > 0) {
      params.append('with', withParams.join(','));
    }
    const url = `/api/v4/leads?${params.toString()}`;
    this.logger.log(`Buscando leads pipeline=${pipelineId} — página ${page}`);

    const response = await this.request<KommoPaginatedLeads>(url);
    if (!response) {
      throw new Error('[KommoService] Resposta vazia inesperada do Kommo');
    }

    return response;
  }

  async *getAllLeadsByPipelinePaginated(
    pipelineId: number,
    withParams: string[] = ['contacts'],
  ): AsyncGenerator<KommoLead[]> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getLeadsByPipeline(
        pipelineId,
        page,
        withParams,
      );
      const leads = response._embedded?.leads ?? [];

      if (leads.length === 0) {
        break;
      }

      this.logger.log(
        `Pipeline ${pipelineId} — página ${page}: ${leads.length} leads`,
      );

      yield leads;

      const nextHref = response._links?.next?.href;
      hasMore = Boolean(nextHref);
      page += 1;
    }
    this.logger.log(`Paginação de leads concluída (pipeline ${pipelineId})`);
  }

  async getDriveFiles(
    page: number = 1,
    limit: number = 250,
  ): Promise<KommoDriveFilesResponse> {
    const url = `/v1.0/files?page=${page}&limit=${limit}`;
    this.logger.log(`Buscando arquivos do drive — página ${page}`);

    const response = await this.request<KommoDriveFilesResponse>(url);
    if (!response) {
      throw new Error('[KommoService] Resposta vazia inesperada do Kommo');
    }
    return response;
  }

  async *getAllDriveFilesPaginated(
    limit: number = 250,
  ): AsyncGenerator<KommoFile[]> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getDriveFiles(page, limit);
      const files = response._embedded?.files ?? [];

      if (files.length === 0) {
        break;
      }

      this.logger.log(`Drive — página ${page}: ${files.length} arquivo(s)`);
      yield files;

      const nextHref = response._links?.next?.href;
      hasMore = Boolean(nextHref);
      page += 1;
    }

    this.logger.log(`Paginação do drive concluída (${page - 1} página(s))`);
  }

  async *getDriveFilesExtensionPaginated(
    extensions: string[],
    limit: number = 250,
  ): AsyncGenerator<KommoFile[]> {
    const normalized = extensions.map((ext) =>
      ext.toLowerCase().replace('.', ''),
    );

    for await (const files of this.getAllDriveFilesPaginated(limit)) {
      const filtered = files.filter((file) => {
        const ext = file.metadata?.extension?.toLowerCase();
        return ext ? normalized.includes(ext) : false;
      });

      if (filtered.length > 0) {
        this.logger.log(
          `Drive — ${filtered.length}/${files.length} com extensão [${extensions.join(', ')}]`,
        );
        yield filtered;
      }
    }
  }

  async *getLeadsWithDriveFilesPaginated(
    pipelineId: number,
  ): AsyncGenerator<KommoLeadWithFiles[]> {
    const leadsMap = new Map<number, KommoLead>();
    for await (const leads of this.getAllLeadsByPipelinePaginated(pipelineId)) {
      for (const lead of leads) {
        if (lead.id) leadsMap.set(lead.id, lead);
      }
    }
    this.logger.log(
      `Mapeados ${leadsMap.size} leads do pipeline ${pipelineId}`,
    );

    const cvExtensions = ['pdf', 'doc', 'docx'];
    const driveFiles: KommoFile[] = [];
    for await (const files of this.getAllDriveFilesPaginated()) {
      for (const file of files) {
        const ext = file.metadata?.extension?.toLowerCase();
        if (ext && cvExtensions.includes(ext)) {
          driveFiles.push(file);
        }
      }
    }
    this.logger.log(`Drive: ${driveFiles.length} CV(s) para verificar`);

    const leadFiles = new Map<number, KommoFile[]>();

    for (const file of driveFiles) {
      const fileUuid = file.uuid ?? file.file_uuid;
      if (!fileUuid) continue;

      try {
        const response = await this.request<{
          file_uuid: string;
          entities: { entity_type: string; entity_id: number }[];
        }>(`/api/v4/files/${fileUuid}/links`);

        if (!response?.entities) continue;

        for (const entity of response.entities) {
          if (
            entity.entity_type === 'leads' &&
            leadsMap.has(entity.entity_id)
          ) {
            const existing = leadFiles.get(entity.entity_id) ?? [];
            leadFiles.set(entity.entity_id, [...existing, file]);
            this.logger.log(
              `[LINK] "${file.name}" → Lead ${entity.entity_id} (${leadsMap.get(entity.entity_id)?.name})`,
            );
            break;
          }
        }
      } catch (err) {
        this.logger.warn(
          `Erro /files/${fileUuid}/links: ${(err as Error).message}`,
        );
      }
    }

    const results: KommoLeadWithFiles[] = [];
    for (const [leadId, files] of leadFiles.entries()) {
      const lead = leadsMap.get(leadId);
      if (lead) results.push({ lead, files });
    }

    this.logger.log(
      `${results.length}/${leadsMap.size} lead(s) com CV vinculado`,
    );

    if (results.length > 0) {
      yield results;
    }
  }

  async getLeadFiles(leadId: number): Promise<KommoLeadFile[]> {
    const url = `/api/v4/leads/${leadId}/files`;
    this.logger.debug(`Buscando arquivos do lead ${leadId}`);

    const result = await this.request<{
      _embedded?: { files: KommoLeadFile[] };
    }>(url);
    const files = result?._embedded?.files ?? [];

    this.logger.debug(`Lead ${leadId}: ${files.length} arquivo(s).`);
    return files;
  }

  async getDriveFileMeta(fileUuid: string): Promise<KommoDriveFileMeta | null> {
    const url = `/v1.0/files/${fileUuid}`;
    this.logger.debug(`Buscando meta do arquivo ${fileUuid}`);
    return this.request<KommoDriveFileMeta>(url);
  }

  async *getCandidatesWithCvsPaginated(
    pipelineId: number,
  ): AsyncGenerator<CandidateResult[]> {
    const cvExtensions = ['pdf', 'doc', 'docx'];
    const totalFound: CandidateResult[] = [];

    for await (const leads of this.getAllLeadsByPipelinePaginated(pipelineId, [
      'contacts',
    ])) {
      const batch: CandidateResult[] = [];

      for (const lead of leads) {
        if (!lead.id) continue;

        const leadFiles = await this.getLeadFiles(lead.id);
        if (leadFiles.length === 0) continue;

        const cvCandidates: Array<{
          uuid: string;
          name: string;
          extension: string | null;
          downloadUrl: string;
        }> = [];

        for (const lf of leadFiles) {
          try {
            const meta = await this.getDriveFileMeta(lf.file_uuid);
            if (!meta) continue;

            const ext = meta.metadata?.extension?.toLowerCase() ?? null;

            if (!ext || !cvExtensions.includes(ext)) continue;

            cvCandidates.push({
              uuid: meta.uuid,
              name: meta.name,
              extension: ext,
              downloadUrl: meta._links?.download?.href ?? '',
            });
          } catch (err) {
            this.logger.warn(
              `Arquivo ${lf.file_uuid} indisponível: ${(err as Error).message}`,
            );
          }
        }

        if (cvCandidates.length === 0) continue;

        const rawContacts = lead._embedded?.contacts;
        let contactIds: number[] = [];
        if (rawContacts) {
          const contactsList = Array.isArray(rawContacts)
            ? rawContacts
            : [rawContacts];
          contactIds = contactsList
            .map((c) => c.id)
            .filter((id): id is number => id != null);
        }

        const candidate: CandidateResult = {
          leadId: lead.id,
          name: lead.name ?? '',
          statusId: lead.status_id ?? null,
          pipelineId: lead.pipeline_id ?? null,
          contactIds,
          files: cvCandidates,
        };

        batch.push(candidate);
        totalFound.push(candidate);

        this.logger.log(
          `Candidato "${lead.name}" (lead ${lead.id}): ${cvCandidates.length} CV(s)`,
        );
      }

      if (batch.length > 0) {
        yield batch;
      }
    }

    this.logger.log(
      `Total de candidatos com CV encontrados: ${totalFound.length}`,
    );
  }

  async downloadFileByUuid(fileUuid: string): Promise<{
    buffer: Buffer;
    name: string;
    extension: string | null;
    size: number | null;
  }> {
    const meta = await this.getDriveFileMeta(fileUuid);
    if (!meta) {
      throw new Error(`Arquivo ${fileUuid} não encontrado no drive.`);
    }

    const downloadUrl = meta._links?.download?.href;
    if (!downloadUrl) {
      throw new Error(`Arquivo ${meta.name} (${fileUuid}) sem Url de download`);
    }

    const buffer = await this.downloadFile(downloadUrl);
    return {
      buffer,
      name: meta.name ?? fileUuid,
      extension: meta.metadata?.extension ?? null,
      size: buffer.length,
    };
  }
}
