# kommo-fetcher

Serviço NestJS 11 que consome a API do CRM Kommo para buscar contatos, leads,
arquivos do drive, sincronizar candidatos com currículos e fazer download.
A persistência no Supabase está planejada mas ainda não implementada.

## Pré-requisitos

- Node.js 22
- npm

## Configuração

```bash
npm install
cp .env.example .env
# Preencha KOMMO_ACCESS_TOKEN no .env com um token válido do Kommo
```

### Variáveis de ambiente

| Variável            | Obrigatória | Padrão                      |
| ------------------- | ----------- | --------------------------- |
| `KOMMO_ACCESS_TOKEN` | Sim         | —                           |
| `DB_CONNECTION`      | Sim         | —                           |
| `DB_KEY`             | Sim         | —                           |
| `KOMMO_BASE_URL`     | Não         | `https://api-g.kommo.com`   |
| `KOMMO_DRIVE_URL`    | Não         | `https://drive-c.kommo.com`  |
| `PORT`               | Não         | `3000`                      |
| `NODE_ENV`           | Não         | `development`               |

> **Nota sobre `KOMMO_BASE_URL`:** o domínio da API vem embutido na claim
> `api_domain` do token JWT emitido pela Kommo. Use o valor retornado no
> token (ex.: `https://api-g.kommo.com`) e não o domínio da interface web
> da conta (`https://genterrh.kommo.com`), que pode ser bloqueado por
> rotas de rede dependentes do ambiente.

## Comandos

```bash
npm run start:dev   # desenvolvimento com hot reload
npm run start:debug # com debugger ativo
npm run build       # compila para dist/
npm run start:prod  # produção (node dist/main)

npm test            # testes unitários
npm run test:watch  # testes em watch mode
npm run test:cov    # cobertura de testes
npm run test:e2e    # testes end-to-end

npm run lint        # ESLint
npm run lint:fix    # ESLint com auto-fix
npm run format      # Prettier --write
npm run build       # compilação de produção
```

## Endpoints da API

Todos os endpoints usam o prefixo `/kommo`.

| Rota                              | Método | Descrição                                                              |
| --------------------------------- | ------ | --------------------------------------------------------------------- |
| `/kommo/drive-url`                | GET    | URL do drive da conta Kommo                                            |
| `/kommo/contacts`                 | GET    | Contatos por tag (`?tag=` requerido, `&page=`)                          |
| `/kommo/contacts/stream`          | GET    | Todos os contatos paginados (`?tag=` requerido)                        |
| `/kommo/contacts/:id/files`       | GET    | Arquivos de um contato                                                 |
| `/kommo/leads`                    | GET    | Leads por pipeline (`?pipeline_id=` requerido, `&page=`)              |
| `/kommo/leads/with-drive-files`   | GET    | Leads com arquivos do drive associados (`?pipeline_id=` requerido)      |
| `/kommo/drive/files`             | GET    | Arquivos do drive (`?page=&limit=`)                                    |
| `/kommo/drive/files/filter`      | GET    | Filtrar por extensão (`?ext=pdf&ext=docx`)                              |
| `/kommo/files/download`          | GET    | Download de arquivo por URL completa (`?url=`)                          |
| `/kommo/files/:uuid/download`     | GET    | Download de arquivo por UUID (Content-Type automático por extensão)     |
| `/kommo/candidates/sync`          | POST   | Sincroniza candidatos do pipeline `13538803` e retorna os que têm CV   |

### `POST /kommo/candidates/sync`

Dispara a sincronização de candidatos do pipeline hardcoded `13538803`,
iterando todos os leads, consultando os arquivos anexados a cada lead via
`GET /api/v4/leads/{id}/files`, filtrando por extensões de currículo
(`pdf`, `doc`, `docx`) e enriquecendo cada arquivo com a metadata do drive
(`GET /v1.0/files/{uuid}`). O retorno tem o shape:

```json
{
  "total": 42,
  "candidates": [
    {
      "leadId": 23634628,
      "name": "Alex da Silva",
      "statusId": 51234567,
      "pipelineId": 13538803,
      "contactIds": [114334847],
      "files": [
        {
          "uuid": "f8514c13-00e4-4c08-abe1-c0f8e494edf2",
          "name": "ALEX DA SILVA - KIT",
          "extension": "pdf",
          "downloadUrl": "https://drive-c.kommo.com/download/..."
        }
      ]
    }
  ]
}
```

### `GET /kommo/files/:uuid/download`

Baixa um arquivo do drive pelo UUID (path param). O `Content-Type` é
definido automaticamente a partir da extensão (`application/pdf` para PDF,
`application/msword` para DOC, etc.). O header `Content-Disposition` força
o download com o nome original do arquivo.

## Estrutura

```
src/
  main.ts                 # entrypoint da aplicação
  app.module.ts           # módulo raiz (ConfigModule + KommoModule)
  config/env.config.ts    # tipagem e validação de variáveis de ambiente
  kommo/
    kommo.service.ts      # cliente HTTP com throttle/retry + paginação
    kommo.controller.ts   # endpoints REST (/kommo/*)
    kommo.types.ts        # DTOs (KommoContact, KommoLead, KommoFile,
                          #   KommoLeadFile, KommoDriveFileMeta,
                          #   CandidateResult, ...)
  db/                     # (planejado) persistência no Supabase
  candidates/             # (planejado)
  sync/                   # (planejado) orquestração de sincronização
```

### Métodos do `KommoService`

| Método                          | Descrição                                                          |
| ------------------------------- | ----------------------------------------------------------------- |
| `getDriveUrl()`                 | URL do drive da conta                                              |
| `getContactsByTag(tag, page)`   | Contatos por tag (paginação simples)                              |
| `getContactFiles(contactId)`    | Arquivos de um contato via `GET /api/v4/contacts/{id}/files`      |
| `downloadFile(downloadUrl)`      | Download via URL completa (bytes crus em `Buffer`)                |
| `getLeadsByPipeline(...)`       | Leads por pipeline (1 página)                                      |
| `getLeadFiles(leadId)`           | Arquivos anexados a um lead via `GET /api/v4/leads/{id}/files`     |
| `getDriveFileMeta(fileUuid)`     | Metadata de um arquivo do drive via `GET /v1.0/files/{uuid}`       |
| `getDriveFiles(page, limit)`     | Lista paginada de arquivos do drive                                |
| `getCandidatesWithCvsPaginated(pipelineId)` | Async generator: leads com currículos filtrados por extensão |
| `downloadFileByUuid(fileUuid)`  | Busca metadata + baixa o arquivo, retornando `Buffer`, nome e ext  |

Todas as requisições usam o cliente HTTP interno (`request<T>()`) com
throttle de 150 ms entre chamadas e retry exponencial em erros 5xx e
falhas de rede (até 3 tentativas).

## CI

Push para `main`/`develop` e PRs disparam lint + format (ubuntu e windows)
seguidos de build + testes unitários (ubuntu). Testes e2e não rodam na CI.

Antes de commitar, verifique:

```bash
npm run lint && npm run format && npm run build && npm test
```

## Stack

- [NestJS 11](https://nestjs.com) + Express
- ESLint 10 (flat config) + Prettier 3
- Jest (testes unitários) + Supertest (e2e)
- TypeScript 5 (`nodenext`, target ES2023)

## Licença

UNLICENSED — uso interno.