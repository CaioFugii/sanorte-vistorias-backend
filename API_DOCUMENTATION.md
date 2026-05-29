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
- Checklists (com seções/itens): `GET/POST/PUT/DELETE /checklists` + rotas de `sections`, `items` e upload de imagem de referência
- Ordens de Serviço (OS): `GET /service-orders`, `POST /service-orders/import`
- Vistorias:
  - criação/lista/detalhe: `POST /inspections`, `GET /inspections`, `GET /inspections/mine`, `GET /inspections/:id`
  - edição: `PUT /inspections/:id`, `PUT /inspections/:id/items`
  - anexos e assinatura: `POST /inspections/:id/evidences`, `DELETE /inspections/:id/evidences/:evidenceId`, `POST /inspections/:id/signature`
  - transições: `POST /inspections/:id/paralyze`, `POST /inspections/:id/finalize`, `POST /inspections/:id/items/:itemId/resolve`, `POST /inspections/:id/resolve`
- Relatórios dinâmicos:
  - tipos e schema: `GET /reports/types`, `GET /reports/types/:code/fields`
  - consulta de formulário para renderização no frontend (sem persistência)
- Sync offline: `POST /sync/inspections`
- Upload genérico: `POST /uploads`, `DELETE /uploads/:publicId`
- Dashboards: `GET /dashboards/summary`, `GET /dashboards/quality/summary`, `GET /dashboards/safety-work/summary`, `GET /dashboards/ranking/teams`, `GET /dashboards/ranking/teams/safety-work`, `GET /dashboards/teams/:teamId`, `GET /dashboards/quality-by-service`, `GET /dashboards/current-month-by-service`, `GET /dashboards/safety-work/low-score-collaborators`, `GET /dashboards/team-performance-by-teams`, `GET /dashboards/non-conformities/by-checklist`, `GET /dashboards/non-conformities/by-team` (inclui aliases `quality/*` e `safety-work/*`; ver `Dashboards`)

### Regras críticas que impactam UI

- Nova vistoria (`POST /inspections` e sync):
  - `serviceOrderId` é obrigatório para módulos diferentes de `SEGURANCA_TRABALHO` e `OBRAS_INVESTIMENTO`.
  - para `SEGURANCA_TRABALHO` e `OBRAS_INVESTIMENTO`, `serviceOrderId` é opcional.
  - quando `serviceOrderId` não for enviado, `contractId` é obrigatório.
  - quando `serviceOrderId` for enviado, o backend ignora `contractId` do payload e usa o contrato da OS.
  - quando `module = OBRAS_INVESTIMENTO` e `serviceOrderId` não for enviado, `investmentWorkId` passa a ser obrigatório.
  - `teamId` é obrigatório para módulos diferentes de `SEGURANCA_TRABALHO`.
  - para `SEGURANCA_TRABALHO`, `teamId` é opcional.
- `GET /inspections` (GESTOR/SUPERVISOR/ADMIN) não retorna `RASCUNHO`.
- `GET /inspections/mine` é a listagem do FISCAL (onde rascunho aparece).
- Escopo por contrato:
  - `ADMIN` vê todos os dados.
  - `GESTOR`, `SUPERVISOR` e `FISCAL` veem apenas dados dentro dos contratos vinculados ao usuário.
  - O filtro é aplicado nas listagens principais (`service-orders`, `inspections`, `dashboards`, `teams`).
  - Nos **dashboards** (`GET /dashboards/*`), é possível restringir explicitamente a um contrato com o query param opcional `contractId` (UUID). Para `GESTOR`/`SUPERVISOR`, o resultado continua limitado à interseção com os contratos do usuário; para `ADMIN`, filtra apenas por esse contrato quando informado.
- Usuários:
  - `POST /users` exige `contractIds`.
  - `PUT /users/:id` exige `contractIds`.
- Equipes:
  - `POST /teams` exige `contractIds`.
  - `PUT /teams/:id` exige `contractIds`.
- Colaboradores:
  - `POST /collaborators` e `PUT /collaborators/:id` aceitam `contractId` (UUID) para vínculo direto com contrato.
  - quando `contractId` é informado, o contrato deve existir.
- Importação de OS (`POST /service-orders/import`):
  - exige `contractId` no form-data.
  - uma execução de importação aplica exatamente 1 contrato para todas as OS processadas.
- `PUT /inspections/:id`:
  - FISCAL só edita em `RASCUNHO`.
  - GESTOR/SUPERVISOR/ADMIN editam em qualquer status.
  - Quando `teamId` for enviado, a equipe informada deve existir; caso contrário, retorna `400` com `Equipe não encontrada`.
- `PUT /inspections/:id/items`:
  - FISCAL só em `RASCUNHO`.
  - GESTOR/SUPERVISOR/ADMIN em qualquer status.
  - Sempre recalcula `scorePercent`.
  - Para GESTOR/SUPERVISOR/ADMIN, reavalia status automaticamente (`FINALIZADA` <-> `PENDENTE_AJUSTE`) quando aplicável.
  - Exceção: para módulo `SEGURANCA_TRABALHO`, o status não vai para `PENDENTE_AJUSTE` (permanece/retorna `FINALIZADA`).
- `POST /inspections/:id/evidences` e `DELETE /inspections/:id/evidences/:evidenceId`:
  - FISCAL só em `RASCUNHO`.
  - GESTOR/SUPERVISOR/ADMIN em qualquer status.
- `POST /inspections/:id/paralyze`:
  - disponível para FISCAL/GESTOR/SUPERVISOR/ADMIN.
  - ativa penalidade persistente de 25% na nota.
- `POST /inspections/:id/unparalyze`:
  - disponível apenas para GESTOR/SUPERVISOR/ADMIN.
  - remove penalidade e recalcula nota (correção de erro).
- `POST /inspections/:id/finalize`: assinatura é opcional; para itens não conformes com obrigatoriedade, evidência é exigida.
- Relatórios dinâmicos (`/reports`):
  - backend não gera PDF; frontend gera o PDF com base nos dados estruturados retornados.
  - backend expõe apenas os endpoints de consulta do schema (`GET /reports/types` e `GET /reports/types/:code/fields`).
  - montagem, preenchimento e geração do relatório ficam no frontend.

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
  - pode voltar para `PENDENTE_AJUSTE` se GESTOR/SUPERVISOR/ADMIN alterarem itens e surgirem não conformidades.
  - Exceção: no módulo `SEGURANCA_TRABALHO`, não há transição para `PENDENTE_AJUSTE`.
- `RESOLVIDA`
  - status final após resolução de pendências.
- Paralisação é um estado paralelo:
  - `hasParalysisPenalty = true` indica que a penalidade de 25% deve ser aplicada na nota.

### Filtros disponíveis para listagens (essencial para telas)

- Paginação padrão em listas: `page`, `limit`.
- `GET /service-orders`: filtros por `osNumber` (busca parcial), `sectorId`, `field`, `remote`, `postWork` (boolean `true`/`false`; filtra OS por uso no módulo CAMPO, REMOTO ou POS_OBRA).
- `GET /collaborators`: filtros por `name` (busca parcial), `sectorId` e `contractId`.
- `GET /checklists`: filtros por `module`, `inspectionScope`, `active`, `sectorId`.
- `GET /inspections`: filtros por `periodFrom`, `periodTo`, `module`, `teamId`, `status`, `osNumber` (busca parcial por número da OS; regra de ocultar rascunho para GESTOR/SUPERVISOR/ADMIN).
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
- No sync, `serviceOrderId` é obrigatório para criar nova vistoria quando o módulo não é `SEGURANCA_TRABALHO` nem `OBRAS_INVESTIMENTO`.
- No sync, quando `serviceOrderId` não for enviado, `contractId` deve ser enviado.
- Não enviar `dataUrl` em evidências no sync (assets devem ser enviados antes).
- Se precisar aplicar penalidade de paralisação no sync, envie `paralyze.reason`.
- `GET /inspections/:id` aceita `id` do servidor **ou** `externalId`, o que simplifica reconciliação de dados locais.

