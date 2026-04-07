# API Documentation - Sanorte Vistorias Backend

## Guia rápido para Agent (Frontend)

Esta seção foi criada para acelerar implementação de novas funcionalidades no frontend e reduzir dúvida sobre regra de negócio.

### Como usar este documento com eficiência

- Leia primeiro esta seção (`Guia rápido para Agent`).
- Depois vá direto para o módulo de endpoint necessário (`Auth`, `Inspections`, `Checklists`, etc.).
- Use `Permissões por role` para checar visibilidade e ações em tela.
- Use `Erros comuns` para mapear mensagens que já devem ser tratadas na UI.

### Bootstrapping de autenticação

1. Faça login em `POST /auth/login`.
2. Salve `accessToken`.
3. Envie em todas as rotas autenticadas:

```text
Authorization: Bearer <token>
```

### Mapa rápido de telas -> endpoints

- Login / sessão: `POST /auth/login`, `GET /auth/me`
- Usuários: `GET/POST/PUT/DELETE /users`, `PUT /users/:id/contracts`
- Contratos (admin): `GET/POST/PUT/DELETE /contracts`
- Equipes: `GET/POST/PUT/DELETE /teams`
- Setores: `GET/POST/PUT/DELETE /sectors`
- Colaboradores: `GET/POST/PUT/DELETE /collaborators`
- Checklists (com seções/itens): `GET/POST/PUT/DELETE /checklists` + rotas de `sections` e `items`
- Ordens de Serviço (OS): `GET /service-orders`, `POST /service-orders/import`
- Vistorias:
  - criação/lista/detalhe: `POST /inspections`, `GET /inspections`, `GET /inspections/mine`, `GET /inspections/:id`
  - edição: `PUT /inspections/:id`, `PUT /inspections/:id/items`
  - anexos e assinatura: `POST /inspections/:id/evidences`, `POST /inspections/:id/signature`
  - transições: `POST /inspections/:id/paralyze`, `POST /inspections/:id/finalize`, `POST /inspections/:id/items/:itemId/resolve`, `POST /inspections/:id/resolve`
- Sync offline: `POST /sync/inspections`
- Upload genérico: `POST /uploads`, `DELETE /uploads/:publicId`
- Dashboards: `GET /dashboards/summary`, `GET /dashboards/ranking/teams`, `GET /dashboards/teams/:teamId`, `GET /dashboards/quality-by-service`, `GET /dashboards/current-month-by-service`

### Regras críticas que impactam UI

- Nova vistoria (`POST /inspections` e sync):
  - `serviceOrderId` é obrigatório para módulos diferentes de `SEGURANCA_TRABALHO`.
  - para `SEGURANCA_TRABALHO`, `serviceOrderId` é opcional.
  - `teamId` é obrigatório para módulos diferentes de `SEGURANCA_TRABALHO`.
  - para `SEGURANCA_TRABALHO`, `teamId` é opcional.
- `GET /inspections` (GESTOR/ADMIN) não retorna `RASCUNHO`.
- `GET /inspections/mine` é a listagem do FISCAL (onde rascunho aparece).
- Escopo por contrato:
  - `ADMIN` vê todos os dados.
  - `GESTOR` e `FISCAL` veem apenas dados dentro dos contratos vinculados ao usuário.
  - O filtro é aplicado nas listagens principais (`service-orders`, `inspections`, `dashboards`, `teams`).
- Usuários:
  - `POST /users` exige `contractIds`.
  - `PUT /users/:id` exige `contractIds`.
- Equipes:
  - `POST /teams` exige `contractIds`.
  - `PUT /teams/:id` exige `contractIds`.
- Importação de OS (`POST /service-orders/import`):
  - exige `contractId` no form-data.
  - uma execução de importação aplica exatamente 1 contrato para todas as OS processadas.
- `PUT /inspections/:id`:
  - FISCAL só edita em `RASCUNHO`.
  - GESTOR/ADMIN editam em qualquer status.
- `PUT /inspections/:id/items`:
  - FISCAL só em `RASCUNHO`.
  - GESTOR/ADMIN em qualquer status.
  - Sempre recalcula `scorePercent`.
  - Para GESTOR/ADMIN, reavalia status automaticamente (`FINALIZADA` <-> `PENDENTE_AJUSTE`) quando aplicável.
  - Exceção: para módulo `SEGURANCA_TRABALHO`, o status não vai para `PENDENTE_AJUSTE` (permanece/retorna `FINALIZADA`).
- `POST /inspections/:id/evidences`:
  - FISCAL só em `RASCUNHO`.
  - GESTOR/ADMIN em qualquer status.
- `POST /inspections/:id/paralyze`:
  - disponível para FISCAL/GESTOR/ADMIN.
  - ativa penalidade persistente de 25% na nota.
- `POST /inspections/:id/unparalyze`:
  - disponível apenas para GESTOR/ADMIN.
  - remove penalidade e recalcula nota (correção de erro).
- `POST /inspections/:id/finalize`: assinatura é opcional; para itens não conformes com obrigatoriedade, evidência é exigida.

### Máquina de status da vistoria (visão frontend)

- `RASCUNHO`
  - estado de edição principal do FISCAL.
  - transição via `finalize` para:
    - `FINALIZADA` (sempre para módulo `SEGURANCA_TRABALHO`);
    - `FINALIZADA` (sem não conformidade nos demais módulos), ou
    - `PENDENTE_AJUSTE` (com não conformidade nos demais módulos).
- `PENDENTE_AJUSTE`
  - pode avançar para `RESOLVIDA` quando pendências são resolvidas.
