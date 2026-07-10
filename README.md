# kommo-fetcher

Serviço NestJS 11 que consome a API do CRM Kommo para buscar contatos, leads,
arquivos do drive, sincronizar candidatos com currículos e fazer download.
Persistência no Supabase via `@supabase/supabase-js` (REST/PostgREST) com
autenticação JWT própria.

## Pré-requisitos

- Node.js 22
- npm
- Projeto no [Supabase](https://supabase.com) com tabelas criadas

## Configuração

```bash
npm install
cp .env.example .env
# Preencha as variáveis no .env (veja tabela abaixo)
```

### Variáveis de ambiente

| Variável             | Obrigatória | Padrão                       |
| -------------------- | ----------- | ---------------------------- |
| `KOMMO_ACCESS_TOKEN` | Sim         | —                            |
| `DB_CONNECTION`      | Sim         | —                            |
| `DB_KEY`             | Sim         | —                            |
| `JWT_SECRET`         | Sim         | —                            |
| `KOMMO_BASE_URL`     | Não         | `https://genterrh.kommo.com` |
| `KOMMO_DRIVE_URL`    | Não         | `https://drive-c.kommo.com`  |
| `KOMMO_PIPELINE_ID`  | Não         | `13538803`                   |
| `PORT`               | Não         | `3000`                       |
| `NODE_ENV`           | Não         | `development`                |
| `JWT_EXPIRES_IN`     | Não         | `1h`                         |

> **`DB_CONNECTION`:** URL REST do Supabase (`https://<ref>.supabase.co`).
>
> **`DB_KEY`:** **service_role** key do Supabase (Dashboard → Settings → API →
> service_role). Começa com `eyJ...`. Não use a anon key — ela respeita RLS.
>
> **`KOMMO_BASE_URL`:** o domínio da API vem embutido na claim `api_domain`
> do token JWT emitido pela Kommo. Use o valor retornado no token
> (ex.: `https://api-g.kommo.com`) e não o domínio da interface web da
> conta (`https://genterrh.kommo.com`), que pode ser bloqueado por rotas
> de rede dependentes do ambiente.

### Banco de dados (Supabase)

As migrations SQL estão versionadas em `src/db/migrations/`. Rode-as no
**SQL Editor** do Supabase Dashboard na ordem:

1. `src/db/migrations/001_create_users.sql`
2. `src/db/migrations/002_create_candidates.sql`

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
```

## Endpoints da API

### Kommo (`/kommo`)

| Rota                            | Método | Descrição                                                           |
| ------------------------------- | ------ | ------------------------------------------------------------------- |
| `/kommo/drive-url`              | GET    | URL do drive da conta Kommo                                         |
| `/kommo/contacts`               | GET    | Contatos por tag (`?tag=` requerido, `&page=`)                      |
| `/kommo/contacts/stream`        | GET    | Todos os contatos paginados (`?tag=` requerido)                     |
| `/kommo/contacts/:id/files`     | GET    | Arquivos de um contato                                              |
| `/kommo/leads`                  | GET    | Leads por pipeline (`?pipeline_id=` requerido, `&page=`)            |
| `/kommo/leads/with-drive-files` | GET    | Leads com arquivos do drive associados (`?pipeline_id=` requerido)  |
| `/kommo/drive/files`            | GET    | Arquivos do drive (`?page=&limit=`)                                 |
| `/kommo/drive/files/filter`     | GET    | Filtrar por extensão (`?ext=pdf&ext=docx`)                          |
| `/kommo/files/download`         | GET    | Download de arquivo por URL completa (`?url=`)                      |
| `/kommo/files/:uuid/download`   | GET    | Download de arquivo por UUID (Content-Type automático por extensão) |

### Autenticação (`/auth`)

| Rota             | Método | Descrição               | Auth |
| ---------------- | ------ | ----------------------- | ---- |
| `/auth/register` | POST   | Registrar novo usuário  | ❌   |
| `/auth/login`    | POST   | Login (retorna JWT)     | ❌   |
| `/auth/me`       | GET    | Dados do usuário logado | ✅   |

#### `POST /auth/register`

```json
// Request
{
  "email": "usuario@email.com",
  "name": "Nome",
  "password": "123456"
}

// Response 201
{
  "accessToken": "eyJhbGciOi...",
  "user": {
    "id": "uuid",
    "email": "usuario@email.com",
    "name": "Nome",
    "roles": ["user"]
  }
}
```

#### `POST /auth/login`

```json
// Request
{
  "email": "usuario@email.com",
  "password": "123456"
}

// Response 200
{
  "accessToken": "eyJhbGciOi...",
  "user": {
    "id": "uuid",
    "email": "usuario@email.com",
    "name": "Nome",
    "roles": ["user"]
  }
}
```

### Candidates (`/candidates`)

| Rota               | Método | Descrição                                             |
| ------------------ | ------ | ----------------------------------------------------- |
| `/candidates/sync` | POST   | Sincroniza candidatos do Kommo e persiste no Supabase |

#### `POST /candidates/sync`

Dispara a sincronização de candidatos do pipeline configurado em
`KOMMO_PIPELINE_ID` (default `13538803`). Itera todos os leads, consulta
arquivos anexados, filtra por extensões de currículo (`pdf`, `doc`, `docx`),
persiste no Supabase (`candidates` + `candidate_files`) e registra o log
em `sync_logs`.

```json
// Response 200
{
  "syncId": 1,
  "total": 136,
  "status": "success",
  "durationMs": 28450
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
  main.ts                   # entrypoint da aplicação
  app.module.ts             # módulo raiz
  config/
    env.config.ts           # tipagem e validação de variáveis de ambiente
  db/
    supabase.service.ts     # wrapper do cliente @supabase/supabase-js
    supabase.module.ts      # módulo global do Supabase
    migrations/             # SQL versionado (rodar no Supabase Dashboard)
      001_create_users.sql
      002_create_candidates.sql
  auth/                     # autenticação JWT
    auth/
      auth.module.ts
      auth.service.ts
      auth.controller.ts    # POST /auth/register, POST /auth/login, GET /auth/me
    guards/
      jwt-auth.guard.ts     # guard global (exceto rotas @Public)
      roles.guard.ts        # verificação de roles
    strategies/
      jwt.strategy.ts       # passport-jwt configurado com ConfigService
    decorators/             # @Public, @CurrentUser, @Roles
    dto/                    # RegisterDto, LoginDto, AuthResponseDto
    types/                  # JwtPayload, Role enum, UserAuthentication
  users/
    user.module.ts
    services/
      user.service.ts       # CRUD de usuários via Supabase
    types/
      user.type.ts          # User, PublicUser
  kommo/
    kommo.service.ts        # cliente HTTP com throttle/retry + paginação
    kommo.controller.ts     # endpoints REST (/kommo/*)
    kommo.types.ts          # DTOs (KommoContact, KommoLead, KommoFile, ...)
    kommo.module.ts
  candidates/
    candidates.module.ts
    candidates.controller.ts # POST /candidates/sync
    candidates.services.ts   # sincronização e persistência via Supabase
    candidates.type.ts       # SyncResponse
```

### Métodos principais

#### `KommoService`

| Método                                      | Descrição                                                    |
| ------------------------------------------- | ------------------------------------------------------------ |
| `getDriveUrl()`                             | URL do drive da conta                                        |
| `getContactsByTag(tag, page)`               | Contatos por tag (paginação simples)                         |
| `getContactFiles(contactId)`                | Arquivos de um contato                                       |
| `downloadFile(downloadUrl)`                 | Download via URL completa (Buffer)                           |
| `getLeadsByPipeline(...)`                   | Leads por pipeline (1 página)                                |
| `getLeadFiles(leadId)`                      | Arquivos anexados a um lead                                  |
| `getDriveFileMeta(fileUuid)`                | Metadata de arquivo do drive                                 |
| `getDriveFiles(page, limit)`                | Lista paginada de arquivos do drive                          |
| `getCandidatesWithCvsPaginated(pipelineId)` | Async generator: leads com currículos filtrados por extensão |
| `downloadFileByUuid(fileUuid)`              | Busca metadata + download, retorna `Buffer`, nome e extensão |

Todas as requisições usam o cliente HTTP interno (`request<T>()`) com
throttle de 150 ms entre chamadas e retry exponencial em erros 5xx e
falhas de rede (até 3 tentativas).

#### `CandidatesService`

| Método             | Descrição                                                    |
| ------------------ | ------------------------------------------------------------ |
| `sync(pipelineId)` | Sincroniza candidatos: busca no Kommo → persiste no Supabase |

#### `UserService`

| Método                           | Descrição                         |
| -------------------------------- | --------------------------------- |
| `create(email, name, pass, ...)` | Registra usuário no Supabase      |
| `findByEmail(email)`             | Busca por email (retorna hash tb) |
| `findById(id)`                   | Busca por ID (sem hash)           |
| `verifyPassword(plain, hash)`    | Compara senha com bcrypt          |

## CI

Push para `main`/`develop` e PRs disparam lint + format (ubuntu e windows)
seguidos de build + testes unitários (ubuntu). Testes e2e não rodam na CI.

Antes de commitar, verifique:

```bash
npm run lint && npm run format && npm run build && npm test
```

## Stack

- [NestJS 11](https://nestjs.com) + Express
- [Supabase](https://supabase.com) — PostgreSQL via REST/PostgREST (HTTPS)
- `@supabase/supabase-js` — cliente oficial
- `@nestjs/jwt` + `passport-jwt` — autenticação JWT
- `bcrypt` — hash de senhas
- ESLint 10 (flat config) + Prettier 3
- Jest (testes unitários) + Supertest (e2e)
- TypeScript 5 (`nodenext`, target ES2023)

## Licença

UNLICENSED — uso interno.