### Checklist para novas funcionalidades no frontend

- Ao criar vistoria: buscar lista de OS em `GET /service-orders` e permitir seleção; quando a vistoria não tiver OS, enviar `contractId` manualmente.
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

**Uploads de imagem (multipart):** rotas que recebem `multipart/form-data` com o binário no campo `file` validam o tipo de imagem pelo **MIME declarado na parte** (ex.: `image/jpeg`, `image/png`). Ferramentas e SDKs costumam preencher isso automaticamente a partir da extensão ou do arquivo; evite enviar parte sem `Content-Type` de imagem. No servidor, o arquivo é escrito em diretório temporário (ex.: `/tmp` no Heroku) e enviado ao Cloudinary em **streaming**, o que não altera URL, método HTTP nem formato da resposta — apenas reduz uso de memória no dyno.

Header para rotas autenticadas:

```text
Authorization: Bearer <token>
Content-Type: application/json
```

## Enums

### UserRole

```json
["ADMIN", "GESTOR", "SUPERVISOR", "FISCAL"]
```

### ModuleType

```json
["OBRAS_INVESTIMENTO", "OBRAS_GLOBAL", "CANTEIRO", "QUALIDADE", "CAMPO", "SEGURANCA_TRABALHO", "REMOTO", "POS_OBRA"]
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

### InvestmentWorkStatus

```json
["EM_ANDAMENTO", "PARALISADA", "FINALIZADA", "CANCELADA"]
```

### ReportFieldType

```json
["text", "textarea", "number", "date", "datetime", "select", "radio", "checkbox", "image", "signature"]
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
  "contractId": "uuid",
  "sector": {
    "id": "uuid",
    "name": "ESGOTO",
    "active": true
  },
  "contract": {
    "id": "uuid",
    "name": "CONTRATO_NORTE"
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
      "referenceImageUrl": "https://res.cloudinary.com/.../image/upload/...jpg",
      "referenceImagePublicId": "quality/checklists/reference-images/abc123",
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

### InvestmentWork

```json
{
  "id": "uuid",
  "contractId": "uuid",
  "createdByUserId": "uuid",
  "workName": "Ampliação Rede Bairro Norte",
  "startDate": "2026-05-10",
  "expectedEndDate": "2026-08-10",
  "address": "Rua Exemplo, 123",
  "district": "Bairro Norte",
  "basin": "Bacia 01",
  "service": "Implantação de rede coletora",
  "teamId": "uuid",
  "materialNetwork": "PVC DN 150",
  "singularities": "Travessia em avenida de grande fluxo",
  "status": "EM_ANDAMENTO",
  "active": true,
  "createdAt": "2026-05-10T12:00:00.000Z",
  "updatedAt": "2026-05-10T12:00:00.000Z"
}
```

### Inspection

```json
{
  "id": "uuid",
  "externalId": "uuid",
  "module": "QUALIDADE",
  "checklistId": "uuid",
  "contractId": "uuid",
  "teamId": "uuid",
  "serviceOrderId": "uuid",
  "investmentWorkId": "uuid",
  "contract": {
    "id": "uuid",
    "name": "CONTRATO_NORTE"
  },
  "serviceOrder": {
    "id": "uuid",
    "osNumber": "OS-001",
    "address": "Rua Exemplo, 123"
  },
  "investmentWork": {
    "id": "uuid",
    "workName": "Obra X"
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
  "checklistItem": {
    "id": "uuid",
    "title": "O item se encontra parecido com a imagem referência?",
    "referenceImageUrl": "https://res.cloudinary.com/.../image/upload/...jpg",
    "referenceImagePublicId": "quality/checklists/reference-images/abc123"
  },
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

### ReportType

```json
{
  "id": "uuid",
  "code": "VISTORIA_OBRA",
  "name": "Vistoria de Obra",
  "description": "Relatório padrão para vistorias de obra.",
  "version": 1,
  "active": true,
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### ReportTypeField

```json
{
  "id": "uuid",
  "reportTypeId": "uuid",
  "fieldKey": "fotosGerais",
  "label": "Fotos Gerais",
  "type": "image",
  "required": false,
  "order": 4,
  "placeholder": null,
  "helpText": null,
  "options": null,
  "defaultValue": null,
  "multiple": true,
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z"
}
```

### ReportFile

```json
{
  "id": "uuid",
  "reportRecordId": "uuid",
  "reportTypeId": "uuid",
  "fieldKey": "fotosGerais",
  "originalName": "foto-1.jpg",
  "mimeType": "image/jpeg",
  "size": 120031,
  "url": "https://res.cloudinary.com/.../image/upload/...jpg",
  "storageProvider": "cloudinary",
  "storageKey": "quality/reports/images/abc123",
  "publicId": "quality/reports/images/abc123",
  "createdBy": "uuid",
  "createdAt": "2026-02-19T12:00:00.000Z"
}
```

### ReportRecord

```json
{
  "id": "uuid",
  "reportTypeId": "uuid",
  "userId": "uuid",
  "schemaVersion": 1,
  "formData": {
    "nomeResponsavel": "Carlos",
    "dataVistoria": "2026-04-22",
    "fotosGerais": [
      {
        "id": "uuid-file",
        "url": "https://res.cloudinary.com/.../image/upload/...jpg",
        "storageProvider": "cloudinary",
        "storageKey": "quality/reports/images/abc123",
        "publicId": "quality/reports/images/abc123",
        "originalName": "foto.jpg",
        "mimeType": "image/jpeg",
        "size": 120031
      }
    ]
  },
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z",
  "reportType": {
    "id": "uuid",
    "code": "VISTORIA_OBRA",
    "name": "Vistoria de Obra",
    "version": 1
  },
  "files": []
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
- Escopo: `GESTOR`/`SUPERVISOR`/`FISCAL` enxergam apenas equipes vinculadas aos contratos permitidos

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
- Query: `page`, `limit`, `name` (busca parcial), `sectorId`, `contractId`
- Response: paginação de `Collaborator` com relações `sector` e `contract`

### POST /collaborators

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "name": "Novo Colaborador",
  "sectorId": "uuid",
  "contractId": "uuid",
  "active": true
}
```

Response 201:

```json
{
  "id": "uuid",
  "name": "Novo Colaborador",
  "sectorId": "uuid",
  "contractId": "uuid",
  "sector": {
    "id": "uuid",
    "name": "ESGOTO",
    "active": true
  },
  "contract": {
    "id": "uuid",
    "name": "CONTRATO_NORTE"
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
  "contractId": "uuid",
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
  "referenceImageUrl": null,
  "referenceImagePublicId": null,
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

### POST /checklists/:id/items/:itemId/reference-image

- Auth: JWT + ADMIN
- Request JSON: não se aplica (multipart/form-data com campo `file`)
- Regras:
  - aceita apenas imagens cujo MIME declarado na parte `file` corresponda a `image/*`
  - tamanho máximo: 10MB
  - se já existir imagem de referência para o item, o backend remove o asset anterior antes de salvar o novo
  - validação de tipo usa o MIME da parte multipart (ver nota em **Informações gerais** → uploads de imagem)

Response 201:

```json
{
  "id": "uuid",
  "checklistId": "uuid",
  "sectionId": "uuid",
  "title": "O item se encontra parecido com a imagem referência?",
  "description": "Comparar com a foto padrão",
  "order": 1,
  "requiresPhotoOnNonConformity": true,
  "referenceImageUrl": "https://res.cloudinary.com/.../image/upload/...jpg",
  "referenceImagePublicId": "quality/checklists/reference-images/abc123",
  "active": true
}
```

### DELETE /checklists/:id/items/:itemId

- Auth: JWT + ADMIN
- Response 200: vazio

## Service Orders (Ordens de Serviço)

### GET /service-orders

- Auth: JWT + FISCAL ou GESTOR ou SUPERVISOR ou ADMIN
- Query:
  - `page`, `limit` (paginação padrão)
  - `osNumber` (opcional; busca parcial por número da OS)
  - `sectorId` (opcional; UUID do setor)
  - `field` (opcional; `true` ou `false` — filtra OS já usadas em vistoria CAMPO)
  - `remote` (opcional; `true` ou `false` — filtra OS já usadas em vistoria REMOTO)
  - `postWork` (opcional; `true` ou `false` — filtra OS já usadas em vistoria POS_OBRA)
- Response 200: paginação de `ServiceOrder` com relação `sector`, ordenados por `osNumber`
- Uso: listar OS disponíveis para vincular a novas vistorias; filtrar por uso por módulo (field/remote/postWork)
- Escopo: `GESTOR`/`SUPERVISOR`/`FISCAL` veem apenas OS dos contratos permitidos (`serviceOrder.contractId`)

### POST /service-orders/import

- Auth: JWT + ADMIN ou GESTOR ou SUPERVISOR
- Body: multipart/form-data com campos:
  - `file` (arquivo Excel `.xlsx` ou `.xls`, até 5MB)
  - `contractId` (UUID, obrigatório)
- Estrutura do Excel: colunas "Numero da OS" e "Endereço"
- Regra: uma importação aplica apenas 1 contrato (o `contractId` informado) para todas as OS processadas
- Regra: `osNumber` é único por setor; duplicatas são ignoradas (não trava o processamento)
- Campos adicionais em cada registro: `field`, `remote`, `postWork` (boolean, default `false`)
- Regra de escopo: `GESTOR`/`SUPERVISOR` só pode importar para contratos aos quais já está vinculado

Response 200:

```json
{
  "inserted": 10,
  "skipped": 2,
  "deleted": 1,
  "errors": []
}
```

## Investment Works (Obras de Investimento)

### GET /investment-works

- Auth: JWT + ADMIN ou GESTOR ou SUPERVISOR ou FISCAL
- Query:
  - `page`, `limit`
  - `status` (`EM_ANDAMENTO` | `PARALISADA` | `FINALIZADA` | `CANCELADA`)
  - `contractId` (UUID)
  - `search` (busca parcial em obra, endereço, bairro e serviço)
  - `active` (`true` | `false`)
- Response 200: paginação de `InvestmentWork` com `team` e `contract`
- Escopo: `ADMIN` vê todos; `GESTOR`/`SUPERVISOR`/`FISCAL` ficam limitados aos contratos vinculados

### GET /investment-works/:id

- Auth: JWT + ADMIN ou GESTOR ou SUPERVISOR ou FISCAL
- Response 200:
  - dados da obra (`InvestmentWork`)
  - `inspectionStats.total`
  - `inspectionStats.averageScorePercent`
  - `inspectionStats.averagePercentual`
  - `inspectionStats.lastInspections` (até 5 últimas)
  - `inspectionStats.pendingTotal`

### POST /investment-works

- Auth: JWT + ADMIN ou GESTOR ou SUPERVISOR
- Validações:
  - `workName`, `startDate`, `expectedEndDate`, `address`, `district`, `basin`, `service`, `teamId`, `materialNetwork`, `contractId` obrigatórios
  - `expectedEndDate` não pode ser menor que `startDate`
  - contrato deve existir e estar no escopo do usuário
  - equipe deve existir, estar ativa e estar vinculada ao contrato informado
- `singularities` e `status` são opcionais

### PUT /investment-works/:id

- Auth: JWT + ADMIN ou GESTOR ou SUPERVISOR
- Atualização parcial (PATCH-like por `PUT`)
- Mantém as mesmas validações de contrato, equipe e datas quando os campos relevantes forem enviados

### DELETE /investment-works/:id

- Auth: JWT + ADMIN ou GESTOR ou SUPERVISOR
- Regra: bloqueia exclusão quando houver inspeções vinculadas e retorna:

```json
{
  "statusCode": 400,
  "message": "Não é possível remover obra com inspeções vinculadas",
  "error": "Bad Request"
}
```

## Inspections

### POST /inspections

- Auth: JWT + FISCAL ou GESTOR ou SUPERVISOR
- Regras:
  - `serviceOrderId` é obrigatório para módulos diferentes de `SEGURANCA_TRABALHO` e `OBRAS_INVESTIMENTO`.
  - para `SEGURANCA_TRABALHO` e `OBRAS_INVESTIMENTO`, `serviceOrderId` é opcional.
  - quando `serviceOrderId` não for enviado, `contractId` é obrigatório.
  - quando `serviceOrderId` for enviado, o backend usa automaticamente o `contractId` da OS.
  - `teamId` é obrigatório para módulos diferentes de `SEGURANCA_TRABALHO`.
  - para `SEGURANCA_TRABALHO`, `teamId` é opcional.
  - `investmentWorkId` é opcional, mas só pode ser enviado quando `module = OBRAS_INVESTIMENTO`.
  - quando `module = OBRAS_INVESTIMENTO` e `serviceOrderId` não for enviado, `investmentWorkId` é obrigatório.
  - quando ambos forem enviados (`serviceOrderId` e `investmentWorkId`), OS e obra devem pertencer ao mesmo contrato.
  - para `investmentWorkId` informado: a obra deve existir, estar ativa, não estar cancelada e dentro do escopo de contrato do usuário.
  - `inspectionScope` aceita `TEAM` (padrão) e `COLLABORATOR`.
  - quando `module = SEGURANCA_TRABALHO` e `inspectionScope = COLLABORATOR`, deve ser enviado exatamente 1 colaborador em `collaboratorIds`, com cadastro existente na plataforma.

Request JSON:

```json
{
  "module": "SEGURANCA_TRABALHO",
  "inspectionScope": "COLLABORATOR",
  "checklistId": "uuid",
  "contractId": "uuid",
  "serviceDescription": "Inspeção semanal",
  "locationDescription": "Canteiro principal",
  "collaboratorIds": ["uuid-1"],
  "externalId": "uuid",
  "createdOffline": true,
  "syncedAt": "2026-02-19T12:00:00.000Z"
}
```

Response 201: `Inspection` completo (já com `items` baseados no checklist)

Observação importante para UI (FISCAL):

- A imagem de referência do item vem em `items[].checklistItem.referenceImageUrl`.
- O identificador do asset vem em `items[].checklistItem.referenceImagePublicId`.

### GET /inspections

- Auth: JWT + GESTOR ou SUPERVISOR ou ADMIN
- Query:
  - `periodFrom` (`YYYY-MM-DD`)
  - `periodTo` (`YYYY-MM-DD`)
  - `module`
  - `inspectionScope` (`TEAM` | `COLLABORATOR`)
  - `teamId`
  - `status`
  - `osNumber` (busca parcial por número da OS; ex.: `?osNumber=OS-001`)
  - `investmentWorkId` (UUID da obra de investimento)
  - `page`, `limit`
- Response: paginação de DTO **enxuto de listagem** (sem `items`, `checklist`, `createdBy`, `collaborators` e sem qualquer `passwordHash`)
- Regra: esta listagem não retorna vistorias com status `RASCUNHO`
- Regra: se `status=RASCUNHO` for informado, o retorno é vazio (`data: []`)
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas vistorias vinculadas aos seus contratos (via `inspection.contractId`), inclusive quando não há OS

Contrato por item (`InspectionListDTO`):

```json
{
  "externalId": "string",
  "module": "CAMPO|REMOTO|POS_OBRA|OBRAS_INVESTIMENTO|SEGURANCA_TRABALHO",
  "serviceDescription": "string",
  "locationDescription": "string",
  "status": "string",
  "scorePercent": 95.5,
  "hasParalysisPenalty": false,
  "finalizedAt": "2026-02-19T12:00:00.000Z",
  "createdAt": "2026-02-19T12:00:00.000Z",
  "team": { "name": "Equipe A" },
  "serviceOrder": {
    "osNumber": "OS-001",
    "fimExecucao": "2026-02-18T17:30:00.000Z",
    "resultado": "EXECUTADO"
  },
  "investmentWork": {
    "id": "uuid",
    "name": "Ampliação Rede Bairro Norte",
    "workName": "Ampliação Rede Bairro Norte"
  },
  "pendingItemsCount": 3,
  "pendingItemsPreview": [
    "Extintor vencido",
    "Sinalização de saída ausente",
    "Quadro elétrico sem identificação"
  ]
}
```

Campos opcionais de pendências de ajuste na listagem:

- `pendingItemsCount`:
  - quantidade total de itens **não conformes pendentes** da vistoria;
  - considera apenas itens com `answer = NAO_CONFORME` e `resolvedAt = null`;
  - quando não houver pendências, retorna `0`.
- `pendingItemsPreview`:
  - lista com até `3` textos dos itens pendentes;
  - usa ordem estável por criação do item (`inspection_items.createdAt ASC`);
  - fallback de texto: `title` -> `description` -> `"Item sem descrição"`;
  - quando não houver pendências, retorna `[]`.

### GET /inspections/mine

- Auth: JWT + FISCAL
- Query: `page`, `limit`, `osNumber` (busca parcial por número da OS), `inspectionScope`
- Response: paginação do mesmo DTO enxuto de `GET /inspections` (`InspectionListDTO`)
- Regras de serialização:
  - `externalId` sempre vem preenchido; quando não existir no banco, retorna fallback com `id` interno.
  - `serviceOrder` e `team` podem ser `null`.
  - quando `serviceOrder` existir, retorna `{ osNumber, fimExecucao, resultado }`.
  - `investmentWork` pode ser `null`; quando preenchido, retorna `{ id, name, workName }`.
- Escopo: além de `createdByUserId`, aplica contrato permitido da vistoria (`inspection.contractId`)

Exemplo de item em `data`:

```json
{
  "externalId": "uuid-offline",
  "module": "QUALIDADE",
  "serviceDescription": "Vistoria de campo",
  "locationDescription": "Setor A",
  "status": "RASCUNHO",
  "hasParalysisPenalty": false,
  "scorePercent": 92.5,
  "finalizedAt": null,
  "createdAt": "2026-04-19T12:00:00.000Z",
  "team": { "name": "Equipe A" },
  "serviceOrder": {
    "osNumber": "1234567",
    "fimExecucao": "2026-04-18T15:10:00.000Z",
    "resultado": "EXECUTADO"
  }
}
```

### GET /inspections/:id

- Auth: JWT
- `:id` aceita `id` ou `externalId`
- Response 200: objeto **enxuto** pensado para a tela de detalhe + PDF (menos RAM no dyno que o modelo antigo com checklist/itens aninhados no grafo).

**Raiz**

| Campo | Uso |
|--------|-----|
| `id`, `externalId` | Identificação; `serverId` === `id` (UUID interno para PUT/POST que exigem id do servidor) |
| `checklistId` | Abrir checklist no cache da UI |
| `status`, `module`, `hasParalysisPenalty` | Estado e chips |
| `serviceOrderId`, `serviceOrder` | `serviceOrder.osNumber` para título da OS quando houver OS |
| `investmentWork` | quando existir vínculo, retorna `{ id, name }` da obra de investimento |
| `createdBy` | usuário criador da vistoria, no formato `{ name }` |
| `updatedAt` | Fallback de “última alteração” ao montar views |
| `serviceDescription`, `locationDescription`, `createdAt`, `finalizedAt`, `scorePercent` | PDF / resumo |
| `team`, `checklist` | Opcionais `{ name }` para enriquecer PDF; nomes também vêm do cache por `checklistId` / equipe |

**`items[]`** — `id`, `checklistItemId`, `answer`, `notes`, `updatedAt`, `resolutionEvidencePath` (para PDF quando existir). Sem objeto `checklistItem` aninhado.

**`evidences[]`** — `id`, `inspectionItemId` (ou `null`), `fileName`, `mimeType`, `url` e/ou `dataUrl` (quando a mídia está como data URL), opcionais `cloudinaryPublicId`, `bytes`, `size`, `format`, `width`, `height`, `createdAt`.

**`signatures[]`** — ordem por `signedAt`; use o primeiro item conforme regra do app: `id`, `signerName`, `signedAt`, imagem via `url` / `dataUrl` / `cloudinaryPublicId`.

Exemplo (truncado):

```json
{
  "id": "uuid",
  "externalId": null,
  "serverId": "uuid",
  "checklistId": "uuid",
  "status": "RASCUNHO",
  "module": "QUALIDADE",
  "hasParalysisPenalty": false,
  "serviceOrderId": "uuid",
  "serviceDescription": "Vistoria",
  "locationDescription": "Bloco A",
  "createdAt": "2026-04-19T12:00:00.000Z",
  "finalizedAt": null,
  "updatedAt": "2026-04-19T14:00:00.000Z",
  "scorePercent": 88.5,
  "team": { "name": "Equipe 1" },
  "checklist": { "name": "Checklist QLT" },
  "serviceOrder": { "osNumber": "12345" },
  "investmentWork": { "id": "uuid", "name": "Obra X" },
  "createdBy": { "name": "Fiscal A" },
  "items": [
    {
      "id": "uuid",
      "checklistItemId": "uuid",
      "answer": "CONFORME",
      "notes": null,
      "updatedAt": "2026-04-19T13:00:00.000Z",
      "resolutionEvidencePath": null
    }
  ],
  "evidences": [
    {
      "id": "uuid",
      "inspectionItemId": "uuid",
      "fileName": "foto.jpg",
      "mimeType": "image/jpeg",
      "url": "https://res.cloudinary.com/...",
      "cloudinaryPublicId": "quality/evidences/x",
      "bytes": 1200,
      "size": 1200,
      "createdAt": "2026-04-19T13:00:00.000Z"
    }
  ],
  "signatures": [
    {
      "id": "uuid",
      "signerName": "João",
      "signedAt": "2026-04-19T13:00:00.000Z",
      "url": "https://res.cloudinary.com/..."
    }
  ]
}
```

### PUT /inspections/:id

- Auth: JWT
- Regra:
  - FISCAL só atualiza se `status = RASCUNHO`
  - GESTOR/SUPERVISOR/ADMIN podem atualizar sempre
  - Quando `teamId` for enviado, a equipe informada deve existir; caso contrário, retorna `400` com `Equipe não encontrada`

Request JSON (parcial):

```json
{
  "teamId": "uuid-da-equipe",
  "serviceDescription": "Descrição atualizada",
  "locationDescription": "Nova localização"
}
```

Response 200: `Inspection` atualizado

### PUT /inspections/:id/items

- Auth: JWT + FISCAL ou GESTOR ou SUPERVISOR ou ADMIN
- Regra:
  - FISCAL só atualiza itens se `status = RASCUNHO`
  - GESTOR/SUPERVISOR/ADMIN podem atualizar itens em qualquer status
  - A nota (`scorePercent`) é recalculada automaticamente a cada atualização de itens
  - Se `hasParalysisPenalty = true`, a nota final recebe penalidade persistente de 25%
  - Para GESTOR/SUPERVISOR/ADMIN, se a vistoria estiver em `FINALIZADA` ou `PENDENTE_AJUSTE`, o status é reavaliado automaticamente (`FINALIZADA ↔ PENDENTE_AJUSTE`) com base nos itens
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

- Auth: JWT + FISCAL ou GESTOR ou SUPERVISOR ou ADMIN
- Body JSON: não se aplica (multipart/form-data com campo `file`; opcional `inspectionItemId`)
- Arquivo:
  - tamanho máximo: 5MB
  - tipos aceitos: MIME da parte deve terminar em `jpg`, `jpeg`, `png` ou `webp` (ex.: `image/jpeg`, `image/png`, `image/webp`)
  - validação pelo MIME declarado na parte multipart (ver **Informações gerais** → uploads de imagem)
- Regra:
  - FISCAL só adiciona evidência se `status = RASCUNHO`
  - GESTOR/SUPERVISOR/ADMIN podem adicionar evidência em qualquer status

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

### DELETE /inspections/:id/evidences/:evidenceId

- Auth: JWT + FISCAL ou GESTOR ou SUPERVISOR ou ADMIN
- Request JSON: não se aplica
- Path:
  - `id`: UUID da vistoria (ou `externalId`, mesmo critério de `GET /inspections/:id`)
  - `evidenceId`: UUID da evidência (retornado em `POST /inspections/:id/evidences` ou no detalhe da vistoria em `evidences[].id`)
- Comportamento:
  - Remove o registro da evidência no banco.
  - Se existir `cloudinaryPublicId`, remove o asset correspondente no Cloudinary antes de apagar o registro.
  - Se não houver `cloudinaryPublicId` (registro legado), apenas remove o registro.
- Regras de perfil (iguais ao POST de evidência):
  - FISCAL só pode remover se `status = RASCUNHO`.
  - GESTOR/SUPERVISOR/ADMIN podem remover em qualquer status de vistoria.
- Erros:
  - `404` se a evidência não existir ou não pertencer à vistoria informada.

Response `204`: sem body.

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

- Auth: JWT + FISCAL ou GESTOR ou SUPERVISOR
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

- Auth: JWT + FISCAL ou GESTOR ou SUPERVISOR ou ADMIN
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

- Auth: JWT + GESTOR ou SUPERVISOR ou ADMIN
- Regra:
  - Remove penalidade de paralisação (`hasParalysisPenalty = false`).
  - Limpa `paralyzedReason`, `paralyzedAt`, `paralyzedByUserId`.
  - Recalcula `scorePercent` sem penalidade.
  - Chamada é idempotente: se não tiver penalidade ativa, retorna sem alterar estado.

Request JSON: sem body

Response 200: `Inspection` atualizado

### POST /inspections/:id/items/:itemId/resolve

- Auth: JWT + FISCAL ou GESTOR ou SUPERVISOR ou ADMIN
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

- Auth: JWT + FISCAL ou GESTOR ou SUPERVISOR ou ADMIN
- Regra: só permite quando todos os itens `NAO_CONFORME` já tiverem `resolvedAt`

Request JSON:

```json
{
  "resolutionNotes": "Pendência encerrada",
  "resolutionEvidence": "https://res.cloudinary.com/.../image/upload/...jpg"
}
```

Response 200: `Inspection` com `status = RESOLVIDA`

## Reports (Relatórios dinâmicos)

### GET /reports/types

- Auth: JWT
- Response: lista de tipos de relatório ativos (`report_types`), ordenada por nome
- Campo `orientation`: define formato de emissão do relatório (`RETRATO` ou `PAISAGEM`)

Response 200:

```json
[
  {
    "id": "uuid",
    "code": "RELATORIO_OCORRENCIA",
    "name": "Relatório de Ocorrência",
    "description": "Relatório para registro de ocorrências em campo.",
    "version": 1,
    "active": true,
    "orientation": "RETRATO",
    "createdAt": "2026-02-19T12:00:00.000Z",
    "updatedAt": "2026-02-19T12:00:00.000Z"
  }
]
```

### GET /reports/types/:code/fields

- Auth: JWT
- Path:
  - `code`: código do tipo de relatório (ex.: `VISTORIA_OBRA`)
- Response: schema dinâmico do formulário (`report_type_fields`) ordenado por `order`

Response 200:

```json
[
  {
    "id": "uuid",
    "reportTypeId": "uuid",
    "fieldKey": "nomeResponsavel",
    "label": "Nome do Responsável",
    "type": "text",
    "required": true,
    "order": 1,
    "placeholder": "Digite o nome do responsável",
    "helpText": null,
    "options": null,
    "defaultValue": null,
    "multiple": false,
    "createdAt": "2026-02-19T12:00:00.000Z",
    "updatedAt": "2026-02-19T12:00:00.000Z"
  },
  {
    "id": "uuid",
    "reportTypeId": "uuid",
    "fieldKey": "fotosGerais",
    "label": "Fotos Gerais",
    "type": "image",
    "required": false,
    "order": 4,
    "placeholder": null,
    "helpText": null,
    "options": null,
    "defaultValue": null,
    "multiple": true,
    "createdAt": "2026-02-19T12:00:00.000Z",
    "updatedAt": "2026-02-19T12:00:00.000Z"
  }
]
```

### Persistência de relatórios

- Os endpoints de persistência (`POST /reports/files`, `POST /reports/records`, `GET /reports/records/:id`) foram descontinuados.
- O módulo de relatórios permanece apenas como provider de schema dinâmico para renderização no frontend.

## Sync

### POST /sync/inspections

- Auth: JWT + FISCAL ou GESTOR ou SUPERVISOR ou ADMIN
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
      "contractId": "uuid",
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
- `serviceOrderId` é obrigatório para criar nova vistoria quando `module != SEGURANCA_TRABALHO` e `module != OBRAS_INVESTIMENTO` (OS deve estar cadastrada via `POST /service-orders/import`).
- Quando `serviceOrderId` não for enviado, `contractId` é obrigatório.
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
- Arquivo:
  - tamanho máximo: 10MB
  - apenas imagens cujo MIME declarado na parte `file` corresponda a `image/*` (ver **Informações gerais** → uploads de imagem)

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

Em todas as rotas abaixo, o query param opcional **`contractId`** (`uuid`) restringe os dados às vistorias vinculadas a esse contrato (via `inspection.contractId`). A regra de escopo por perfil (`ADMIN` vs `GESTOR`/`SUPERVISOR`) permanece; ver `Guia rápido` → Escopo por contrato.

Regras de consistência aplicadas aos dashboards de qualidade:

- `GET /dashboards/summary`, `GET /dashboards/ranking/teams` e `GET /dashboards/current-month-by-service` usam a mesma base para `QUALITY`: período por data local (`America/Sao_Paulo`) com regra por módulo:
  - `CAMPO` e `REMOTO`: usa `serviceOrder.fim_execucao`.
  - `POS_OBRA` e `OBRAS_INVESTIMENTO`: usa `inspection.finalizedAt`.
- Nos três endpoints acima, o cálculo de `QUALITY` considera status diferentes de `RASCUNHO`.
- Nos três endpoints acima, apenas inspeções com equipe entram no total (`inspection.teamId IS NOT NULL`).

Aliases de compatibilidade (mesmo contrato de query/response do endpoint-base correspondente):

- `GET /dashboards/quality/ranking/teams` → mesmo comportamento de `GET /dashboards/ranking/teams` (setor `QUALITY`)
- `GET /dashboards/quality/ranking/teams/:teamId/inspections` → mesmo comportamento de `GET /dashboards/ranking/teams/:teamId/inspections` (setor `QUALITY`)
- `GET /dashboards/safety-work/ranking/teams/:teamId/inspections` → mesmo comportamento de `GET /dashboards/ranking/teams/:teamId/inspections` (setor `SAFETY_WORK`)
- `GET /dashboards/quality/teams/:teamId` → mesmo comportamento de `GET /dashboards/teams/:teamId` (setor `QUALITY`)
- `GET /dashboards/safety-work/teams/:teamId` → mesmo comportamento de `GET /dashboards/teams/:teamId` (setor `SAFETY_WORK`)
- `GET /dashboards/quality/quality-by-service` → mesmo comportamento de `GET /dashboards/quality-by-service` (setor `QUALITY`)
- `GET /dashboards/safety-work/quality-by-service` → mesmo comportamento de `GET /dashboards/quality-by-service` (setor `SAFETY_WORK`)
- `GET /dashboards/quality/current-month-by-service` → mesmo comportamento de `GET /dashboards/current-month-by-service` (setor `QUALITY`)
- `GET /dashboards/safety-work/current-month-by-service` → mesmo comportamento de `GET /dashboards/current-month-by-service` (setor `SAFETY_WORK`)
- `GET /dashboards/quality/team-performance-by-teams` → mesmo comportamento de `GET /dashboards/team-performance-by-teams` (setor `QUALITY`)
- `GET /dashboards/safety-work/team-performance-by-teams` → mesmo comportamento de `GET /dashboards/team-performance-by-teams` (setor `SAFETY_WORK`)
- `GET /dashboards/quality/non-conformities/by-checklist` → mesmo comportamento de `GET /dashboards/non-conformities/by-checklist` (setor `QUALITY`)
- `GET /dashboards/safety-work/non-conformities/by-checklist` → mesmo comportamento de `GET /dashboards/non-conformities/by-checklist` (setor `SAFETY_WORK`)
- `GET /dashboards/quality/non-conformities/by-team` → mesmo comportamento de `GET /dashboards/non-conformities/by-team` (setor `QUALITY`)
- `GET /dashboards/safety-work/non-conformities/by-team` → mesmo comportamento de `GET /dashboards/non-conformities/by-team` (setor `SAFETY_WORK`)

### GET /dashboards/summary

- Auth: JWT
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `module` (`ModuleType`) opcional
  - `teamId` (`uuid`) opcional
  - `contractId` (`uuid`) opcional
- Regra de período:
  - `QUALITY` (`CAMPO`, `POS_OBRA`, `REMOTO`, `OBRAS_INVESTIMENTO`): filtro por **data local** (`America/Sao_Paulo`) entre `from` e `to` (inclusive), com regra por módulo:
    - `CAMPO` e `REMOTO`: usa `serviceOrder.fim_execucao`.
    - `POS_OBRA` e `OBRAS_INVESTIMENTO`: usa `inspection.finalizedAt`.
  - `SAFETY_WORK` (`SEGURANCA_TRABALHO`): filtro por `COALESCE(inspection.finalizedAt, inspection.createdAt)` entre `from` e `to` (inclusive).
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

Response 200:

```json
{
  "averagePercent": 92.45,
  "inspectionsCount": 34,
  "pendingCount": 5
}
```

### GET /dashboards/quality/summary

- Auth: JWT
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `module` (`ModuleType`) opcional
  - `teamId` (`uuid`) opcional
  - `contractId` (`uuid`) opcional
- Regra de período:
  - `QUALITY` (`CAMPO`, `POS_OBRA`, `REMOTO`, `OBRAS_INVESTIMENTO`): filtro por **data local** (`America/Sao_Paulo`) entre `from` e `to` (inclusive), com regra por módulo:
    - `CAMPO` e `REMOTO`: usa `serviceOrder.fim_execucao`.
    - `POS_OBRA` e `OBRAS_INVESTIMENTO`: usa `inspection.finalizedAt`.
  - `SAFETY_WORK` (`SEGURANCA_TRABALHO`): filtro por `COALESCE(inspection.finalizedAt, inspection.createdAt)` entre `from` e `to` (inclusive).
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.
- Comportamento: mantém o resumo base e adiciona contadores de inspeções por módulo de qualidade (`CAMPO`, `POS_OBRA`, `REMOTO`, `OBRAS_INVESTIMENTO`).

Response 200:

```json
{
  "averagePercent": 92.45,
  "inspectionsCount": 34,
  "pendingCount": 5,
  "field": {
    "inspectionsCount": 10,
    "averagePercent": 92.45
  },
  "postWork": {
    "inspectionsCount": 8,
    "averagePercent": 90.11
  },
  "remote": {
    "inspectionsCount": 9,
    "averagePercent": 89.77
  },
  "investmentWorks": {
    "inspectionsCount": 7,
    "averagePercent": 93.2
  }
}
```

### GET /dashboards/safety-work/summary

- Auth: JWT
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `module` (`ModuleType`) opcional
  - `teamId` (`uuid`) opcional
  - `contractId` (`uuid`) opcional
- Regra de período:
  - `SAFETY_WORK` (`SEGURANCA_TRABALHO`): filtro por `COALESCE(inspection.finalizedAt, inspection.createdAt)` entre `from` e `to` (inclusive).
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.
- Comportamento: mesmo contrato de retorno de `GET /dashboards/summary`, com agregação no setor `SAFETY_WORK`.

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
  - `contractId` (`uuid`) opcional
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Regra de período:
  - `QUALITY` (`CAMPO`, `POS_OBRA`, `REMOTO`, `OBRAS_INVESTIMENTO`): filtro por **data local** (`America/Sao_Paulo`) entre `from` e `to` (inclusive), com regra por módulo:
    - `CAMPO` e `REMOTO`: usa `serviceOrder.fim_execucao`.
    - `POS_OBRA` e `OBRAS_INVESTIMENTO`: usa `inspection.finalizedAt`.
  - `SAFETY_WORK` (`SEGURANCA_TRABALHO`): filtro por `COALESCE(inspection.finalizedAt, inspection.createdAt)` entre `from` e `to` (inclusive).
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

Response 200:

```json
[
  {
    "teamId": "uuid",
    "teamName": "Equipe Norte",
    "averagePercent": 95.1,
    "inspectionsCount": 12,
    "postWorkPercent": 94.2,
    "remotePercent": 96.5,
    "fieldPercent": 93.8,
    "investmentWorksPercent": 92.6,
    "pendingCount": 2
  },
  {
    "teamId": "uuid-2",
    "teamName": "Equipe Sul",
    "averagePercent": 90.2,
    "inspectionsCount": 10,
    "postWorkPercent": 89.3,
    "remotePercent": 91.7,
    "fieldPercent": 90.1,
    "investmentWorksPercent": 88.4,
    "pendingCount": 1
  }
]
```

- `postWorkPercent`: média (%) da equipe no módulo `POS_OBRA` no período (0 quando não houver vistoria no módulo).
- `remotePercent`: média (%) da equipe no módulo `REMOTO` no período (0 quando não houver vistoria no módulo).
- `fieldPercent`: média (%) da equipe no módulo `CAMPO` no período (0 quando não houver vistoria no módulo).
- `investmentWorksPercent`: média (%) da equipe no módulo `OBRAS_INVESTIMENTO` no período (0 quando não houver vistoria no módulo).

### GET /dashboards/ranking/teams/safety-work

- Auth: JWT
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `contractId` (`uuid`) opcional
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

Response 200:

```json
[
  {
    "teamId": "uuid",
    "teamName": "Equipe Norte",
    "averagePercent": 95.1,
    "safetyWorkPercent": 92.4,
    "inspectionsCount": 12
  },
  {
    "teamId": "uuid-2",
    "teamName": "Equipe Sul",
    "averagePercent": 90.2,
    "safetyWorkPercent": 88.9,
    "inspectionsCount": 10
  }
]
```

### GET /dashboards/ranking/teams/:teamId/inspections

- Auth: JWT
- Path:
  - `teamId` (`uuid`) **obrigatório**
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `metric` (opcional): `average`, `postWork`, `remote`, `field`, `investmentWorks`, `safetyWork` (default: `average`)
  - `page` (opcional, default `1`)
  - `limit` (opcional, default `20`, máximo `100`)
  - `contractId` (`uuid`) opcional
- Mapeamento de `metric` para módulo:
  - `postWork` -> `POS_OBRA`
  - `remote` -> `REMOTO`
  - `field` -> `CAMPO`
  - `investmentWorks` -> `OBRAS_INVESTIMENTO`
  - `safetyWork` -> `SEGURANCA_TRABALHO`
  - `average` -> sem filtro por módulo (respeitando o setor da rota)
- Regra de período:
  - `QUALITY` (métrica `average`, `postWork`, `remote`, `field`, `investmentWorks`): filtro por **data local** (`America/Sao_Paulo`) entre `from` e `to` (inclusive), com regra por módulo:
    - `CAMPO` e `REMOTO`: usa `serviceOrder.fim_execucao`.
    - `POS_OBRA` e `OBRAS_INVESTIMENTO`: usa `inspection.finalizedAt`.
  - `SAFETY_WORK` (métrica `safetyWork`): filtro por `COALESCE(inspection.finalizedAt, inspection.createdAt)` entre `from` e `to` (inclusive).
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

Retorna as vistorias que compõem a nota clicada no ranking por equipe, com paginação.

Response 200:

```json
{
  "from": "2026-01-01",
  "to": "2026-01-31",
  "teamId": "b8b006bf-a9f7-42ec-882f-263bc672e430",
  "teamName": "ROBSON DA SILVA",
  "metric": "field",
  "page": 1,
  "limit": 20,
  "total": 2,
  "totalPages": 1,
  "hasNext": false,
  "hasPrev": false,
  "inspections": [
    {
      "inspectionId": "7e3bc6ad-2b2f-44bf-bec0-dad64989b38c",
      "serviceOrderId": "e35cf2b4-53a6-45cc-b57d-cd00d58d9a1a",
      "serviceOrderNumber": "OS-123456",
      "serviceOrderAddress": "Rua das Palmeiras, 100 - Centro",
      "module": "CAMPO",
      "status": "FINALIZADA",
      "scorePercent": 96.8,
      "finishedAt": "2026-01-15T13:30:00.000Z",
      "createdAt": "2026-01-15T12:10:00.000Z"
    },
    {
      "inspectionId": "53ad4f4a-377d-4f36-82e2-f178fdf93fd9",
      "serviceOrderId": "a6e6b603-f136-4937-9115-7a2ae8880ba3",
      "serviceOrderNumber": "OS-123470",
      "serviceOrderAddress": "Av. Brasil, 420 - Industrial",
      "module": "CAMPO",
      "status": "RESOLVIDA",
      "scorePercent": 90.3,
      "finishedAt": "2026-01-20T10:30:00.000Z",
      "createdAt": "2026-01-20T09:40:00.000Z"
    }
  ]
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

### GET /dashboards/teams/:teamId

- Auth: JWT
- Path: `teamId` (uuid da equipe).
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `module` (`ModuleType`) opcional
  - `contractId` (`uuid`) opcional
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

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
- Perfis permitidos: `ADMIN`, `GESTOR`, `SUPERVISOR`
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `module` (`ModuleType`) opcional
  - `teamId` (`uuid`) opcional
  - `contractId` (`uuid`) opcional
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.
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
- Perfis permitidos: `ADMIN`, `GESTOR`, `SUPERVISOR`
- Query:
  - `month` (`YYYY-MM`) opcional (default = mês atual em `America/Sao_Paulo`)
  - `module` (`ModuleType`) opcional
  - `teamId` (`uuid`) opcional
  - `contractId` (`uuid`) opcional
- Regra de período mensal:
  - `QUALITY` (`CAMPO`, `POS_OBRA`, `REMOTO`, `OBRAS_INVESTIMENTO`): mês baseado em regra por módulo (mesma referência de período do endpoint `GET /dashboards/summary`):
    - `CAMPO` e `REMOTO`: usa `serviceOrder.fim_execucao`.
    - `POS_OBRA` e `OBRAS_INVESTIMENTO`: usa `inspection.finalizedAt`.
  - `SAFETY_WORK` (`SEGURANCA_TRABALHO`): mês baseado em `COALESCE(inspection.finalizedAt, inspection.createdAt)`.
- Status considerados: todos, exceto `RASCUNHO` (mesma regra de `GET /dashboards/summary` e `GET /dashboards/ranking/teams`).
- Apenas inspeções com equipe vinculada entram no cálculo (`teamId IS NOT NULL`).
- `pendingAdjustmentsCount` contabiliza inspeções do mês com status `PENDENTE_AJUSTE`.
- `qualityPercent` por serviço é `AVG(scorePercent)` no mês.
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

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

### GET /dashboards/safety-work/low-score-collaborators

- Auth: JWT
- Perfis permitidos: `ADMIN`, `GESTOR`, `SUPERVISOR`
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `lowScoreThreshold` (`number`, 0–100) opcional (default: `70`)
  - `limit` (`int`, 1–100) opcional (default: `15`)
  - `contractId` (`uuid`) opcional
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Considera vistorias de `SEGURANCA_TRABALHO` com `inspectionScope` por colaborador; ver implementação para detalhes de ordenação.
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

Response 200 (estrutura simplificada):

```json
{
  "from": "2026-01-01",
  "to": "2026-01-31",
  "lowScoreThreshold": 70,
  "collaborators": [
    {
      "collaboratorId": "uuid",
      "collaboratorName": "Nome",
      "inspectionsCount": 5,
      "badScoresCount": 3,
      "badScoreRatePercent": 60,
      "averagePercent": 62.4,
      "worstScorePercent": 40,
      "bestScorePercent": 80
    }
  ]
}
```

### GET /dashboards/team-performance-by-teams

- Auth: JWT
- Perfis permitidos: `ADMIN`, `GESTOR`, `SUPERVISOR`
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `teamIds` (**obrigatório**): lista CSV de UUIDs de equipes (ex.: `uuid1,uuid2`)
  - `contractId` (`uuid`) opcional
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Compara período atual com período imediatamente anterior de mesma duração; retorna resumo agregado e métricas por equipe e colaboradores.
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.

Response 200 (estrutura simplificada):

```json
{
  "from": "2026-01-01",
  "to": "2026-01-31",
  "teamIds": ["uuid"],
  "summary": {
    "averagePercent": 0,
    "previousAveragePercent": 0,
    "inspectionsCount": 0,
    "pendingAdjustmentsCount": 0
  },
  "teams": [
    {
      "teamId": "uuid",
      "teamName": "Equipe",
      "averagePercent": 0,
      "inspectionsCount": 0,
      "pendingAdjustmentsCount": 0,
      "collaborators": [
        {
          "collaboratorId": "uuid",
          "collaboratorName": "Nome",
          "qualityPercent": 0,
          "inspectionsCount": 0
        }
      ]
    }
  ]
}
```

### GET /dashboards/non-conformities/by-checklist

- Auth: JWT
- Perfis permitidos: `ADMIN`, `GESTOR`, `SUPERVISOR`
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `module` (`ModuleType`) opcional
  - `teamId` (`uuid`) opcional
  - `contractId` (`uuid`) opcional
  - `limitPerChecklist` (`int`) opcional (default: `5`, máximo: `20`)
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Status considerados:
  - `FINALIZADA`
  - `PENDENTE_AJUSTE`
  - `RESOLVIDA`
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.
- Retorna os checklists com perguntas que mais receberam `NAO_CONFORME`, incluindo taxa de não conformidade por pergunta.

Response 200:

```json
{
  "from": "2026-01-01",
  "to": "2026-01-31",
  "module": "CAMPO",
  "teamId": "7f214d1f-5e2a-46f8-8f90-e64129876f84",
  "limitPerChecklist": 2,
  "checklists": [
    {
      "checklistId": "8b0f1d7a-2d06-4f80-92f9-6889edc8e5ba",
      "checklistName": "Checklist Rede",
      "totalNonConformities": 16,
      "questions": [
        {
          "checklistItemId": "0f4f9da6-0f43-4f22-a4d0-b0c4b6a7e31f",
          "checklistItemTitle": "Uso correto de EPI",
          "nonConformitiesCount": 10,
          "answersCount": 40,
          "nonConformityRatePercent": 25
        },
        {
          "checklistItemId": "64a2783f-66a4-4fc7-b112-478b95f80f4d",
          "checklistItemTitle": "Sinalização da área",
          "nonConformitiesCount": 6,
          "answersCount": 30,
          "nonConformityRatePercent": 20
        }
      ]
    }
  ]
}
```

### GET /dashboards/non-conformities/by-team

- Auth: JWT
- Perfis permitidos: `ADMIN`, `GESTOR`, `SUPERVISOR`
- Query:
  - `from` (`YYYY-MM-DD`) **obrigatório**
  - `to` (`YYYY-MM-DD`) **obrigatório**
  - `teamId` (`uuid`) **obrigatório**
  - `module` (`ModuleType`) opcional
  - `contractId` (`uuid`) opcional
  - `limit` (`int`) opcional (default: `10`, máximo: `20`)
- O intervalo entre `from` e `to` não pode ser maior que 2 anos (400 se exceder).
- Status considerados:
  - `FINALIZADA`
  - `PENDENTE_AJUSTE`
  - `RESOLVIDA`
- Escopo: `GESTOR`/`SUPERVISOR` vê apenas dados dos contratos permitidos; `ADMIN` vê tudo.
- Retorna as maiores não conformidades da equipe no período, agregadas por pergunta (`checklistItem`) independentemente do checklist.

Response 200:

```json
{
  "from": "2026-01-01",
  "to": "2026-01-31",
  "module": "CAMPO",
  "teamId": "7f214d1f-5e2a-46f8-8f90-e64129876f84",
  "limit": 3,
  "nonConformities": [
    {
      "checklistItemId": "0f4f9da6-0f43-4f22-a4d0-b0c4b6a7e31f",
      "checklistItemTitle": "Uso correto de EPI",
      "nonConformitiesCount": 10,
      "answersCount": 40,
      "nonConformityRatePercent": 25,
      "checklistsCount": 2
    },
    {
      "checklistItemId": "64a2783f-66a4-4fc7-b112-478b95f80f4d",
      "checklistItemTitle": "Sinalização da área",
      "nonConformitiesCount": 6,
      "answersCount": 30,
      "nonConformityRatePercent": 20,
      "checklistsCount": 1
    }
  ]
}
```

## Permissões por role

### FISCAL

- Criar vistoria (exige `serviceOrderId` para módulos que pedem OS; quando não houver OS, exige `contractId`)
- Editar vistoria apenas em `RASCUNHO`
- Paralisar vistoria
- Finalizar vistoria
- Resolver itens não conformes e pendências
- Listar apenas as próprias vistorias (`/inspections/mine`)
- Todos os dados listados são restringidos aos contratos vinculados ao usuário
- Relatórios dinâmicos: consultar tipos e schema do formulário (`GET /reports/types`, `GET /reports/types/:code/fields`)

### GESTOR

- Criar/editar/finalizar vistorias (exige `serviceOrderId` para módulos que pedem OS; quando não houver OS, exige `contractId`)
- Importar OS via Excel (`POST /service-orders/import`)
- Paralisar e remover penalidade de paralisação (unparalyze)
- Resolver itens não conformes e pendências
- Acessar listagem geral de vistorias
- Dados operacionais e dashboards limitados aos contratos vinculados ao usuário
- Relatórios dinâmicos: consultar tipos e schema do formulário (`GET /reports/types`, `GET /reports/types/:code/fields`)

### SUPERVISOR

- Mesmo nível hierárquico e mesmas permissões operacionais de `GESTOR`
- Criar/editar/finalizar vistorias (exige `serviceOrderId` para módulos que pedem OS; quando não houver OS, exige `contractId`)
- Importar OS via Excel (`POST /service-orders/import`)
- Paralisar e remover penalidade de paralisação (unparalyze)
- Resolver itens não conformes e pendências
- Acessar listagem geral de vistorias
- Dados operacionais e dashboards limitados aos contratos vinculados ao usuário
- Relatórios dinâmicos: consultar tipos e schema do formulário (`GET /reports/types`, `GET /reports/types/:code/fields`)

### ADMIN

- Todas as permissões operacionais do GESTOR
- Importar OS via Excel (`POST /service-orders/import`)
- CRUD de usuários, contratos/cidades, equipes, colaboradores e checklists
- Relatórios dinâmicos: consultar tipos e schema do formulário (`GET /reports/types`, `GET /reports/types/:code/fields`)

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
- `contractId é obrigatório quando serviceOrderId não for informado.`
- `Ordem de serviço não encontrada. Cadastre a OS via importação de Excel antes de criar a vistoria.`
- `serviceOrderId é obrigatório para criar nova vistoria. Cadastre a OS via importação de Excel antes de sincronizar.`
- `Não foi possível determinar o contractId da vistoria.`
- `Você não tem acesso ao contrato informado para esta vistoria.`
- `contractIds é obrigatório`
- `Um ou mais contratos não foram encontrados`
- `contractId é obrigatório na importação`
- `Contrato informado não encontrado`
- `contractId informado não existe`
- `contractId deve ser um UUID válido` (query inválido em dashboards e outros DTOs que aceitam `contractId` opcional)
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
- `Item do checklist não encontrado`
- `Assets must be uploaded before sync`
- `Tipo de relatório não encontrado ou inativo`
- `fieldKey inválido para o tipo de relatório`
- `Upload permitido apenas para campos do tipo image ou signature`
- `Campo não permitido no formulário: <fieldKey>`
- `Campo obrigatório não informado: <fieldKey>`
- `Um ou mais arquivos de imagem/assinatura são inválidos para este relatório`
- `Você não tem acesso a este relatório`
