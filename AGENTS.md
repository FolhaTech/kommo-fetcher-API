# kommo-fetcher

NestJS 11 service that pulls data from the Kommo CRM API and (eventually)
persists it to Supabase. Early scaffolding: the Kommo module (service + controller
with 9 REST routes) is fully wired, but DB/candidates/sync are empty stubs and
env validation (`loadEnvConfig`) is dead code. Verify wiring before assuming
something is live.

## Toolchain (non-default — easy to get wrong)

- **Linter is ESLint v10 (flat config) and formatter is Prettier v3, not
  Biome.** Despite that, `biome.json` is **not** in the repo and there is no
  ESLint/Prettier config in `package.json` — the real configs live in
  `eslint.config.mjs` and `.prettierrc`.
  - `npm run lint` → `eslint "{src,apps,libs,test}/**/*.ts"`
  - `npm run lint:fix` → `eslint ... --fix`
  - `npm run format` → `prettier --write "src/**/*.ts" "test/**/*.ts"`
  - ESLint uses `typescript-eslint` `recommendedTypeChecked` with
    `projectService: true` (rooted at the repo). It will flag type errors
    via rules like `no-floating-promises` (warn) and `no-unsafe-argument`
    (warn). `no-explicit-any` is **off**.
  - Prettier config: `singleQuote: true`, `trailingComma: "all"`,
    `tabWidth: 2`, `semi: true`, `endOfLine: "auto"`. **Note: indent is
    2 spaces, not tabs** — the previous Biome-era `AGENTS.md` was wrong
    about this.
  - There is **no Husky / lint-staged / pre-commit hook**. Do not add one
    without asking.
- **Nest CLI 11.** `nest build` deletes `dist/` (`deleteOutDir: true` in
  `nest-cli.json`). Production start is `node dist/main`
  (`npm run start:prod`).
- **TypeScript** uses `nodenext` module resolution, `target: ES2023`,
  `sourceType: 'commonjs'` (set in `eslint.config.mjs`). `tsconfig.build.json`
  excludes `test/`, `dist/`, and `**/*spec.ts`. **No `strict: true`** in
  `tsconfig.json` — type safety depends on per-flag settings and the
  type-aware ESLint rules. There is **no `typecheck` script** in
  `package.json`; `npm test` only runs Jest, it does not run `tsc`.
- **Jest config is inline in `package.json`** (`rootDir: "src"`,
  `testRegex: ".*\\.spec\\.ts$"`, `testEnvironment: "node"`, `ts-jest`
  transform). e2e uses a separate config at `test/jest-e2e.json`
  (`rootDir: "."`, `testRegex: ".e2e-spec.ts$"`).

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

- A single spec: `npx jest src/path/to/file.spec.ts`
- A single e2e: `npx jest --config ./test/jest-e2e.json -t "name"`
- There is no `npm run typecheck` — when you need to surface type errors
  without running tests, run `npx tsc --noEmit` (uses `tsconfig.json`,
  which includes `*.spec.ts`).

## CI

`.github/workflows/ci.yml` runs on push to `main`/`develop` and on PRs:

- **lint-and-format** on `ubuntu-latest` **and** `windows-latest` —
  `npm ci` → `npm run lint` → `npm run format`. Note `format` rewrites
  files, so a CI failure here means a local file is not Prettier-clean.
- **build-and-test** on `ubuntu-latest` (depends on lint) — `npm ci`
  → `npm run build` → `npm test`. e2e tests are not in CI.

Keep local `npm run lint && npm run format && npm run build && npm test`
green before pushing.

## Environment

- `.env.example` exists and is the documented template. The authoritative
  shape of env config is `src/config/env.config.ts` (`loadEnvConfig`).
- Required (validated by `loadEnvConfig`):
  - `KOMMO_ACCESS_TOKEN` — Kommo OAuth token.
  - `DB_CONNECTION` — Supabase project URL (despite the `db.*` naming,
    this is the same value the old doc called `SUPABASE_URL`).
  - `DB_KEY` — Supabase anon key.
- Optional with defaults:
  - `KOMMO_BASE_URL` → `https://genterrh.kommo.com`
  - `KOMMO_DRIVE_URL` → `https://drive-c.kommo.com`
  - `PORT` → `3000`
  - `NODE_ENV` → `development`
- `.env` is gitignored. The committed `.env` uses placeholders
  (`seu_token_aqui`, `sua-chave-aqui`) — keep `.env` out of git and
  don't commit real tokens.
