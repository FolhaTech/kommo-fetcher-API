# kommo-fetcher

NestJS 11 service that pulls data from the Kommo CRM API and (eventually)
persists it to Supabase. The Kommo module (service + controller with 11 REST
routes, including a candidates sync generator) is fully wired. DB/candidates/sync
modules are not yet created. Env validation (`loadEnvConfig`) is dead code.

## Toolchain (non-default — easy to get wrong)

- **Linter is ESLint v10 (flat config) and formatter is Prettier v3, not
  Biome.** `biome.json` is not in the repo; configs live in `eslint.config.mjs`
  and `.prettierrc`.
  - `npm run lint` → `eslint "{src,apps,libs,test}/**/*.ts"`
  - `npm run lint:fix` → `eslint ... --fix`
  - `npm run format` → `prettier --write "src/**/*.ts" "test/**/*.ts"`
  - ESLint uses `typescript-eslint` `recommendedTypeChecked` with
    `projectService: true` (rooted at the repo). Flags type errors via
    `no-floating-promises` (warn) and `no-unsafe-argument` (warn).
    `no-explicit-any` is **off**.
  - Prettier: `singleQuote: true`, `trailingComma: "all"`, `tabWidth: 2`,
    `semi: true`, `endOfLine: "auto"`. **Indent is 2 spaces, not tabs.**
  - No Husky / lint-staged / pre-commit hook. Do not add one without asking.
- **Nest CLI 11.** `nest build` deletes `dist/` (`deleteOutDir: true` in
  `nest-cli.json`). Production start is `node dist/main` (`npm run start:prod`).
- **TypeScript** uses `nodenext` module resolution, `target: ES2023`,
  `sourceType: 'commonjs'` (in `eslint.config.mjs`). `tsconfig.build.json`
  excludes `test/`, `dist/`, `**/*spec.ts`. **No `strict: true`** — type
  safety relies on per-flag settings + type-aware ESLint rules. No
  `typecheck` script; `npm test` only runs Jest (no `tsc`).
- **Jest config is inline in `package.json`** (`rootDir: "src"`,
  `testRegex: ".*\\.spec\\.ts$"`, `testEnvironment: "node"`, ts-jest
  transform). e2e uses `test/jest-e2e.json` (`rootDir: "."`,
  `testRegex: ".e2e-spec.ts$"`).

## Commands

```bash
npm install
npm run start:dev      # nest start --watch (dev)
npm run start:debug    # nest start --debug --watch
npm run build          # nest build → dist/
npm run start:prod     # node dist/main
npm test               # unit (Jest, rootDir=src)
npm run test:watch
npm run test:cov       # coverage into ../coverage
npm run test:e2e       # uses test/jest-e2e.json
npm run lint           # eslint
npm run lint:fix
npm run format         # prettier --write
```

- Single spec: `npx jest src/path/to/file.spec.ts`
- Single e2e: `npx jest --config ./test/jest-e2e.json -t "name"`
- No `npm run typecheck` — surface type errors without tests via
  `npx tsc --noEmit` (uses `tsconfig.json`, which includes `*.spec.ts`).

## CI

`.github/workflows/ci.yml` runs on push to `main`/`develop` and on PRs:

- **lint-and-format** on `ubuntu-latest` **and** `windows-latest` —
  `npm ci` → `npm run lint` → `npm run format`. `format` rewrites files,
  so a CI failure here means a local file is not Prettier-clean.
- **build-and-test** on `ubuntu-latest` (depends on lint) — `npm ci`
  → `npm run build` → `npm test`. e2e tests are not in CI.

Keep `npm run lint && npm run format && npm run build && npm test` green
before pushing.

## Environment

- `.env.example` is the documented template. Authoritative shape of env
  config is `src/config/env.config.ts` (`loadEnvConfig`), **but it is dead
  code** — not called by `ConfigModule.forRoot()` in `app.module.ts`.
  `ConfigService` is wired; `loadEnvConfig`'s throw on missing vars never
  fires. `KommoService` only logs an error if `KOMMO_ACCESS_TOKEN` is
  missing. If you add a required env var, update the interface and either
  wire `loadEnvConfig` or validate in the consuming service.
- Required (declared by `loadEnvConfig`, not enforced): `KOMMO_ACCESS_TOKEN`,
  `DB_CONNECTION`, `DB_KEY`.
- Optional with defaults: `KOMMO_BASE_URL` → `https://genterrh.kommo.com`,
  `KOMMO_DRIVE_URL` → `https://drive-c.kommo.com`, `PORT` → `3000`,
  `NODE_ENV` → `development`.
- `.env` is gitignored; committed `.env` uses placeholders
  (`seu_token_aqui`, `sua-chave-aqui`). Keep real tokens out of git.

### ⚠️ `KOMMO_BASE_URL` gotcha — use the `api_domain` from the JWT

The default `https://genterrh.kommo.com` in `kommo.service.ts:29` and
`env.config.ts:29` is the **frontend web subdomain**, not the API gateway.
On some networks this resolves to IPs that give `EHOSTUNREACH` /
`No route to host` even when outbound 443 otherwise works (observed on
Linux/home networks, while Windows/corporate worked).

