# kommo-fetcher

Serviço NestJS 11 que consome a API do CRM Kommo para buscar contatos, leads,
arquivos do drive e fazer download. A persistência no Supabase está planejada
mas ainda não implementada.

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

| Variável            | Obrigatória | Padrão                           |
| ------------------- | ----------- | -------------------------------- |
| `KOMMO_ACCESS_TOKEN` | Sim         | —                                |
| `DB_CONNECTION`      | Sim         | —                                |
| `DB_KEY`             | Sim         | —                                |
| `KOMMO_BASE_URL`     | Não         | `https://genterrh.kommo.com`      |
| `KOMMO_DRIVE_URL`    | Não         | `https://drive-c.kommo.com`       |
| `PORT`               | Não         | `3000`                           |
| `NODE_ENV`           | Não         | `development`                    |

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

| Rota                          | Descrição                                        |
| ----------------------------- | ------------------------------------------------ |
| `GET /kommo/drive-url`        | URL do drive da conta Kommo                      |
| `GET /kommo/contacts`         | Contatos por tag (`?tag=` requerido, `&page=`)   |
| `GET /kommo/contacts/stream`  | Todos os contatos paginados (`?tag=` requerido)  |
| `GET /kommo/contacts/:id/files` | Arquivos de um contato                         |
| `GET /kommo/leads`            | Leads por pipeline (`?pipeline_id=` requerido)   |
| `GET /kommo/leads/with-drive-files` | Leads com arquivos do drive associados    |
| `GET /kommo/drive/files`      | Arquivos do drive (`?page=&limit=`)             |
| `GET /kommo/drive/files/filter` | Filtrar por extensão (`?ext=pdf&ext=docx`)   |
| `GET /kommo/files/download`   | Download de arquivo (`?url=`)                   |

## Estrutura

```
src/
  main.ts                 # entrypoint da aplicação
  app.module.ts           # módulo raiz (ConfigModule + KommoModule)
  config/env.config.ts    # tipagem e validação de variáveis de ambiente
  kommo/
    kommo.service.ts      # cliente HTTP com throttle/retry + paginação
    kommo.controller.ts   # endpoints REST (/kommo/*)
    kommo.types.ts        # DTOs (KommoContact, KommoLead, KommoFile, ...)
  db/                     # (planejado) persistência no Supabase
  candidates/             # (planejado)
  sync/                   # (planejado) orquestração de sincronização
```

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
