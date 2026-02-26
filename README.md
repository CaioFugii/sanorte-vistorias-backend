# Sistema de Vistorias em Campo - Backend

API REST em NestJS para gestão de vistorias de campo, com autenticação JWT, upload de imagens no Cloudinary, fluxo de pendências e geração de PDF.

## Stack

- NestJS
- TypeORM
- PostgreSQL
- JWT
- Cloudinary
- PDFKit

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
```

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
  - filtros opcionais: `sectorId`, `page`, `limit`
- `POST /collaborators` (ADMIN)
- `PUT /collaborators/:id` (ADMIN)
- `DELETE /collaborators/:id` (ADMIN)

### Checklists

- `GET /checklists` (autenticado)
  - filtros opcionais: `module`, `active`, `sectorId`, `page`, `limit`
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

- `POST /inspections` (FISCAL/GESTOR)
- `GET /inspections` (GESTOR/ADMIN; não lista `RASCUNHO`)
- `GET /inspections/mine` (FISCAL)
- `GET /inspections/:id` (autenticado)
- `PUT /inspections/:id` (autenticado; regra por status/role)
- `PUT /inspections/:id/items` (autenticado)
- `POST /inspections/:id/evidences` (multipart)
- `POST /inspections/:id/signature` (JSON)
- `POST /inspections/:id/finalize` (FISCAL/GESTOR)
- `POST /inspections/:id/items/:itemId/resolve` (FISCAL/GESTOR/ADMIN)
- `POST /inspections/:id/resolve` (FISCAL/GESTOR/ADMIN)
- `GET /inspections/:id/pdf` (download PDF)

### Sync

- `POST /sync/inspections` (FISCAL/GESTOR/ADMIN)

### Uploads

- `POST /uploads` (multipart, autenticado)
- `DELETE /uploads/:publicId` (autenticado)

### Dashboards

- `GET /dashboards/summary` (autenticado)
- `GET /dashboards/ranking/teams` (autenticado)

## Regras de negócio principais

- O sistema possui setores padrão (`ESGOTO`, `AGUA`, `REPOSICAO`) e permite cadastrar novos via endpoint de `sectors`.
- `Collaborator` e `Checklist` podem ser vinculados a um setor por `sectorId`.
- Ao informar `sectorId` em criação/edição de colaborador ou checklist, o setor precisa existir.
- Não é permitido deletar setor vinculado a colaboradores ou checklists.
- FISCAL só edita vistoria em `RASCUNHO`.
- `POST /inspections/:id/finalize` exige:
  - assinatura do líder/encarregado;
  - evidência para item `NAO_CONFORME` quando `requiresPhotoOnNonConformity = true`.
- Ao finalizar:
  - sem `NAO_CONFORME`: status `FINALIZADA`;
  - com `NAO_CONFORME`: status `PENDENTE_AJUSTE` e cria/atualiza `PendingAdjustment`.
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

## Documentação detalhada

Para payloads JSON completos de request/response por endpoint, consulte `API_DOCUMENTATION.md`.
