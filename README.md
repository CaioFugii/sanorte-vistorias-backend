# Sistema de Vistorias em Campo - Backend

API REST em NestJS para gestão de vistorias de campo, com autenticação JWT, upload de imagens no Cloudinary e fluxo de pendências.

## Stack

- NestJS
- TypeORM
- PostgreSQL
- JWT
- Cloudinary

## Pré-requisitos

- Node.js 18+
- PostgreSQL 12+
- npm

## Configuração

1. Instalar dependências:

```bash
npm install
```

2. Criar `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=vistorias_db
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
STORAGE_PROVIDER=cloudinary
AWS_REGION=sa-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
SENTRY_DSN=https://<key>@o0.ingest.sentry.io/<project-id>
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=sanorte-vistorias-backend@1.0.1
SENTRY_TRACES_SAMPLE_RATE=0.1
MONITORING_SMOKE_TEST_TOKEN=change-this-token
```

Obs.: `SENTRY_RELEASE` pode ser omitido em deploys Heroku, pois o backend agora usa automaticamente `HEROKU_SLUG_COMMIT` (ou `SOURCE_VERSION`) quando disponível.

3. Executar migrations e seed:

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

## Armazenamento de imagens (Cloudinary / S3)

Por padrão, uploads usam Cloudinary (`STORAGE_PROVIDER=cloudinary`). Para AWS S3:

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

Fase atual: uploads genéricos, evidências, assinaturas, resolução de pendências e imagens de referência de checklist usam o provider selecionado. Registros legados no Cloudinary continuam legíveis via `url` persistida.

## Documentação detalhada

Para payloads JSON completos de request/response por endpoint, consulte `API_DOCUMENTATION.md`.