- `FINALIZADA`
  - pode voltar para `PENDENTE_AJUSTE` se GESTOR/ADMIN alterarem itens e surgirem não conformidades.
  - Exceção: no módulo `SEGURANCA_TRABALHO`, não há transição para `PENDENTE_AJUSTE`.
- `RESOLVIDA`
  - status final após resolução de pendências.
- Paralisação é um estado paralelo:
  - `hasParalysisPenalty = true` indica que a penalidade de 25% deve ser aplicada na nota.

### Filtros disponíveis para listagens (essencial para telas)

- Paginação padrão em listas: `page`, `limit`.
- `GET /service-orders`: filtros por `osNumber` (busca parcial), `sectorId`, `field`, `remote`, `postWork` (boolean `true`/`false`; filtra OS por uso no módulo CAMPO, REMOTO ou POS_OBRA).
- `GET /collaborators`: filtros por `name` (busca parcial) e `sectorId`.
- `GET /checklists`: filtros por `module`, `inspectionScope`, `active`, `sectorId`.
- `GET /inspections`: filtros por `periodFrom`, `periodTo`, `module`, `teamId`, `status`, `osNumber` (busca parcial por número da OS; regra de ocultar rascunho para GESTOR/ADMIN).
- `GET /inspections/mine`: filtro por `osNumber` (busca parcial por número da OS).

### Contratos e padrões de resposta

- Listas retornam:
  - `data` (array)
  - `meta` (`page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`)
- Erros seguem:
  - `statusCode`
  - `message`
  - `error`

### Integração offline (resumo operacional)

- Use `externalId` para idempotência no `POST /sync/inspections`.
- No sync, `serviceOrderId` é obrigatório para criar nova vistoria quando o módulo não é `SEGURANCA_TRABALHO`.
- Não enviar `dataUrl` em evidências no sync (assets devem ser enviados antes).
- Se precisar aplicar penalidade de paralisação no sync, envie `paralyze.reason`.
- `GET /inspections/:id` aceita `id` do servidor **ou** `externalId`, o que simplifica reconciliação de dados locais.

### Checklist para novas funcionalidades no frontend

- Ao criar vistoria: buscar lista de OS em `GET /service-orders` e permitir seleção (campo obrigatório).
- Confirmar role do usuário e esconder ações não permitidas.
- Aplicar filtros corretos por contexto de tela (ex.: `sectorId`).
- Considerar transições de status automáticas após `PUT /inspections/:id/items`.
- Considerar impacto da paralisação na nota (`scorePercent`).
- Recarregar detalhe da vistoria após operações críticas (`updateItems`, `finalize`, `resolve`, `resolveItem`).
- Tratar mensagens de domínio conhecidas em toasts/feedback de formulário.

---

## Informações gerais

- Base URL (dev): `http://localhost:3000`
- Autenticação: JWT Bearer Token
- Formato padrão: JSON (exceto upload de arquivo)

Header para rotas autenticadas:

```text
Authorization: Bearer <token>
Content-Type: application/json
```

## Enums

### UserRole

```json
["ADMIN", "GESTOR", "FISCAL"]
```

### ModuleType

```json
["QUALIDADE", "SEGURANCA_TRABALHO", "OBRAS_INVESTIMENTO", "OBRAS_GLOBAL", "CANTEIRO"]
```

### InspectionStatus

```json
["RASCUNHO", "FINALIZADA", "PENDENTE_AJUSTE", "RESOLVIDA"]
```

### ChecklistAnswer

```json
["CONFORME", "NAO_CONFORME", "NAO_APLICAVEL"]
```

### PendingStatus

```json
["PENDENTE", "RESOLVIDA"]
```

## Paginação

Query params padrão:

- `page` (default `1`)
- `limit` (default `10`, max `100`)

Resposta paginada:

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

## Modelos (resumo)

### User

