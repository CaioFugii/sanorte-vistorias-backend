# Sistema de Vistorias em Campo - Backend

API REST em NestJS para gestão de vistorias de campo, com autenticação JWT, armazenamento local/S3/Cloudinary e fluxo de pendências.

## Stack

- NestJS
- TypeORM
- PostgreSQL
- JWT
- Storage: local (dev), S3 ou Cloudinary

## Pré-requisitos

- Node.js 18+
- Docker (Postgres local) ou PostgreSQL 12+
- npm

## Ambiente local (recomendado)

Na raiz do monorepo:

```bash
docker compose up -d
cd sanorte-vistorias-backend
cp .env.example .env   # ajuste DATABASE_URL_PRD se for gerar seed a partir de produção
npm install
npm run migration:run
npm run seed:local
npm run start:dev
```

Ou use o script único: `./scripts/setup-local.sh`.

`seed:local` gera um snapshot de produção (se ainda não existir) e carrega no Postgres local:

- cadastros completos (usuários, equipes, checklists, contratos, etc.)
- cerca de 500 vistorias/OS mais recentes, com itens, evidências e assinaturas relacionados
- senha local de todos os usuários: `senha123`

O snapshot fica em `src/database/seeds/data/prd-snapshot.json` (gitignored). Regenerar:

```bash
npm run seed:dump-prd
npm run seed:load-prd
```

## Configuração manual

1. Instalar dependências:

```bash
npm install
```

2. Criar `.env` (veja `.env.example`). Para local:

```env
DATABASE_URL=postgres://sanorte:sanorte@localhost:5432/vistorias_db
DATABASE_SSL=false
DATABASE_URL_PRD=postgres://user:pass@host:5432/dbname
PORT=3000
NODE_ENV=development
PUBLIC_API_URL=http://localhost:3000
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
CORS_ORIGINS=http://localhost:5173
STORAGE_PROVIDER=local
STORAGE_PATH=./storage
```

`DATABASE_URL` deve apontar para o Postgres **local**. `DATABASE_URL_PRD` só é usado pelo dump.

3. Executar migrations e seed mínimo (sem dados de PRD):

```bash
npm run migration:run
npm run seed
```

## Usuários padrão (seed)

| Email | Senha | Role |
|---|---|---|
| admin@sanorte.com | senha123 | ADMIN |
| gestor@sanorte.com | senha123 | GESTOR |
| supervisor@sanorte.com | senha123 | SUPERVISOR |
| fiscal@sanorte.com | senha123 | FISCAL |

Setores padrão (seed): `ESGOTO`, `AGUA`, `REPOSICAO`.

## Executar

```bash
npm run start:dev
```

API disponível em `http://localhost:3000`.

## Autenticação

- `POST /auth/login`: retorna `accessToken` e `user`
- `GET /auth/me`: retorna dados do usuário autenticado

Envie o token JWT no header:

```text
Authorization: Bearer <token>
```

## Endpoints por módulo

### Monitoring

- `GET /monitoring/sentry-smoke-test` (protegido por header `x-monitoring-token`)

### Auth

- `POST /auth/login`
- `GET /auth/me`

### Users (ADMIN)

- `GET /users`
- `POST /users`
- `PUT /users/:id`
- `DELETE /users/:id`

### Teams

- `GET /teams` (autenticado)
- `POST /teams` (ADMIN)
- `PUT /teams/:id` (ADMIN)
- `DELETE /teams/:id` (ADMIN)

### Sectors

- `GET /sectors` (autenticado)
- `GET /sectors/:id` (autenticado)
- `POST /sectors` (ADMIN)
- `PUT /sectors/:id` (ADMIN)
- `DELETE /sectors/:id` (ADMIN)

### Collaborators

- `GET /collaborators` (autenticado)
  - filtros opcionais: `name`, `sectorId`, `page`, `limit`
- `POST /collaborators` (ADMIN)
- `PUT /collaborators/:id` (ADMIN)
- `DELETE /collaborators/:id` (ADMIN)

### Checklists

