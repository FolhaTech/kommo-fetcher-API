# kommo-fetcher

NestJS 11 service that pulls data from the Kommo CRM API and (eventually)
persists it to Supabase. The repo is early scaffolding: several feature
directories exist but are empty, and a few files look finished but are not
wired into the app. Verify wiring before assuming something is live.

## Toolchain (non-default — easy to get wrong)

- **Linter / formatter is Biome v2.5, not ESLint + Prettier.**
  - `npm run lint` → `biome check .`
  - `npm run lint:fix` → `biome check --write .`
  - `npm run format` → `biome format --write .`
  - `biome.json` enforces **tabs** for indent and **single quotes** for
    JS/TS. `useImportType` and `organizeImports` are intentionally
    turned off — do not re-enable them, and do not fight the formatter
    by hand.
  - Biome has `vcs.enabled: true` + `useIgnoreFile: true`, so it
    already respects `.gitignore`. There is **no Husky / lint-staged /
    pre-commit hook** installed; do not add one without asking.
- **Nest CLI 11.** `nest build` deletes `dist/` (`deleteOutDir: true`
  in `nest-cli.json`). Production start is `node dist/main`
  (`npm run start:prod`).
- **TypeScript** uses `nodenext` module resolution, `target: ES2023`.
  `tsconfig.build.json` excludes `test/`, `dist/`, and any `*.spec.ts`.
- **Jest config is inline in `package.json`** (`rootDir: "src"`,
  `testRegex: ".*\\.spec\\.ts$"`, `testEnvironment: "node"`). e2e uses
  a separate config at `test/jest-e2e.json` (`rootDir: "."`,
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
npm run lint           # biome check .
npm run lint:fix       # biome check --write .
npm run format         # biome format --write .
```

- A single spec: `npx jest src/path/to/file.spec.ts`
- A single e2e: `npx jest --config ./test/jest-e2e.json -t "name"`

## Environment

- `.env.example` is **empty**; the source of truth for env vars is
  `src/config/env.config.ts` (`loadEnvConfig`).
- Required: `KOMMO_ACCESS_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
  Missing values throw on startup.
- Optional with defaults:
  - `KOMMO_BASE_URL` → `https://genterrh.kommo.com`
  - `KOMMO_DRIVE_URL` → `https://drive-c.kommo.com`
  - `PORT` → `3000`
  - `NODE_ENV` → `development`
- The committed `.env` is in `.gitignore` and currently uses
  placeholder values (`seu_token_aqui`, `sua-chave-aqui`). Keep
  `.env` gitignored — do not commit real tokens.
- `loadEnvConfig` is not currently called by `ConfigModule.forRoot()`
  in `app.module.ts` (no `validate` / `load` hook). If you add a new
  required env var, update both the interface and either wire
  `loadEnvConfig` into `ConfigModule` or rely on `KommoService` to
  validate at construction.

## Layout & what's actually wired up

```
src/
  main.ts                 # entrypoint; NO global prefix, NO
                          # ValidationPipe, NO CORS, NO global filters.
                          # Add as needed.
  app.module.ts           # only registers ConfigModule.forRoot(
                          #   {isGlobal:true}) + AppController /
                          # AppService. Nothing else yet.
  app.controller.ts       # GET / and GET /word (the "word" route is
                          # a leftover stub).
  app.service.ts          # getHello / getHelloWord.
  config/
    env.config.ts         # EnvConfig + loadEnvConfig() — defined but
                          # NOT imported anywhere yet (dead code).
  kommo/
    kommo.service.ts      # KommoService with throttling + retry
                          # helpers. Not registered anywhere.
    kommo.types.ts        # Kommo API DTOs (KommoAccount,
                          # KommoContact, KommoPaginatedResponse, …).
    kommo.module.ts       # empty file — the Kommo module is not
                          # implemented.
  candidates/             # empty — planned.
  db/                     # empty — Supabase persistence not started.
  sync/                   # empty — sync orchestration not started.
test/
  app.e2e-spec.ts         # only verifies GET / returns "Hello World!".
  jest-e2e.json
```

Things that look real but are not yet connected:

- `KommoService` exists with throttle / retry / header plumbing but
  is **not registered in any module** and **not imported** anywhere.
  Adding a feature that uses it requires finishing `kommo.modulo.ts`
  and adding the module to `AppModule.imports`.
- `loadEnvConfig` in `src/config/env.config.ts` is dead code. Don't
  add callers until `AppModule` is updated to use it.
- `@nestjs/schedule` is in `dependencies` but `ScheduleModule.forRoot()`
  is not imported in `AppModule`. `@Cron` decorators will silently
  do nothing until it is added.
- `src/db/`, `src/candidates/`, `src/sync/` are reserved for upcoming
  work. Do not "tidy" or remove them.
- There is **no DB ORM, no migration tool, no schema directory** in
  this repo. Don't assume Prisma / TypeORM / Drizzle exists.

## Conventions

- The team writes in **Portuguese (pt-BR)**. Error messages,
  identifiers (e.g. `kommo.modulo.ts`), and log strings should match —
  see `loadEnvConfig`'s `"Variáveis de ambiente faltando"` and
  `KommoService` log strings.
- Stick to the Biome-formatted style: tabs, single quotes. No
  Prettier / ESLint config exists, and none should be added.
- TS decorators / metadata are on (`emitDecoratorMetadata`,
  `experimentalDecorators`) — required for Nest DI, don't disable.
- For any new Kommo API call, extend `KommoService` rather than
  creating a new HTTP client. The constants
  `REQUEST_DELAY_MS = 150`, `MAX_RETRIES = 3`, `RETRY_BASE_MS = 500`
  and helpers `throttle` / `resolveUrl` / `buildJsonHeaders` at the
  top of that file are there to be reused.

## Operational gotchas

- No CI, no Dockerfile, no deploy config in-repo. Production deploy
  flow is not defined here — confirm with the team before assuming
  one.
- `dist/` is gitignored but currently present locally; safe to delete,
  `nest build` recreates it.
- `package.json` is `"private": true` and `"license": "UNLICENSED"` —
  do not publish.
- `node_modules/`, `coverage/`, `.idea/`, `.env*` are all gitignored.
- `package-lock.json` is committed; use `npm` (not `pnpm` / `yarn`).