```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "role": "ADMIN",
  "contracts": [
    { "id": "uuid", "name": "CONTRATO_NORTE" }
  ],
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### Team

```json
{
  "id": "uuid",
  "name": "Equipe A",
  "active": true,
  "isContractor": false,
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z",
  "contracts": [
    { "id": "uuid", "name": "CONTRATO_NORTE" }
  ],
  "collaborators": [
    {
      "id": "uuid",
      "name": "Colaborador 1",
      "active": true
    }
  ]
}
```

### Sector

```json
{
  "id": "uuid",
  "name": "ESGOTO",
  "active": true,
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### Collaborator

```json
{
  "id": "uuid",
  "name": "Colaborador 1",
  "sectorId": "uuid",
  "sector": {
    "id": "uuid",
    "name": "ESGOTO",
    "active": true
  },
  "active": true,
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### Checklist (com seções e itens)

```json
{
  "id": "uuid",
  "module": "QUALIDADE",
  "name": "Checklist Qualidade",
  "description": "string",
  "sectorId": "uuid",
  "sector": {
    "id": "uuid",
    "name": "ESGOTO",
    "active": true
  },
  "active": true,
  "sections": [
    {
      "id": "uuid",
      "checklistId": "uuid",
      "name": "Seção 1",
      "order": 1,
      "active": true
    }
  ],
  "items": [
    {
      "id": "uuid",
      "checklistId": "uuid",
      "sectionId": "uuid",
      "title": "Item 1",
      "description": "string",
      "order": 1,
      "requiresPhotoOnNonConformity": true,
      "active": true
    }
  ],
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### ServiceOrder

```json
{
  "id": "uuid",
  "osNumber": "OS-001",
  "contractId": "uuid",
  "contract": {
    "id": "uuid",
    "name": "CONTRATO_NORTE"
  },
  "address": "Rua Exemplo, 123",
  "field": false,
  "remote": false,
  "postWork": false,
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### Inspection

```json
{
  "id": "uuid",
  "externalId": "uuid",
  "module": "QUALIDADE",
  "checklistId": "uuid",
  "teamId": "uuid",
  "serviceOrderId": "uuid",
  "serviceOrder": {
    "id": "uuid",
    "osNumber": "OS-001",
    "address": "Rua Exemplo, 123"
  },
  "serviceDescription": "string",
  "locationDescription": "string",
  "status": "RASCUNHO",
  "scorePercent": 95.5,
  "hasParalysisPenalty": true,
  "paralyzedReason": "Chuva intensa",
  "paralyzedAt": "2026-02-19T12:00:00.000Z",
  "paralyzedByUserId": "uuid",
  "createdByUserId": "uuid",
  "createdOffline": false,
  "syncedAt": "2026-02-19T12:00:00.000Z",
  "finalizedAt": "2026-02-19T12:00:00.000Z",
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z",
  "team": { "id": "uuid", "name": "Equipe A" },
  "checklist": { "id": "uuid", "name": "Checklist X" },
  "createdBy": { "id": "uuid", "name": "Fiscal", "role": "FISCAL" },
  "collaborators": [],
  "items": [],
  "evidences": [],
  "signatures": [],
  "pendingAdjustments": []
}
```

### InspectionItem

```json
{
  "id": "uuid",
  "inspectionId": "uuid",
  "checklistItemId": "uuid",
  "answer": "NAO_CONFORME",
  "notes": "string",
  "resolvedAt": "2026-02-19T12:00:00.000Z",
  "resolvedByUserId": "uuid",
  "resolutionNotes": "string",
  "resolutionEvidencePath": "https://...",
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### Evidence

```json
{
  "id": "uuid",
  "inspectionId": "uuid",
  "inspectionItemId": "uuid",
  "filePath": "https://...",
  "fileName": "foto.jpg",
  "mimeType": "image/jpeg",
  "size": 12345,
  "cloudinaryPublicId": "quality/evidences/abc123",
  "url": "https://...",
  "bytes": 12345,
  "format": "jpg",
  "width": 1200,
  "height": 800,
  "uploadedByUserId": "uuid",
  "createdAt": "2026-02-19T12:00:00.000Z"
}
```

### Signature

```json
{
  "id": "uuid",
  "inspectionId": "uuid",
  "signerName": "Nome",
  "signerRoleLabel": "Lider/Encarregado",
  "imagePath": "https://...",
  "cloudinaryPublicId": "quality/signatures/abc123",
  "url": "https://...",
  "signedAt": "2026-02-19T12:00:00.000Z"
}
```

### PendingAdjustment

```json
{
  "id": "uuid",
  "inspectionId": "uuid",
  "status": "PENDENTE",
  "resolvedAt": "2026-02-19T12:00:00.000Z",
  "resolvedByUserId": "uuid",
  "resolutionNotes": "string",
  "resolutionEvidencePath": "https://...",
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

## Endpoints

## Auth

### POST /auth/login

- Auth: pública

Request JSON:

```json
{
  "email": "fiscal@sanorte.com",
  "password": "senha123"
}
```

Response 200:

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "uuid",
    "name": "Fiscal",
    "email": "fiscal@sanorte.com",
    "role": "FISCAL",
    "contracts": [
      { "id": "uuid", "name": "CONTRATO_NORTE" }
    ]
  }
}
```

Erros:

- `401`: `Credenciais inválidas`

### GET /auth/me

- Auth: JWT

Response 200:

```json
{
  "id": "uuid",
  "name": "Fiscal",
  "email": "fiscal@sanorte.com",
  "role": "FISCAL",
  "contracts": [
    { "id": "uuid", "name": "CONTRATO_NORTE" }
  ]
}
```

## Users (ADMIN)

### GET /users

- Auth: JWT + ADMIN
- Query: `page`, `limit`
- Response: paginação de `User` (sem `passwordHash`)

### POST /users

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "name": "Novo Usuário",
  "email": "novo@sanorte.com",
  "password": "senha123",
  "role": "GESTOR",
  "contractIds": ["uuid-contrato-1"]
}
```

Response 201:

```json
{
  "id": "uuid",
  "name": "Novo Usuário",
  "email": "novo@sanorte.com",
  "passwordHash": "$2b$10...",
  "role": "GESTOR",
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### PUT /users/:id

- Auth: JWT + ADMIN

Request JSON (parcial, `contractIds` obrigatório):

```json
{
  "name": "Nome Atualizado",
  "role": "ADMIN",
  "contractIds": ["uuid-contrato-1", "uuid-contrato-2"]
}
```

Response 200:

```json
{
  "id": "uuid",
  "name": "Nome Atualizado",
  "email": "novo@sanorte.com",
  "role": "ADMIN",
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### DELETE /users/:id

- Auth: JWT + ADMIN
- Response 200: vazio

### PUT /users/:id/contracts

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "contractIds": ["uuid-contrato-1", "uuid-contrato-2"]
}
```

Response 200: `User` atualizado com novos vínculos de contrato

## Contracts (ADMIN)

### GET /contracts

- Auth: JWT + ADMIN
- Query: `page`, `limit`
- Response: paginação de contratos

### GET /contracts/:id

- Auth: JWT + ADMIN
- Response 200: contrato

### POST /contracts

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "name": "CONTRATO_NORTE"
}
```

Response 201: contrato criado

### PUT /contracts/:id

- Auth: JWT + ADMIN
- Request JSON parcial:

```json
{
  "name": "CONTRATO_NORTE_ATUALIZADO"
}
```

### DELETE /contracts/:id

- Auth: JWT + ADMIN
- Response 200: vazio

## Teams

### GET /teams

- Auth: JWT
- Query: `page`, `limit`
- Response: paginação de `Team` com `collaborators` e `contracts`
- Escopo: `GESTOR`/`FISCAL` enxergam apenas equipes vinculadas aos contratos permitidos

### POST /teams

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "name": "Equipe Norte",
  "active": true,
  "collaboratorIds": ["uuid-1", "uuid-2"],
  "contractIds": ["uuid-contrato-1"]
}
```

Response 201:

```json
{
  "id": "uuid",
  "name": "Equipe Norte",
  "active": true,
  "contracts": [{ "id": "uuid-contrato-1", "name": "CONTRATO_NORTE" }],
  "collaborators": [
    { "id": "uuid-1", "name": "Colab 1", "active": true },
    { "id": "uuid-2", "name": "Colab 2", "active": true }
  ],
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### PUT /teams/:id

- Auth: JWT + ADMIN

Request JSON (parcial, `contractIds` obrigatório):

```json
{
  "name": "Equipe Norte Atualizada",
  "collaboratorIds": ["uuid-3"],
  "contractIds": ["uuid-contrato-2"]
}
```

Response 200: `Team` atualizado

### DELETE /teams/:id

- Auth: JWT + ADMIN
- Response 200: vazio

## Sectors

### GET /sectors

- Auth: JWT
- Query: `page`, `limit`
- Response: paginação de `Sector`

### GET /sectors/:id

- Auth: JWT
- Response 200: `Sector`

### POST /sectors

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "name": "ESGOTO",
  "active": true
}
```

Response 201:

```json
{
  "id": "uuid",
  "name": "ESGOTO",
  "active": true,
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### PUT /sectors/:id

- Auth: JWT + ADMIN

Request JSON (parcial):

```json
{
  "name": "NOVO_SETOR",
  "active": true
}
```

Response 200: `Sector` atualizado

### DELETE /sectors/:id

- Auth: JWT + ADMIN
- Response 200: vazio
- Regra: retorna `400` se o setor estiver vinculado a colaboradores ou checklists

## Collaborators

### GET /collaborators

- Auth: JWT
- Query: `page`, `limit`, `name` (busca parcial), `sectorId`
- Response: paginação de `Collaborator` com relação `sector`

### POST /collaborators

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "name": "Novo Colaborador",
  "sectorId": "uuid",
  "active": true
}
```

Response 201:

```json
{
  "id": "uuid",
  "name": "Novo Colaborador",
  "sectorId": "uuid",
  "sector": {
    "id": "uuid",
    "name": "ESGOTO",
    "active": true
  },
  "active": true,
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### PUT /collaborators/:id

- Auth: JWT + ADMIN

Request JSON (parcial):

```json
{
  "name": "Nome Atualizado",
  "sectorId": "uuid",
  "active": false
}
```

Response 200: `Collaborator` atualizado

### DELETE /collaborators/:id

- Auth: JWT + ADMIN
- Response 200: vazio

## Checklists

### GET /checklists

- Auth: JWT
- Query:
  - `module` (enum `ModuleType`)
  - `inspectionScope` (`TEAM` | `COLLABORATOR`)
  - `active` (`true`/`false`)
  - `sectorId` (UUID)
  - `page`, `limit`
- Response: paginação de `Checklist` com `sector`, `sections` e `items`

### GET /checklists/:id

- Auth: JWT
- Response 200: `Checklist` completo com relação `sector`

### POST /checklists

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "module": "QUALIDADE",
  "inspectionScope": "TEAM",
  "name": "Checklist de Qualidade",
  "description": "Checklist padrão",
  "sectorId": "uuid",
  "active": true
}
```

Response 201: `Checklist` criado (com seção padrão)

### PUT /checklists/:id

- Auth: JWT + ADMIN

Request JSON (parcial):

```json
{
  "name": "Checklist Atualizado",
  "sectorId": "uuid",
  "active": false
}
```

Response 200: `Checklist` atualizado

### DELETE /checklists/:id

- Auth: JWT + ADMIN
- Response 200: vazio
- Regra: retorna `400` se houver vistorias vinculadas

### POST /checklists/:id/sections

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "name": "Seção de Segurança",
  "order": 2,
  "active": true
}
```

Response 201:

```json
{
  "id": "uuid",
  "checklistId": "uuid",
  "name": "Seção de Segurança",
  "order": 2,
  "active": true,
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### PUT /checklists/:id/sections/:sectionId

- Auth: JWT + ADMIN

Request JSON (parcial):

```json
{
  "name": "Seção Atualizada",
  "order": 3,
  "active": true
}
```

Response 200: `ChecklistSection` atualizado

### POST /checklists/:id/items

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "title": "Uso de EPI",
  "description": "Verificar uso correto",
  "order": 1,
  "sectionId": "uuid",
  "requiresPhotoOnNonConformity": true,
  "active": true
}
```

Response 201:

```json
{
  "id": "uuid",
  "checklistId": "uuid",
  "sectionId": "uuid",
  "title": "Uso de EPI",
  "description": "Verificar uso correto",
  "order": 1,
  "requiresPhotoOnNonConformity": true,
  "active": true
}
```

### PUT /checklists/:id/items/:itemId

- Auth: JWT + ADMIN

Request JSON (parcial):

```json
{
  "title": "Uso de EPI atualizado",
  "requiresPhotoOnNonConformity": false
}
```

Response 200: `ChecklistItem` atualizado

### DELETE /checklists/:id/items/:itemId

- Auth: JWT + ADMIN
- Response 200: vazio

## Service Orders (Ordens de Serviço)

### GET /service-orders

- Auth: JWT + FISCAL ou GESTOR ou ADMIN
- Query:
  - `page`, `limit` (paginação padrão)
  - `osNumber` (opcional; busca parcial por número da OS)
  - `sectorId` (opcional; UUID do setor)
  - `field` (opcional; `true` ou `false` — filtra OS já usadas em vistoria CAMPO)
  - `remote` (opcional; `true` ou `false` — filtra OS já usadas em vistoria REMOTO)
  - `postWork` (opcional; `true` ou `false` — filtra OS já usadas em vistoria POS_OBRA)
- Response 200: paginação de `ServiceOrder` com relação `sector`, ordenados por `osNumber`
- Uso: listar OS disponíveis para vincular a novas vistorias; filtrar por uso por módulo (field/remote/postWork)
- Escopo: `GESTOR`/`FISCAL` veem apenas OS dos contratos permitidos (`serviceOrder.contractId`)

### POST /service-orders/import

- Auth: JWT + ADMIN ou GESTOR
- Body: multipart/form-data com campos:
  - `file` (arquivo Excel `.xlsx` ou `.xls`, até 5MB)
  - `contractId` (UUID, obrigatório)
- Estrutura do Excel: colunas "Numero da OS" e "Endereço"
- Regra: uma importação aplica apenas 1 contrato (o `contractId` informado) para todas as OS processadas
- Regra: `osNumber` é único por setor; duplicatas são ignoradas (não trava o processamento)
- Campos adicionais em cada registro: `field`, `remote`, `postWork` (boolean, default `false`)
- Regra de escopo: `GESTOR` só pode importar para contratos aos quais já está vinculado

Response 200:

```json
{
  "inserted": 10,
  "skipped": 2,
  "deleted": 1,
  "errors": []
}
```

## Inspections

### POST /inspections

- Auth: JWT + FISCAL ou GESTOR
- Regras:
  - `serviceOrderId` é obrigatório para módulos diferentes de `SEGURANCA_TRABALHO`.
  - para `SEGURANCA_TRABALHO`, `serviceOrderId` é opcional.
  - `teamId` é obrigatório para módulos diferentes de `SEGURANCA_TRABALHO`.
  - para `SEGURANCA_TRABALHO`, `teamId` é opcional.
  - `inspectionScope` aceita `TEAM` (padrão) e `COLLABORATOR`.
  - quando `module = SEGURANCA_TRABALHO` e `inspectionScope = COLLABORATOR`, deve ser enviado exatamente 1 colaborador em `collaboratorIds`, com cadastro existente na plataforma.

Request JSON:

```json
{
  "module": "SEGURANCA_TRABALHO",
  "inspectionScope": "COLLABORATOR",
  "checklistId": "uuid",
  "serviceDescription": "Inspeção semanal",
  "locationDescription": "Canteiro principal",
  "collaboratorIds": ["uuid-1"],
  "externalId": "uuid",
  "createdOffline": true,
  "syncedAt": "2026-02-19T12:00:00.000Z"
}
```

Response 201: `Inspection` completo (já com `items` baseados no checklist)

### GET /inspections

- Auth: JWT + GESTOR ou ADMIN
- Query:
  - `periodFrom` (`YYYY-MM-DD`)
  - `periodTo` (`YYYY-MM-DD`)
  - `module`
  - `inspectionScope` (`TEAM` | `COLLABORATOR`)
  - `teamId`
  - `status`
  - `osNumber` (busca parcial por número da OS; ex.: `?osNumber=OS-001`)
  - `page`, `limit`
- Response: paginação de `Inspection` com relação `serviceOrder`
- Regra: esta listagem não retorna vistorias com status `RASCUNHO`
- Regra: se `status=RASCUNHO` for informado, o retorno é vazio (`data: []`)
- Escopo: `GESTOR` vê apenas vistorias de OS vinculadas aos seus contratos

### GET /inspections/mine

- Auth: JWT + FISCAL
- Query: `page`, `limit`, `osNumber` (busca parcial por número da OS), `inspectionScope`
- Response: paginação de `Inspection` do usuário logado com relação `serviceOrder`
- Escopo: além de `createdByUserId`, aplica contrato permitido da OS

### GET /inspections/:id

- Auth: JWT
- `:id` aceita `id` ou `externalId`
- Response 200: `Inspection` completo com relações

### PUT /inspections/:id

- Auth: JWT
- Regra:
  - FISCAL só atualiza se `status = RASCUNHO`
  - GESTOR/ADMIN podem atualizar sempre

Request JSON (parcial):

```json
{
  "serviceDescription": "Descrição atualizada",
  "locationDescription": "Nova localização"
}
```

Response 200: `Inspection` atualizado

### PUT /inspections/:id/items

- Auth: JWT + FISCAL ou GESTOR ou ADMIN
- Regra:
  - FISCAL só atualiza itens se `status = RASCUNHO`
  - GESTOR/ADMIN podem atualizar itens em qualquer status
  - A nota (`scorePercent`) é recalculada automaticamente a cada atualização de itens
  - Se `hasParalysisPenalty = true`, a nota final recebe penalidade persistente de 25%
  - Para GESTOR/ADMIN, se a vistoria estiver em `FINALIZADA` ou `PENDENTE_AJUSTE`, o status é reavaliado automaticamente (`FINALIZADA ↔ PENDENTE_AJUSTE`) com base nos itens
  - Exceção: para `module = SEGURANCA_TRABALHO`, a reavaliação mantém `status = FINALIZADA` (sem `PENDENTE_AJUSTE`)

Request JSON:

```json
[
  {
    "inspectionItemId": "uuid",
    "answer": "CONFORME",
    "notes": "ok"
  },
  {
    "inspectionItemId": "uuid-2",
    "answer": "NAO_CONFORME",
    "notes": "ajustar sinalização"
  }
]
```

Response 200:

```json
[
  {
    "id": "uuid",
    "inspectionId": "uuid",
    "checklistItemId": "uuid",
    "answer": "CONFORME",
    "notes": "ok",
    "createdAt": "2026-02-19T12:00:00.000Z",
    "updatedAt": "2026-02-19T12:05:00.000Z"
  }
]
```

### POST /inspections/:id/evidences

- Auth: JWT + FISCAL ou GESTOR ou ADMIN
- Body JSON: não se aplica (multipart/form-data com campo `file`; opcional `inspectionItemId`)
- Regra:
  - FISCAL só adiciona evidência se `status = RASCUNHO`
  - GESTOR/ADMIN podem adicionar evidência em qualquer status

Response 201:

```json
{
  "id": "uuid",
  "inspectionId": "uuid",
  "inspectionItemId": "uuid",
  "filePath": "https://res.cloudinary.com/.../image/upload/...jpg",
  "fileName": "evidencia.jpg",
  "mimeType": "image/jpeg",
  "size": 120031,
  "cloudinaryPublicId": "quality/evidences/abc123",
  "url": "https://res.cloudinary.com/.../image/upload/...jpg",
  "bytes": 120031,
  "format": "jpg",
  "width": 1920,
  "height": 1080,
  "uploadedByUserId": "uuid",
  "createdAt": "2026-02-19T12:00:00.000Z"
}
```

### POST /inspections/:id/signature

- Auth: JWT
- Regra: apenas vistoria em `RASCUNHO`

Request JSON:

```json
{
  "signerName": "João da Silva",
  "imageBase64": "data:image/png;base64,iVBORw0KGgo..."
}
```

Response 201:

```json
{
  "id": "uuid",
  "inspectionId": "uuid",
  "signerName": "João da Silva",
  "signerRoleLabel": "Lider/Encarregado",
  "imagePath": "https://res.cloudinary.com/.../image/upload/...png",
  "cloudinaryPublicId": "quality/signatures/abc123",
  "url": "https://res.cloudinary.com/.../image/upload/...png",
  "signedAt": "2026-02-19T12:00:00.000Z"
}
```

### POST /inspections/:id/finalize

- Auth: JWT + FISCAL ou GESTOR
- Request JSON: sem body

Response 200: `Inspection` finalizada

Regras:

- Assinatura do líder/encarregado é opcional.
- Item `NAO_CONFORME` com `requiresPhotoOnNonConformity = true` exige evidência.
- Calcula `scorePercent` (com penalidade de 25% quando `hasParalysisPenalty = true`).
- Se `module = SEGURANCA_TRABALHO`: status `FINALIZADA` (mesmo com `NAO_CONFORME`) e sem criação de pendência de ajuste.
- Nos demais módulos:
  - Se houver `NAO_CONFORME`: status `PENDENTE_AJUSTE` e pendência `PENDENTE`.
  - Se não houver `NAO_CONFORME`: status `FINALIZADA`.

### POST /inspections/:id/paralyze

- Auth: JWT + FISCAL ou GESTOR ou ADMIN
- Regra:
  - `reason` é obrigatório.
  - Define `hasParalysisPenalty = true` (persistente).
  - Recalcula `scorePercent` com penalidade de 25%.
  - Chamada é idempotente: se já tiver penalidade ativa, retorna sem alterar estado.

Request JSON:

```json
{
  "reason": "Chuva intensa e risco operacional"
}
```

Response 200: `Inspection` atualizado

### POST /inspections/:id/unparalyze

- Auth: JWT + GESTOR ou ADMIN
- Regra:
  - Remove penalidade de paralisação (`hasParalysisPenalty = false`).
  - Limpa `paralyzedReason`, `paralyzedAt`, `paralyzedByUserId`.
  - Recalcula `scorePercent` sem penalidade.
  - Chamada é idempotente: se não tiver penalidade ativa, retorna sem alterar estado.

Request JSON: sem body

Response 200: `Inspection` atualizado

### POST /inspections/:id/items/:itemId/resolve

- Auth: JWT + FISCAL ou GESTOR ou ADMIN
- Regra: vistoria deve estar em `PENDENTE_AJUSTE`

Request JSON:

```json
{
  "resolutionNotes": "Item corrigido em campo",
  "resolutionEvidence": "https://res.cloudinary.com/.../image/upload/...jpg"
}
```

Observação:

- `resolutionEvidence` é opcional.
- Pode ser URL (`http/https`) ou base64 (faz upload e salva URL).

Response 200:

```json
{
  "id": "uuid",
  "inspectionId": "uuid",
  "checklistItemId": "uuid",
  "answer": "NAO_CONFORME",
  "notes": "pendente",
  "resolvedAt": "2026-02-19T13:00:00.000Z",
  "resolvedByUserId": "uuid",
  "resolutionNotes": "Item corrigido em campo",
  "resolutionEvidencePath": "https://res.cloudinary.com/.../image/upload/...jpg",
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T13:00:00.000Z"
}
```

### POST /inspections/:id/resolve

- Auth: JWT + FISCAL ou GESTOR ou ADMIN
- Regra: só permite quando todos os itens `NAO_CONFORME` já tiverem `resolvedAt`

Request JSON:

```json
{
  "resolutionNotes": "Pendência encerrada",
  "resolutionEvidence": "https://res.cloudinary.com/.../image/upload/...jpg"
}
```

Response 200: `Inspection` com `status = RESOLVIDA`

## Sync

### POST /sync/inspections

- Auth: JWT + FISCAL ou GESTOR ou ADMIN
- Processamento em lote, idempotente por `externalId`

Request JSON:

```json
{
  "inspections": [
    {
      "externalId": "uuid",
      "module": "SEGURANCA_TRABALHO",
      "inspectionScope": "COLLABORATOR",
      "checklistId": "uuid",
      "serviceDescription": "Vistoria offline",
      "locationDescription": "Frente A",
      "collaboratorIds": ["uuid-1"],
      "createdOffline": true,
      "syncedAt": "2026-02-19T12:00:00.000Z",
      "paralyze": {
        "reason": "Paralisada por chuva intensa"
      },
      "finalize": true,
      "items": [
        {
          "checklistItemId": "uuid-item",
          "answer": "CONFORME",
          "notes": "ok"
        }
      ],
      "evidences": [
        {
          "checklistItemId": "uuid-item",
          "cloudinaryPublicId": "quality/evidences/abc123",
          "url": "https://res.cloudinary.com/.../image/upload/...jpg",
          "bytes": 12345,
          "format": "jpg",
          "width": 1200,
          "height": 800,
          "fileName": "evidencia.jpg",
          "mimeType": "image/jpeg",
          "size": 12345
        }
      ],
      "signature": {
        "signerName": "Lider 1",
        "signerRoleLabel": "Lider/Encarregado",
        "cloudinaryPublicId": "quality/signatures/abc123",
        "url": "https://res.cloudinary.com/.../image/upload/...png",
        "signedAt": "2026-02-19T12:00:00.000Z"
      }
    }
  ]
}
```

Response 200:

```json
{
  "results": [
    {
      "externalId": "uuid",
      "serverId": "uuid-servidor",
      "status": "CREATED"
    },
    {
      "externalId": "uuid-2",
      "status": "ERROR",
      "message": "Erro ao sincronizar vistoria"
    }
  ]
}
```

Regras importantes:

- `externalId` é obrigatório.
- `serviceOrderId` é obrigatório para criar nova vistoria quando `module != SEGURANCA_TRABALHO` (OS deve estar cadastrada via `POST /service-orders/import`).
- `teamId` é obrigatório para criar nova vistoria quando `module != SEGURANCA_TRABALHO`.
- `inspectionScope` aceita `TEAM` (padrão) e `COLLABORATOR`.
- Para `module = SEGURANCA_TRABALHO` e `inspectionScope = COLLABORATOR`, enviar exatamente 1 colaborador em `collaboratorIds`, com cadastro existente na plataforma.
- Não aceita assets em `dataUrl`/`imageBase64` no sync.
- Para evidências e assinatura, use `url` e/ou `cloudinaryPublicId`.
- `paralyze.reason` (quando enviado) marca penalidade persistente de paralisação na vistoria.
- Se `finalize = true`, aplica as regras de finalização.

## Uploads

### POST /uploads

- Auth: JWT
- Request JSON: não se aplica (multipart/form-data com `file` e opcional `folder`)

Response 201:

```json
{
  "publicId": "quality/evidences/abc123",
  "url": "https://res.cloudinary.com/.../image/upload/...jpg",
  "resourceType": "image",
  "bytes": 120031,
  "format": "jpg",
  "width": 1920,
  "height": 1080
}
```

### DELETE /uploads/:publicId

- Auth: JWT
- Request JSON: não se aplica

Response 200:

```json
{
  "ok": true
}
```

## Dashboards

### GET /dashboards/summary

- Auth: JWT
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `module` (`ModuleType`) opcional
  - `teamId` (`uuid`) opcional
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

Response 200:

```json
{
  "averagePercent": 92.45,
  "inspectionsCount": 34,
  "pendingCount": 5
}
```

### GET /dashboards/ranking/teams

- Auth: JWT
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `module` (`ModuleType`) opcional
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

Response 200:

```json
[
  {
    "teamId": "uuid",
    "teamName": "Equipe Norte",
    "averagePercent": 95.1,
    "inspectionsCount": 12,
    "pendingCount": 2,
    "paralyzedCount": 1,
    "paralysisRatePercent": 8.33
  },
  {
    "teamId": "uuid-2",
    "teamName": "Equipe Sul",
    "averagePercent": 90.2,
    "inspectionsCount": 10,
    "pendingCount": 1,
    "paralyzedCount": 0,
    "paralysisRatePercent": 0
  }
]
```

- `paralyzedCount`: quantidade de vistorias com penalidade de paralisação no período.
- `paralysisRatePercent`: percentual de vistorias paralisadas (paralyzedCount / inspectionsCount).

### GET /dashboards/teams/:teamId

- Auth: JWT
- Path: `teamId` (uuid da equipe).
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `module` (`ModuleType`) opcional
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

Retorna métricas de desempenho de uma equipe específica no período e módulo (mesmos filtros do summary/ranking). Útil para tela de detalhe da equipe ou relatório.

Response 200:

```json
{
  "teamId": "uuid",
  "teamName": "Equipe Norte",
  "averagePercent": 95.1,
  "inspectionsCount": 12,
  "pendingCount": 2,
  "paralyzedCount": 1,
  "paralysisRatePercent": 8.33
}
```

Response 404 quando a equipe não existe:

```json
{
  "statusCode": 404,
  "message": "Equipe não encontrada",
  "error": "Not Found"
}
```

### GET /dashboards/quality-by-service

- Auth: JWT
- Perfis permitidos: `ADMIN`, `GESTOR`
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `module` (`ModuleType`) opcional
  - `teamId` (`uuid`) opcional
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.
- Timezone da agregação mensal: `America/Sao_Paulo`.
- Status considerados no cálculo de qualidade:
  - `FINALIZADA`
  - `PENDENTE_AJUSTE`
  - `RESOLVIDA`
- Observação: para `SEGURANCA_TRABALHO`, o fluxo não utiliza `PENDENTE_AJUSTE`.
- `qualityPercent` é `AVG(scorePercent)` no agrupamento mês + serviço.
- `growthPercent` é a variação percentual do último mês do período versus o mês anterior.

Response 200:

```json
{
  "period": ["2025-08", "2025-09", "2025-10", "2025-11"],
  "services": [
    {
      "serviceKey": "esgoto",
      "serviceLabel": "ESGOTO",
      "series": [
        { "month": "2025-08", "qualityPercent": 20, "inspectionsCount": 120 },
        { "month": "2025-09", "qualityPercent": 25.6, "inspectionsCount": 134 },
        { "month": "2025-10", "qualityPercent": 34.9, "inspectionsCount": 141 },
        { "month": "2025-11", "qualityPercent": 57.9, "inspectionsCount": 158 }
      ],
      "growth": {
        "fromMonth": "2025-10",
        "toMonth": "2025-11",
        "growthPercent": 65.9,
        "deltaPoints": 23
      }
    }
  ]
}
```

### GET /dashboards/current-month-by-service

- Auth: JWT
- Perfis permitidos: `ADMIN`, `GESTOR`
- Query:
  - `month` (`YYYY-MM`) opcional (default = mês atual em `America/Sao_Paulo`)
  - `module` (`ModuleType`) opcional
  - `teamId` (`uuid`) opcional
- Status considerados no cálculo de qualidade:
  - `FINALIZADA`
  - `PENDENTE_AJUSTE`
  - `RESOLVIDA`
- `pendingAdjustmentsCount` contabiliza inspeções do mês com status `PENDENTE_AJUSTE`.
- Observação: para `SEGURANCA_TRABALHO`, `pendingAdjustmentsCount` tende a 0, pois não há transição para `PENDENTE_AJUSTE`.
- `qualityPercent` por serviço é `AVG(scorePercent)` no mês.
- Escopo: `GESTOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

Response 200:

```json
{
  "month": "2025-12",
  "summary": {
    "averagePercent": 71.1,
    "inspectionsCount": 1547,
    "pendingAdjustmentsCount": 65
  },
  "services": [
    {
      "serviceKey": "cavalete_hm",
      "serviceLabel": "CAVALETE / HM",
      "qualityPercent": 83.1,
      "inspectionsCount": 328
    }
  ]
}
```

## Permissões por role

### FISCAL

- Criar vistoria (exige `serviceOrderId` de OS cadastrada)
- Editar vistoria apenas em `RASCUNHO`
- Paralisar vistoria
- Finalizar vistoria
- Resolver itens não conformes e pendências
- Listar apenas as próprias vistorias (`/inspections/mine`)
- Todos os dados listados são restringidos aos contratos vinculados ao usuário

### GESTOR

- Criar/editar/finalizar vistorias (exige `serviceOrderId` ao criar)
- Importar OS via Excel (`POST /service-orders/import`)
- Paralisar e remover penalidade de paralisação (unparalyze)
- Resolver itens não conformes e pendências
- Acessar listagem geral de vistorias
- Dados operacionais e dashboards limitados aos contratos vinculados ao usuário

### ADMIN

- Todas as permissões operacionais do GESTOR
- Importar OS via Excel (`POST /service-orders/import`)
- CRUD de usuários, contratos/cidades, equipes, colaboradores e checklists

## Erros comuns

Formato padrão:

```json
{
  "statusCode": 400,
  "message": "Mensagem de erro",
  "error": "Bad Request"
}
```

Mensagens relevantes do domínio:

- `serviceOrderId é obrigatório. Informe o ID de uma OS cadastrada na tabela de ordens de serviço.`
- `Ordem de serviço não encontrada. Cadastre a OS via importação de Excel antes de criar a vistoria.`
- `serviceOrderId é obrigatório para criar nova vistoria. Cadastre a OS via importação de Excel antes de sincronizar.`
- `contractIds é obrigatório`
- `Um ou mais contratos não foram encontrados`
- `contractId é obrigatório na importação`
- `Contrato informado não encontrado`
- `Você não tem acesso ao contrato selecionado para importação.`
- `Você não tem acesso ao contrato desta ordem de serviço.`
- `Vistoria de Segurança do Trabalho por colaborador exige exatamente 1 colaborador.`
- `Todos os colaboradores informados devem existir na plataforma.`
- `Vistoria não encontrada`
- `Fiscal não pode editar vistoria após finalização`
- `reason should not be empty`
- `Não é possível adicionar assinatura em vistoria finalizada`
- `Vistoria já foi finalizada`
- `Item "<titulo>" requer foto de evidência quando não conforme`
- `Vistoria não está pendente de ajuste`
- `Apenas itens em não conformidade podem ser resolvidos`
- `Resolva todos os itens não conformes antes de resolver a vistoria. Use POST /inspections/:id/items/:itemId/resolve para cada item.`
- `Assets must be uploaded before sync`