- `GET /checklists` (autenticado)
  - filtros opcionais: `module`, `inspectionScope`, `active`, `sectorId`, `page`, `limit`
- `GET /checklists/:id` (autenticado)
- `POST /checklists` (ADMIN)
- `PUT /checklists/:id` (ADMIN)
- `DELETE /checklists/:id` (ADMIN)
- `POST /checklists/:id/items` (ADMIN)
- `PUT /checklists/:id/items/:itemId` (ADMIN)
- `DELETE /checklists/:id/items/:itemId` (ADMIN)
- `POST /checklists/:id/sections` (ADMIN)
- `PUT /checklists/:id/sections/:sectionId` (ADMIN)

### Inspections

- `POST /inspections` (FISCAL/GESTOR/SUPERVISOR)
- `GET /inspections` (GESTOR/SUPERVISOR/ADMIN; não lista `RASCUNHO`)
- `GET /inspections/mine` (FISCAL)
- `GET /inspections/:id` (autenticado; resposta enxuta para detalhe/PDF)
- `PUT /inspections/:id` (autenticado; regra por status/role)
- `PUT /inspections/:id/items` (autenticado)
- `POST /inspections/:id/evidences` (multipart)
- `DELETE /inspections/:id/evidences/:evidenceId` (FISCAL/GESTOR/SUPERVISOR/ADMIN; 204)
- `POST /inspections/:id/signature` (JSON)
- `POST /inspections/:id/paralyze` (FISCAL/GESTOR/SUPERVISOR/ADMIN)
- `POST /inspections/:id/unparalyze` (GESTOR/SUPERVISOR/ADMIN)
- `POST /inspections/:id/finalize` (FISCAL/GESTOR/SUPERVISOR)
- `POST /inspections/:id/items/:itemId/resolve` (FISCAL/GESTOR/SUPERVISOR/ADMIN)
- `POST /inspections/:id/resolve` (FISCAL/GESTOR/SUPERVISOR/ADMIN)

### Sync

- `POST /sync/inspections` (FISCAL/GESTOR/SUPERVISOR/ADMIN)

### Uploads

- `POST /uploads` (multipart, autenticado)
- `DELETE /uploads/:publicId` (autenticado)

### Dashboards

- `GET /dashboards/summary` (autenticado)
- `GET /dashboards/ranking/teams` (autenticado)
- `GET /dashboards/ranking/teams/safety-work` (autenticado)

## Regras de negócio principais

- O sistema possui setores padrão (`ESGOTO`, `AGUA`, `REPOSICAO`) e permite cadastrar novos via endpoint de `sectors`.
- `Collaborator` e `Checklist` podem ser vinculados a um setor por `sectorId`.
- Checklist pode ser criado com `inspectionScope` (`TEAM` ou `COLLABORATOR`), com padrão `TEAM` quando omitido.
- Ao informar `sectorId` em criação/edição de colaborador ou checklist, o setor precisa existir.
- Não é permitido deletar setor vinculado a colaboradores ou checklists.
- Em `POST /inspections`, `teamId` é obrigatório para módulos diferentes de `SEGURANCA_TRABALHO` e opcional para `SEGURANCA_TRABALHO`.
- FISCAL só edita vistoria em `RASCUNHO`.
- Atualização de itens recalcula automaticamente a nota da vistoria (`scorePercent`).
- Vistoria pode ser paralisada por FISCAL/GESTOR/SUPERVISOR/ADMIN com motivo obrigatório.
- Ao paralisar, a vistoria recebe penalidade persistente de 25% na nota (`scorePercent`).
- GESTOR/SUPERVISOR/ADMIN podem remover a penalidade via `POST /inspections/:id/unparalyze` (correção de erro).
- Para GESTOR/SUPERVISOR/ADMIN, ao atualizar itens em vistoria `FINALIZADA` ou `PENDENTE_AJUSTE`, o status é reavaliado automaticamente (`FINALIZADA` ↔ `PENDENTE_AJUSTE`).
- Exceção: em `SEGURANCA_TRABALHO`, a vistoria não vai para `PENDENTE_AJUSTE` (mantém `FINALIZADA`).
- `POST /inspections/:id/finalize` exige:
  - assinatura do líder/encarregado;
  - evidência para item `NAO_CONFORME` quando `requiresPhotoOnNonConformity = true`.
