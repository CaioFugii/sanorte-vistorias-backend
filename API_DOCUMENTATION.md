# API Documentation - Sanorte Vistorias Backend

## Informações gerais

- Base URL (dev): `http://localhost:3000`
- Autenticação: JWT Bearer Token
- Formato padrão: JSON (exceto upload de arquivo e download de PDF)

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
  "createdAt": "2026-02-19T12:00:00.000Z",
  "updatedAt": "2026-02-19T12:00:00.000Z",
  "collaborators": [
    {
      "id": "uuid",
      "name": "Colaborador 1",
      "active": true
    }
  ]
}
```

### Collaborator

```json
{
  "id": "uuid",
  "name": "Colaborador 1",
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

### Inspection

```json
{
  "id": "uuid",
  "externalId": "uuid",
  "module": "QUALIDADE",
  "checklistId": "uuid",
  "teamId": "uuid",
  "serviceDescription": "string",
  "locationDescription": "string",
  "status": "RASCUNHO",
  "scorePercent": 95.5,
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
    "role": "FISCAL"
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
  "role": "FISCAL"
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
  "role": "GESTOR"
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

Request JSON (parcial):

```json
{
  "name": "Nome Atualizado",
  "role": "ADMIN"
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

## Teams

### GET /teams

- Auth: JWT
- Query: `page`, `limit`
- Response: paginação de `Team` com `collaborators`

### POST /teams

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "name": "Equipe Norte",
  "active": true,
  "collaboratorIds": ["uuid-1", "uuid-2"]
}
```

Response 201:

```json
{
  "id": "uuid",
  "name": "Equipe Norte",
  "active": true,
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

Request JSON (parcial):

```json
{
  "name": "Equipe Norte Atualizada",
  "collaboratorIds": ["uuid-3"]
}
```

Response 200: `Team` atualizado

### DELETE /teams/:id

- Auth: JWT + ADMIN
- Response 200: vazio

## Collaborators

### GET /collaborators

- Auth: JWT
- Query: `page`, `limit`
- Response: paginação de `Collaborator` ativos

### POST /collaborators

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "name": "Novo Colaborador",
  "active": true
}
```

Response 201:

```json
{
  "id": "uuid",
  "name": "Novo Colaborador",
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
  - `active` (`true`/`false`)
  - `page`, `limit`
- Response: paginação de `Checklist` com `sections` e `items`

### GET /checklists/:id

- Auth: JWT
- Response 200: `Checklist` completo

### POST /checklists

- Auth: JWT + ADMIN

Request JSON:

```json
{
  "module": "QUALIDADE",
  "name": "Checklist de Qualidade",
  "description": "Checklist padrão",
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

## Inspections

### POST /inspections

- Auth: JWT + FISCAL ou GESTOR

Request JSON:

```json
{
  "module": "SEGURANCA_TRABALHO",
  "checklistId": "uuid",
  "teamId": "uuid",
  "serviceDescription": "Inspeção semanal",
  "locationDescription": "Canteiro principal",
  "collaboratorIds": ["uuid-1", "uuid-2"],
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
  - `teamId`
  - `status`
  - `page`, `limit`
- Response: paginação de `Inspection`

### GET /inspections/mine

- Auth: JWT + FISCAL
- Query: `page`, `limit`
- Response: paginação de `Inspection` do usuário logado

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

- Auth: JWT
- Regra: apenas vistoria em `RASCUNHO`

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

- Auth: JWT
- Body JSON: não se aplica (multipart/form-data com campo `file`; opcional `inspectionItemId`)

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

- Exige assinatura do líder/encarregado.
- Item `NAO_CONFORME` com `requiresPhotoOnNonConformity = true` exige evidência.
- Calcula `scorePercent`.
- Se houver `NAO_CONFORME`: status `PENDENTE_AJUSTE` e pendência `PENDENTE`.
- Se não houver `NAO_CONFORME`: status `FINALIZADA`.

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

### GET /inspections/:id/pdf

- Auth: JWT
- Request JSON: não se aplica
- Response 200: arquivo PDF (`application/pdf`)

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
      "module": "QUALIDADE",
      "checklistId": "uuid",
      "teamId": "uuid",
      "serviceDescription": "Vistoria offline",
      "locationDescription": "Frente A",
      "collaboratorIds": ["uuid-1"],
      "createdOffline": true,
      "syncedAt": "2026-02-19T12:00:00.000Z",
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
- Não aceita assets em `dataUrl`/`imageBase64` no sync.
- Para evidências e assinatura, use `url` e/ou `cloudinaryPublicId`.
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
  - `from` (`YYYY-MM-DD`)
  - `to` (`YYYY-MM-DD`)
  - `module` (`ModuleType`)
  - `teamId` (`uuid`)

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
  - `from` (`YYYY-MM-DD`)
  - `to` (`YYYY-MM-DD`)
  - `module` (`ModuleType`)

Response 200:

```json
[
  {
    "teamId": "uuid",
    "teamName": "Equipe Norte",
    "averagePercent": 95.1,
    "inspectionsCount": 12,
    "pendingCount": 2
  },
  {
    "teamId": "uuid-2",
    "teamName": "Equipe Sul",
    "averagePercent": 90.2,
    "inspectionsCount": 10,
    "pendingCount": 1
  }
]
```

## Permissões por role

### FISCAL

- Criar vistoria
- Editar vistoria apenas em `RASCUNHO`
- Finalizar vistoria
- Resolver itens não conformes e pendências
- Listar apenas as próprias vistorias (`/inspections/mine`)

### GESTOR

- Criar/editar/finalizar vistorias
- Resolver itens não conformes e pendências
- Acessar listagem geral de vistorias

### ADMIN

- Todas as permissões operacionais do GESTOR
- CRUD de usuários, equipes, colaboradores e checklists

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

- `Vistoria não encontrada`
- `Fiscal não pode editar vistoria após finalização`
- `Não é possível atualizar itens de vistoria finalizada`
- `Não é possível adicionar evidências em vistoria finalizada`
- `Não é possível adicionar assinatura em vistoria finalizada`
- `Vistoria já foi finalizada`
- `Assinatura do líder/encarregado é obrigatória para finalizar`
- `Item "<titulo>" requer foto de evidência quando não conforme`
- `Vistoria não está pendente de ajuste`
- `Apenas itens em não conformidade podem ser resolvidos`
- `Resolva todos os itens não conformes antes de resolver a vistoria. Use POST /inspections/:id/items/:itemId/resolve para cada item.`
- `Assets must be uploaded before sync`