- **Wire-up gap:** `loadEnvConfig` is **not** called by
  `ConfigModule.forRoot()` in `app.module.ts` (no `validate` / `load`
  hook). It is dead code. `ConfigService` is wired but
  `loadEnvConfig`'s throw on missing vars does not fire. `KommoService`
  only logs an error if `KOMMO_ACCESS_TOKEN` is missing — it does not
  throw. If you add a new required env var, update the interface and
  either wire `loadEnvConfig` into `ConfigModule` or validate it in the
  consuming service.

## Layout & what's actually wired up

```
src/
  main.ts                 # entrypoint; no global prefix, no ValidationPipe,
                          # no CORS, no global filters. Add as needed.
  app.module.ts           # ConfigModule.forRoot({isGlobal:true}) +
                          # KommoModule + AppController / AppService.
  app.controller.ts       # GET / and GET /word (the "word" route is a
                          # leftover stub returning "Hello Word 2 teste teste").
  app.service.ts          # getHello / getHelloWord — drop both stubs when
                          # adding real routes.
  config/
    env.config.ts         # EnvConfig + loadEnvConfig() — defined but
                          # NOT imported anywhere yet (dead code).
  kommo/
    kommo.service.ts      # Throttled fetch with 5xx + network retry,
                          # Bearer auth via ConfigService, pagination
                          # generator. Registered in KommoModule.
    kommo.controller.ts   # 9 REST endpoints at /kommo/*: contacts, leads,
                          # drive files, download, pagination streams.
                          # Registered in KommoModule — fully live.
    kommo.controller.spec.ts # Tests for the controller endpoints.
    kommo.module.ts       # providers:[KommoService], exports it, imports
                          # KommoController. Wired into AppModule.
    kommo.types.ts        # DTOs (KommoAccount, KommoContact,
                          # KommoPaginatedResponse, KommoFile, ...).
  scripts/
    test-kommo.ts         # empty (0 bytes) — placeholder for a manual
                          # smoke script; not wired to any npm script.
  candidates/             # empty — planned.
  db/                     # empty — Supabase persistence not started.
  sync/                   # empty — sync orchestration not started.
test/
  app.e2e-spec.ts         # only verifies GET / returns "Hello World!".
  jest-e2e.json
```

Things that look real but are not yet connected:

- `loadEnvConfig` in `src/config/env.config.ts` is dead code. Don't add
  callers until `AppModule` is updated to use it.
- `@nestjs/schedule` is in `dependencies` but `ScheduleModule.forRoot()`
  is not imported in `AppModule`. `@Cron` decorators will silently do
  nothing until it is added.
- `src/db/`, `src/candidates/`, `src/sync/` are reserved for upcoming
  work. Do not "tidy" or remove them.
- There is **no DB ORM, no migration tool, no schema directory** in
  this repo. Don't assume Prisma / TypeORM / Drizzle exists. The
  Supabase client is not installed yet either.
- `Kommo-fetcher-AP/` is referenced in `.gitignore` (Bruno collection)
  but the directory is currently absent locally.

## Conventions

- The team writes in **Portuguese (pt-BR)**. Error messages, log
  strings, and identifiers (e.g. `kommo.modulo.ts`) should match — see
  `loadEnvConfig`'s `"Variáveis de ambiente faltando"` and `KommoService`
  log strings.
- Match Prettier defaults: **2-space indent, single quotes, semicolons,
  trailing commas**. Don't fight the formatter.
- TS decorators / metadata are on (`emitDecoratorMetadata`,
  `experimentalDecorators`) — required for Nest DI, don't disable.
- For any new Kommo API call, extend `KommoService` rather than creating
  a new HTTP client. The constants `REQUEST_DELAY_MS = 150`,
  `MAX_RETRIES = 3`, `RETRY_BASE_MS = 500` and helpers `throttle` /
  `resolveUrl` / `buildJsonHeaders` at the top of
  `src/kommo/kommo.service.ts:10` are there to be reused.

## Operational gotchas

- No Dockerfile or deploy config in-repo. Production deploy flow is
  not defined here — confirm with the team before assuming one. CI
  builds and tests but does not deploy.
- `dist/`, `node_modules/`, `coverage/`, `.idea/`, `.env*` are
  gitignored. `dist/`, `.idea/`, and a stray `nul` file are present
  locally; `nest build` recreates `dist/`.
- `package.json` is `"private": true` and `"license": "UNLICENSED"` —
  do not publish.
- `package-lock.json` is committed; use `npm` (not `pnpm` / `yarn`).
- CI runs on Node 22 (`actions/setup-node@v4`, `node-version: 22`).
- README.md is the default NestJS scaffold boilerplate — skip it.