- Ao finalizar:
  - em `SEGURANCA_TRABALHO`: status `FINALIZADA` (mesmo com `NAO_CONFORME`) e sem `PendingAdjustment`;
  - nos demais módulos, sem `NAO_CONFORME`: status `FINALIZADA`;
  - nos demais módulos, com `NAO_CONFORME`: status `PENDENTE_AJUSTE` e cria/atualiza `PendingAdjustment`.
- Resolução de item não conforme (`/items/:itemId/resolve`):
  - só em vistoria `PENDENTE_AJUSTE`;
  - aceita `resolutionEvidence` como URL ou base64.
- Quando todos os itens `NAO_CONFORME` forem resolvidos, vistoria passa para `RESOLVIDA`.
- Endpoint `/inspections/:id/resolve` só conclui quando todos os itens não conformes já estiverem resolvidos.
- Sync offline é idempotente por `externalId` e não aceita assets em `dataUrl`.

## Paginação padrão

Listagens retornam:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0,
    "hasNext": false,
    "hasPrev": false
  }
}
```

## Armazenamento de imagens (local / Cloudinary / S3)

Em desenvolvimento local use `STORAGE_PROVIDER=local`. Arquivos vão para `STORAGE_PATH` (padrão `./storage`) e são servidos em `GET /files/*`.

Em produção, uploads usam Cloudinary (`STORAGE_PROVIDER=cloudinary`) ou AWS S3:

```env
STORAGE_PROVIDER=s3
AWS_REGION=sa-east-1
AWS_S3_BUCKET=seu-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Na Heroku (`sanorte-vistorias-backend`):

```bash
heroku config:set STORAGE_PROVIDER=s3 AWS_REGION=sa-east-1 AWS_S3_BUCKET=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... -a sanorte-vistorias-backend
```

Mantenha `CLOUDINARY_URL` configurado durante a transição para rollback via flag.

Fase atual: uploads genéricos, evidências, assinaturas, resolução de pendências e imagens de referência de checklist usam o provider selecionado. Novos registros persistem `storageProvider`, `storageKey` e `storageBucket`; legado Cloudinary continua legível via `url` e `cloudinaryPublicId`. Deleção remota usa o provider gravado no registro.

Após deploy, rodar migration:

```bash
npm run migration:run
```

### Backfill Cloudinary -> S3

Verificar quantos assets legados ainda estão no Cloudinary:

```bash
npm run storage:legacy-stats
```

Simular migração (sem gravar):

```bash
npm run storage:migrate-cloudinary-to-s3 -- --dry-run --limit 20
```

Executar migração em lotes:

```bash
npm run storage:migrate-cloudinary-to-s3 -- --batch-size 25
```

Heroku:

```bash
heroku run npm run storage:legacy-stats -a sanorte-vistorias-backend
heroku run npm run storage:migrate-cloudinary-to-s3 -- --dry-run --limit 20 -a sanorte-vistorias-backend
heroku run npm run storage:migrate-cloudinary-to-s3 -- --batch-size 25 -a sanorte-vistorias-backend
```

O job copia `evidences`, `signatures` e `checklist_items` com `storage_provider=cloudinary`, preservando a key (`quality/...`) e atualizando `url` para o bucket S3.

### Descomissionamento Cloudinary

1. Ativar `STORAGE_PROVIDER=s3` em produção.
2. Rodar `storage:legacy-stats` até `cloudinaryPendingMigration = 0`.
3. Manter `CLOUDINARY_URL` por 2–4 semanas para rollback.
4. Remover `CLOUDINARY_URL` e, depois, o SDK Cloudinary do código quando estável.

Rollback imediato de novos uploads: `STORAGE_PROVIDER=cloudinary`.

## Documentação detalhada

Para payloads JSON completos de request/response por endpoint, consulte `API_DOCUMENTATION.md`.