The correct API domain is encoded in the JWT's `api_domain` claim (e.g.
`api-g.kommo.com`). Decode the token payload and set `KOMMO_BASE_URL`
accordingly (e.g. `https://api-g.kommo.com`). `KOMMO_DRIVE_URL`
(`drive-c.kommo.com`) is a different host and is unaffected.

## Layout & what's actually wired up

```
src/
  main.ts                 # entrypoint; no global prefix, no ValidationPipe,
                          # no CORS, no global filters. Listens on 0.0.0.0.
  app.module.ts           # ConfigModule.forRoot({isGlobal:true}) + KommoModule
                          # + AppController/AppService.
  app.controller.ts       # GET / and GET /word (leftover stub).
  app.service.ts          # getHello / getHelloWord stubs.
  config/
    env.config.ts         # EnvConfig + loadEnvConfig() — dead code.
  kommo/
    kommo.service.ts      # Throttled fetch, 5xx+network retry, Bearer auth,
                          # pagination generators, lead-file/drive-meta lookup,
                          # candidates sync generator, download by uuid.
    kommo.controller.ts   # 11 REST endpoints at /kommo/* — fully live.
    kommo.controller.spec.ts
    kommo.module.ts       # providers:[KommoService], exports it.
    kommo.types.ts        # DTOs (KommoContact, KommoLead, KommoFile,
                          # KommoLeadFile, KommoDriveFileMeta,
                          # CandidateResult, ...).
  scripts/
    test-kommo.ts         # empty (0 bytes) placeholder; not in any npm script.
```

`src/db/`, `src/candidates/`, `src/sync/` are referenced in the README as
planned but **do not exist on disk** — create them when you start that work.
There is no DB ORM, migration tool, or Supabase client installed.

### Endpoints (11)

`/kommo/drive-url` (GET), `/kommo/contacts` (GET, `?tag=&page=`),
`/kommo/contacts/stream` (GET, `?tag=`), `/kommo/contacts/:id/files` (GET),
`/kommo/leads` (GET, `?pipeline_id=&page=`),
`/kommo/leads/with-drive-files` (GET, `?pipeline_id=`),
`/kommo/drive/files` (GET, `?page=&limit=`),
`/kommo/drive/files/filter` (GET, `?ext=pdf&ext=docx`),
`/kommo/files/download` (GET, `?url=` — full URL),
`/kommo/files/:uuid/download` (GET — path param, Content-Type per extension),
`/kommo/candidates/sync` (POST).

### `POST /kommo/candidates/sync`

Hardcoded pipeline `13538803` in the controller — not a query param. It
runs `getCandidatesWithCvsPaginated`, which for each lead calls
`GET /api/v4/leads/{id}/files`, then `GET /v1.0/files/{uuid}` per file,
filtering to `['pdf','doc','docx']`. Returns
`{ total, candidates: CandidateResult[] }`. Expect ~20-40s with 136 leads
(sequential, throttled at 150ms each).

## KommoService conventions

- For any new Kommo API call, **extend `KommoService`** — do not create a
  new HTTP client. Reuse the constants `REQUEST_DELAY_MS = 150`,
  `MAX_RETRIES = 3`, `RETRY_BASE_MS = 500` and helpers `throttle` /
  `resolveUrl` / `buildJsonHeaders` at the top of
  `src/kommo/kommo.service.ts:14`.
- `resolveUrl` routes by prefix: `http*` → as-is; `/v1.0*` → `${driveUrl}${url}`;
  everything else → `${baseUrl}${url}` (the v4 API routes).
- `request<T>()` returns `null` on 204, retries 5xx and network errors
  with exponential backoff, throws on other non-ok. **404 is thrown** —
  callers that query potentially-missing files (e.g. `getDriveFileMeta`)
  must `try/catch` and treat as "no file".
- The team writes in **Portuguese (pt-BR)**. Error messages, log strings,
  and some identifiers match — see `loadEnvConfig`'s
  `"Variáveis de ambiente faltando"`.
- TS decorators / metadata are on (`emitDecoratorMetadata`,
  `experimentalDecorators`) — required for Nest DI.

## Operational gotchas

- No Dockerfile or deploy config in-repo. Production deploy flow is not
  defined here — confirm with the team before assuming one. CI builds and
  tests but does not deploy.
- `dist/`, `node_modules/`, `coverage/`, `.idea/`, `.env*` are gitignored.
  `nest build` recreates `dist/`.
- `package.json` is `"private": true`, `"license": "UNLICENSED"` — do not
  publish.
- `package-lock.json` is committed; use `npm` (not `pnpm` / `yarn`).
- CI runs on Node 22 (`actions/setup-node@v4`, `node-version: 22`).
- `@nestjs/schedule` is in `dependencies` but `ScheduleModule.forRoot()`
  is not imported in `AppModule`. `@Cron` decorators silently do nothing
  until it is added.
- `Kommo-fetcher-AP/` (Bruno collection) is referenced in `.gitignore` but
  not necessarily present locally — don't assume a Bruno collection exists.