# 📚 Documentação da API - Sistema de Vistorias em Campo

## 📋 Índice

1. [Informações Gerais](#informações-gerais)
2. [Configuração Base](#configuração-base)
3. [Autenticação](#autenticação)
4. [Paginação](#paginação)
5. [Modelos de Dados](#modelos-de-dados)
6. [Enums](#enums)
7. [Endpoints](#endpoints)
8. [Regras de Negócio](#regras-de-negócio)
9. [Tratamento de Erros](#tratamento-de-erros)
10. [Exemplos de Fluxos](#exemplos-de-fluxos)
11. [Upload de Arquivos](#upload-de-arquivos)
12. [Download de PDF](#download-de-pdf)

---

## 📌 Informações Gerais

### Base URL
```
Desenvolvimento: http://localhost:3000
Produção: [A definir]
```

### Formato de Resposta
Todas as respostas são em formato JSON, exceto uploads e downloads de arquivos.

### Códigos de Status HTTP

| Código | Significado |
|--------|-------------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Requisição inválida (validação ou regra de negócio) |
| 401 | Não autenticado (token inválido ou ausente) |
| 403 | Não autorizado (sem permissão para a ação) |
| 404 | Recurso não encontrado |
| 500 | Erro interno do servidor |

---

## ⚙️ Configuração Base

### Headers Obrigatórios

Para todas as requisições autenticadas, inclua:

```
Authorization: Bearer <token>
Content-Type: application/json
```

### Formato de Datas

- **Envio**: `YYYY-MM-DD` (ex: `2024-01-15`)
- **Recebimento**: ISO 8601 (ex: `2024-01-15T10:30:00.000Z`)

### IDs

Todos os IDs são UUIDs (v4) no formato:
```
550e8400-e29b-41d4-a716-446655440000
```

---

## 🔐 Autenticação

### 1. Login

**Endpoint:** `POST /auth/login`

**Autenticação:** Não requerida

**Request Body:**
```json
{
  "email": "fiscal@sanorte.com",
  "password": "senha123"
}
```

**Validações:**
- `email`: obrigatório, formato de email válido
- `password`: obrigatório, mínimo 6 caracteres

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Fiscal",
    "email": "fiscal@sanorte.com",
    "role": "FISCAL"
  }
}
```

**Erros:**
- `401 Unauthorized`: Credenciais inválidas
- `400 Bad Request`: Dados inválidos

**Exemplo JavaScript:**
```javascript
const response = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'fiscal@sanorte.com',
    password: 'senha123'
  })
});

const data = await response.json();
localStorage.setItem('token', data.accessToken);
```

---

### 2. Obter Dados do Usuário Logado

**Endpoint:** `GET /auth/me`

**Autenticação:** Requerida (JWT)

**Response 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Fiscal",
  "email": "fiscal@sanorte.com",
  "role": "FISCAL"
}
```

**Erros:**
- `401 Unauthorized`: Token inválido ou ausente

---

## 📄 Paginação

Todas as listagens da API suportam paginação através de query parameters.

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `page` | number | Não | 1 | Número da página (inicia em 1) |
| `limit` | number | Não | 10 | Quantidade de itens por página (máximo 100) |

### Response Format

Todas as listagens retornam no seguinte formato:

```json
{
  "data": [...],  // Array com os itens da página
  "meta": {
    "page": 1,           // Página atual
    "limit": 10,         // Itens por página
    "total": 150,        // Total de itens
    "totalPages": 15,    // Total de páginas
    "hasNext": true,     // Se existe próxima página
    "hasPrev": false     // Se existe página anterior
  }
}
```

### Exemplos

**Listar primeira página (10 itens):**
```
GET /users?page=1&limit=10
```

**Listar segunda página (20 itens por página):**
```
GET /users?page=2&limit=20
```

**Sem paginação (usa valores padrão):**
```
GET /users
// Equivale a GET /users?page=1&limit=10
```

### Validações

- `page`: Deve ser >= 1
- `limit`: Deve ser >= 1 e <= 100
- Se valores inválidos forem fornecidos, serão usados os padrões

### Exemplo JavaScript

```javascript
async function getUsers(page = 1, limit = 10) {
  const response = await fetch(
    `http://localhost:3000/users?page=${page}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const result = await response.json();
  
  console.log(`Página ${result.meta.page} de ${result.meta.totalPages}`);
  console.log(`Total de itens: ${result.meta.total}`);
  console.log(`Itens nesta página: ${result.data.length}`);
  
  return result;
}

// Uso
const result = await getUsers(1, 20);
const users = result.data;
const { page, totalPages, hasNext, hasPrev } = result.meta;
```

### Componente de Paginação (Exemplo React)

```javascript
function Pagination({ meta, onPageChange }) {
  const { page, totalPages, hasNext, hasPrev } = meta;
  
  return (
    <div className="pagination">
      <button 
        onClick={() => onPageChange(page - 1)} 
        disabled={!hasPrev}
      >
        Anterior
      </button>
      
      <span>
        Página {page} de {totalPages}
      </span>
      
      <button 
        onClick={() => onPageChange(page + 1)} 
        disabled={!hasNext}
      >
        Próxima
      </button>
    </div>
  );
}
```

---

## 📊 Modelos de Dados

### User
```typescript
{
  id: string;              // UUID
  name: string;
  email: string;
  role: UserRole;          // "ADMIN" | "GESTOR" | "FISCAL"
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
}
```

### Team
```typescript
{
  id: string;              // UUID
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  collaborators?: Collaborator[];  // Opcional, apenas quando solicitado
}
```

### Collaborator
```typescript
{
  id: string;              // UUID
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Checklist
```typescript
{
  id: string;              // UUID
  module: ModuleType;       // Ver Enums
  name: string;
  description?: string;    // Opcional
  active: boolean;
  createdAt: string;
  updatedAt: string;
  sections?: ChecklistSection[]; // Opcional, apenas quando solicitado
  items?: ChecklistItem[]; // Opcional, apenas quando solicitado
}
```

### ChecklistSection
```typescript
{
  id: string;              // UUID
  checklistId: string;     // UUID
  name: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  items?: ChecklistItem[]; // Opcional, quando solicitado
}
```

### ChecklistItem
```typescript
{
  id: string;              // UUID
  checklistId: string;
  sectionId: string;
  section?: ChecklistSection; // Opcional, quando solicitado
  title: string;
  description?: string;    // Opcional
  order: number;
  requiresPhotoOnNonConformity: boolean;
  active: boolean;
}
```

### Inspection
```typescript
{
  id: string;              // UUID
  module: ModuleType;
  checklistId: string;
  checklist?: Checklist;   // Opcional, quando solicitado
  teamId: string;
  team?: Team;             // Opcional, quando solicitado
  serviceDescription: string;
  locationDescription?: string;  // Opcional
  externalId?: string;      // UUID gerado no frontend (offline-first)
  createdOffline: boolean;
  syncedAt?: string;        // ISO 8601
  status: InspectionStatus; // Ver Enums
  scorePercent?: number;    // null até finalizar, depois 0-100
  createdByUserId: string;
  createdBy?: User;        // Opcional, quando solicitado
  finalizedAt?: string;    // null até finalizar
  createdAt: string;
  updatedAt: string;
  collaborators?: Collaborator[];  // Opcional
  items?: InspectionItem[];        // Opcional
  evidences?: Evidence[];          // Opcional
  signatures?: Signature[];         // Opcional
  pendingAdjustments?: PendingAdjustment[];  // Opcional
}
```

### InspectionItem
```typescript
{
  id: string;              // UUID
  inspectionId: string;
  checklistItemId: string;
  checklistItem?: ChecklistItem;  // Opcional, quando solicitado
  answer?: ChecklistAnswer;        // null | "CONFORME" | "NAO_CONFORME" | "NAO_APLICAVEL"
  notes?: string;          // Opcional
  createdAt: string;
  updatedAt: string;
  evidences?: Evidence[];   // Opcional
}
```

### Evidence
```typescript
{
  id: string;              // UUID
  inspectionId: string;
  inspectionItemId?: string;  // null se for evidência geral
  filePath: string;        // Caminho relativo (ex: "evidences/file.jpg")
  fileName: string;        // Nome original do arquivo
  mimeType: string;        // "image/jpeg", "image/png", etc
  size: number;            // Tamanho em bytes
  createdAt: string;
  uploadedByUserId: string;
}
```

### Signature
```typescript
{
  id: string;              // UUID
  inspectionId: string;
  signerName: string;
  signerRoleLabel: string;  // Geralmente "Lider/Encarregado"
  imagePath: string;        // Caminho relativo
  signedAt: string;        // ISO 8601
}
```

### PendingAdjustment
```typescript
{
  id: string;              // UUID
  inspectionId: string;
  status: PendingStatus;   // "PENDENTE" | "RESOLVIDA"
  resolvedAt?: string;      // null até resolver
  resolvedByUserId?: string;  // null até resolver
  resolvedBy?: User;       // Opcional, quando solicitado
  resolutionNotes?: string;  // null até resolver
  resolutionEvidencePath?: string;  // Opcional
  createdAt: string;
  updatedAt: string;
}
```

---

## 🔢 Enums

### ModuleType
Módulos hardcoded (sem CRUD):
```typescript
"QUALIDADE"
"SEGURANCA_TRABALHO"
"OBRAS_INVESTIMENTO"
"OBRAS_GLOBAL"
"CANTEIRO"
```

### UserRole
```typescript
"ADMIN"    // Acesso total
"GESTOR"   // Pode editar vistorias finalizadas e resolver pendências
"FISCAL"   // Pode criar e finalizar, mas não editar após finalizar
```

### InspectionStatus
```typescript
"RASCUNHO"         // Vistoria em edição
"FINALIZADA"       // Vistoria finalizada sem pendências
"PENDENTE_AJUSTE"  // Vistoria finalizada com itens não conformes
"RESOLVIDA"        // Pendência resolvida
```

### ChecklistAnswer
```typescript
"CONFORME"        // Item está conforme
"NAO_CONFORME"    // Item não está conforme
"NAO_APLICAVEL"   // Item não se aplica
```

### PendingStatus
```typescript
"PENDENTE"   // Pendência aguardando resolução
"RESOLVIDA"  // Pendência resolvida
```

---

## 🛣️ Endpoints

### 🔑 Autenticação

#### POST /auth/login
- **Autenticação:** Não requerida
- **Descrição:** Realiza login e retorna token JWT
- **Request:** Ver seção [Autenticação - Login](#1-login)
- **Response:** Token e dados do usuário

#### GET /auth/me
- **Autenticação:** Requerida
- **Descrição:** Retorna dados do usuário logado
- **Response:** Objeto User

---

### 👥 Usuários

#### GET /users
- **Autenticação:** Requerida (ADMIN apenas)
- **Descrição:** Lista todos os usuários (paginado)
- **Query Parameters:**
  - `page` (opcional): Número da página (padrão: 1)
  - `limit` (opcional): Itens por página (padrão: 10, máximo: 100)
- **Response 200:**
```json
{
  "data": [
    {
      "id": "...",
      "name": "...",
      "email": "...",
      "role": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### POST /users
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "name": "Novo Usuário",
  "email": "usuario@sanorte.com",
  "password": "senha123",
  "role": "FISCAL"
}
```
- **Response 201:** User criado

#### PUT /users/:id
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "name": "Nome Atualizado",
  "email": "novoemail@sanorte.com",
  "role": "GESTOR",
  "password": "novasenha"  // Opcional, se fornecido será hasheado
}
```
- **Response 200:** User atualizado

#### DELETE /users/:id
- **Autenticação:** Requerida (ADMIN apenas)
- **Response 200:** Sem conteúdo

---

### 👨‍👩‍👧‍👦 Equipes

#### GET /teams
- **Autenticação:** Requerida
- **Descrição:** Lista todas as equipes ativas (paginado)
- **Query Parameters:**
  - `page` (opcional): Número da página (padrão: 1)
  - `limit` (opcional): Itens por página (padrão: 10, máximo: 100)
- **Response 200:** PaginatedResponseDto<Team>

#### POST /teams
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "name": "Equipe Alpha",
  "active": true,
  "collaboratorIds": [
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003"
  ]
}
```
- **Notas:**
  - `collaboratorIds` é opcional
  - se informado, associa colaboradores à equipe no momento da criação
- **Response 201:** Team criado

#### PUT /teams/:id
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "name": "Equipe Beta",
  "active": false,
  "collaboratorIds": [
    "550e8400-e29b-41d4-a716-446655440003",
    "550e8400-e29b-41d4-a716-446655440004"
  ]
}
```
- **Notas:**
  - `collaboratorIds` é opcional
  - quando informado, substitui os vínculos atuais da equipe pelos IDs enviados
  - para remover todos os colaboradores da equipe, envie `"collaboratorIds": []`
- **Response 200:** Team atualizado
- **Erros:**
  - `400 Bad Request`: "Um ou mais collaboratorIds informados não existem"

#### DELETE /teams/:id
- **Autenticação:** Requerida (ADMIN apenas)
- **Response 200:** Sem conteúdo

---

### 👤 Colaboradores

#### GET /collaborators
- **Autenticação:** Requerida
- **Descrição:** Lista todos os colaboradores ativos (paginado)
- **Query Parameters:**
  - `page` (opcional): Número da página (padrão: 1)
  - `limit` (opcional): Itens por página (padrão: 10, máximo: 100)
- **Response 200:** PaginatedResponseDto<Collaborator>

#### POST /collaborators
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "name": "João Silva",
  "active": true
}
```
- **Response 201:** Collaborator criado

#### PUT /collaborators/:id
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "name": "João Santos",
  "active": false
}
```
- **Response 200:** Collaborator atualizado

#### DELETE /collaborators/:id
- **Autenticação:** Requerida (ADMIN apenas)
- **Response 200:** Sem conteúdo

---

### ✅ Checklists

#### GET /checklists
- **Autenticação:** Requerida
- **Query Parameters:**
  - `module` (opcional): ModuleType para filtrar
  - `active` (opcional): boolean (`true` ou `false`) para filtrar por status de ativação
  - `page` (opcional): Número da página (padrão: 1)
  - `limit` (opcional): Itens por página (padrão: 10, máximo: 100)
- **Descrição:** Lista checklists (ativos e inativos), opcionalmente filtrados por módulo e status de ativação (paginado)
- **Response 200:** PaginatedResponseDto<Checklist>

**Exemplo:**
```
GET /checklists?module=QUALIDADE
```

**Exemplo (somente ativos):**
```
GET /checklists?module=QUALIDADE&active=true&page=1&limit=100
```

**Exemplo (somente inativos):**
```
GET /checklists?active=false&page=1&limit=100
```

#### GET /checklists/:id
- **Autenticação:** Requerida
- **Descrição:** Retorna checklist com todos os itens
- **Response:** Checklist completo

#### POST /checklists
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "module": "QUALIDADE",
  "name": "Checklist Qualidade - Frente de Serviço",
  "description": "Checklist para vistoria de qualidade em campo",
  "active": true
}
```
- **Response 201:** Checklist criado

#### PUT /checklists/:id
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "name": "Checklist Atualizado",
  "description": "Nova descrição",
  "active": false
}
```
- **Response 200:** Checklist atualizado

#### DELETE /checklists/:id
- **Autenticação:** Requerida (ADMIN apenas)
- **Descrição:** Deleta um checklist por completo
- **Validações:**
  - Não permite exclusão se existir vistoria vinculada ao checklist
- **Response 200:** Sem conteúdo
- **Erros:**
  - `404 Not Found`: "Checklist não encontrado"
  - `400 Bad Request`: "Não é possível deletar checklist com vistorias vinculadas"

#### POST /checklists/:id/items
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "title": "Uso de EPI obrigatório",
  "description": "Verificar se todos estão usando EPI adequado",
  "order": 1,
  "sectionId": "550e8400-e29b-41d4-a716-446655440020",
  "requiresPhotoOnNonConformity": true,
  "active": true
}
```
- **Response 201:** ChecklistItem criado

#### POST /checklists/:id/sections
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "name": "Seção Elétrica",
  "order": 2,
  "active": true
}
```
- **Response 201:** ChecklistSection criado

#### PUT /checklists/:id/sections/:sectionId
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "name": "Seção Elétrica - Atualizada",
  "order": 2,
  "active": true
}
```
- **Response 200:** ChecklistSection atualizado

#### PUT /checklists/:id/items/:itemId
- **Autenticação:** Requerida (ADMIN apenas)
- **Request Body:**
```json
{
  "title": "Título Atualizado",
  "description": "Nova descrição",
  "order": 2,
  "requiresPhotoOnNonConformity": false,
  "active": true
}
```
- **Response 200:** ChecklistItem atualizado

#### DELETE /checklists/:id/items/:itemId
- **Autenticação:** Requerida (ADMIN apenas)
- **Response 200:** Sem conteúdo

---

### 🔍 Vistorias

#### POST /inspections
- **Autenticação:** Requerida (FISCAL ou GESTOR)
- **Request Body:**
```json
{
  "module": "QUALIDADE",
  "checklistId": "550e8400-e29b-41d4-a716-446655440000",
  "teamId": "550e8400-e29b-41d4-a716-446655440001",
  "serviceDescription": "Vistoria de qualidade da frente de concretagem",
  "locationDescription": "Setor A - Bloco 2",
  "externalId": "550e8400-e29b-41d4-a716-446655440100",
  "createdOffline": true,
  "collaboratorIds": [
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003"
  ]
}
```
- **Notas:**
  - `collaboratorIds` é opcional
  - `externalId`, `createdOffline` e `syncedAt` são opcionais para compatibilidade com fluxo offline-first
- **Response 201:** Inspection criada (com items baseados no checklist)

**Comportamento:**
- Cria a vistoria com status `RASCUNHO`
- Cria automaticamente `InspectionItem` para cada item do checklist
- Associa colaboradores se fornecidos

#### GET /inspections
- **Autenticação:** Requerida (ADMIN ou GESTOR)
- **Query Parameters:**
  - `periodFrom` (opcional): `YYYY-MM-DD` - Data inicial (validação: formato de data)
  - `periodTo` (opcional): `YYYY-MM-DD` - Data final (validação: formato de data)
  - `module` (opcional): ModuleType - Valores válidos: `QUALIDADE`, `SEGURANCA_TRABALHO`, `OBRAS_INVESTIMENTO`, `OBRAS_GLOBAL`, `CANTEIRO`
  - `teamId` (opcional): UUID da equipe (validação: UUID v4)
  - `status` (opcional): InspectionStatus - Valores válidos: `RASCUNHO`, `FINALIZADA`, `PENDENTE_AJUSTE`, `RESOLVIDA`
  - `page` (opcional): Número da página (padrão: 1, mínimo: 1)
  - `limit` (opcional): Itens por página (padrão: 10, mínimo: 1, máximo: 100)
- **Descrição:** Lista vistorias com filtros (paginado). Todos os parâmetros são validados automaticamente.
- **Validações:**
  - `status`: Apenas valores do enum `InspectionStatus` são aceitos
  - `module`: Apenas valores do enum `ModuleType` são aceitos
  - `teamId`: Deve ser um UUID válido
  - `periodFrom` e `periodTo`: Devem estar no formato `YYYY-MM-DD`
- **Response 200:** PaginatedResponseDto<Inspection>
- **Erros:**
  - `400 Bad Request`: Se algum parâmetro tiver valor inválido (ex: status inexistente, UUID inválido, data em formato incorreto)

**Exemplo com status:**
```
GET /inspections?status=PENDENTE_AJUSTE&page=1&limit=20
```

**Exemplo com múltiplos filtros:**
```
GET /inspections?status=FINALIZADA&module=QUALIDADE&periodFrom=2024-01-01&periodTo=2024-12-31
```

**Exemplo:**
```
GET /inspections?periodFrom=2024-01-01&periodTo=2024-12-31&module=QUALIDADE&status=FINALIZADA
```

#### GET /inspections/mine
- **Autenticação:** Requerida (FISCAL apenas)
- **Query Parameters:**
  - `page` (opcional): Número da página (padrão: 1)
  - `limit` (opcional): Itens por página (padrão: 10, máximo: 100)
- **Descrição:** Lista vistorias criadas pelo fiscal logado (paginado)
- **Response 200:** PaginatedResponseDto<Inspection>

#### GET /inspections/:id
- **Autenticação:** Requerida
- **Descrição:** Retorna vistoria completa com todas as relações
- **Response:** Inspection completo (com checklist, team, items, evidences, signatures, etc)

#### PUT /inspections/:id
- **Autenticação:** Requerida
- **Permissões:**
  - FISCAL: apenas se status = `RASCUNHO`
  - GESTOR/ADMIN: sempre
- **Request Body:**
```json
{
  "serviceDescription": "Descrição atualizada",
  "locationDescription": "Nova localização"
}
```
- **Response 200:** Inspection atualizado

**Erros:**
- `403 Forbidden`: FISCAL tentando editar vistoria finalizada

#### PUT /inspections/:id/items
- **Autenticação:** Requerida
- **Descrição:** Atualiza respostas dos itens em lote
- **Request Body:**
```json
[
  {
    "inspectionItemId": "550e8400-e29b-41d4-a716-446655440010",
    "answer": "CONFORME",
    "notes": "Tudo ok"
  },
  {
    "inspectionItemId": "550e8400-e29b-41d4-a716-446655440011",
    "answer": "NAO_CONFORME",
    "notes": "Falta EPI"
  },
  {
    "inspectionItemId": "550e8400-e29b-41d4-a716-446655440012",
    "answer": "NAO_APLICAVEL",
    "notes": null
  }
]
```
- **Validações:**
  - Vistoria deve estar com status `RASCUNHO`
- **Response 200:** Array de InspectionItem atualizados

#### POST /inspections/:id/evidences
- **Autenticação:** Requerida
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `file` (obrigatório): Arquivo de imagem (JPG, PNG, WEBP)
  - `inspectionItemId` (opcional): UUID do item relacionado
- **Validações:**
  - Arquivo máximo: 5MB
  - Formatos aceitos: jpg, jpeg, png, webp
  - Vistoria deve estar com status `RASCUNHO`
- **Response 201:** Evidence criado

**Exemplo JavaScript:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('inspectionItemId', '550e8400-e29b-41d4-a716-446655440010');

const response = await fetch(`http://localhost:3000/inspections/${inspectionId}/evidences`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

#### POST /inspections/:id/signature
- **Autenticação:** Requerida
- **Request Body:**
```json
{
  "signerName": "João Silva",
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
}
```
- **Descrição:** Adiciona assinatura digital (imagem em base64)
- **Validações:**
  - Vistoria deve estar com status `RASCUNHO`
- **Response 201:** Signature criado

**Nota:** A imagem deve ser enviada em base64 (sem o prefixo `data:image/png;base64,`)

#### POST /inspections/:id/finalize
- **Autenticação:** Requerida (FISCAL ou GESTOR)
- **Descrição:** Finaliza a vistoria
- **Validações Obrigatórias:**
  1. Assinatura do líder/encarregado deve existir
  2. Itens `NAO_CONFORME` com `requiresPhotoOnNonConformity = true` devem ter pelo menos 1 evidência
- **Comportamento:**
  - Calcula percentual de conformidade
  - Se houver itens `NAO_CONFORME`, status vira `PENDENTE_AJUSTE` e cria `PendingAdjustment`
  - Se não houver `NAO_CONFORME`, status vira `FINALIZADA`
  - Define `finalizedAt` com data/hora atual
- **Response 200:** Inspection finalizado

**Erros:**
- `400 Bad Request`: "Assinatura do líder/encarregado é obrigatória para finalizar"
- `400 Bad Request`: "Item 'X' requer foto de evidência quando não conforme"
- `400 Bad Request`: "Vistoria já foi finalizada"

#### POST /inspections/:id/resolve
- **Autenticação:** Requerida (GESTOR ou ADMIN)
- **Request Body:**
```json
{
  "resolutionNotes": "Problema corrigido. EPI fornecido e treinamento realizado.",
  "resolutionEvidence": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
}
```
- **Descrição:** Resolve pendência de ajuste
- **Validações:**
  - Vistoria deve estar com status `PENDENTE_AJUSTE`
- **Comportamento:**
  - Atualiza `PendingAdjustment` para `RESOLVIDA`
  - Atualiza status da vistoria para `RESOLVIDA`
  - Define `resolvedAt` e `resolvedByUserId`
- **Response 200:** Inspection resolvido

**Erros:**
- `400 Bad Request`: "Vistoria não está pendente de ajuste"

#### GET /inspections/:id/pdf
- **Autenticação:** Requerida
- **Descrição:** Gera e retorna PDF da vistoria
- **Response:** Arquivo PDF (Content-Type: `application/pdf`)
- **Headers:**
  - `Content-Disposition: attachment; filename=vistoria-{id}.pdf`

**Exemplo JavaScript:**
```javascript
const response = await fetch(`http://localhost:3000/inspections/${inspectionId}/pdf`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `vistoria-${inspectionId}.pdf`;
a.click();
```

#### POST /sync/inspections
- **Autenticação:** Requerida (FISCAL, GESTOR ou ADMIN)
- **Descrição:** Sincroniza vistorias geradas offline em lote com idempotência por `externalId`
- **Comportamento:**
  - faz upsert por `externalId` (retry seguro, sem duplicação de vistoria)
  - atualiza itens/evidências/assinatura quando enviados
  - pode finalizar a vistoria no mesmo payload (`finalize: true`)
  - retorna resultado por registro sincronizado
- **Request Body:**
```json
{
  "inspections": [
    {
      "externalId": "550e8400-e29b-41d4-a716-446655440100",
      "module": "QUALIDADE",
      "checklistId": "550e8400-e29b-41d4-a716-446655440000",
      "teamId": "550e8400-e29b-41d4-a716-446655440001",
      "serviceDescription": "Vistoria de qualidade coletada offline",
      "locationDescription": "Setor A",
      "createdOffline": true,
      "syncedAt": "2026-02-16T12:00:00.000Z",
      "items": [
        {
          "checklistItemId": "550e8400-e29b-41d4-a716-446655440010",
          "answer": "CONFORME",
          "notes": "ok"
        },
        {
          "checklistItemId": "550e8400-e29b-41d4-a716-446655440011",
          "answer": "NAO_CONFORME",
          "notes": "ajuste necessário"
        }
      ],
      "evidences": [
        {
          "inspectionItemId": "550e8400-e29b-41d4-a716-446655440011",
          "filePath": "evidences/offline-item-2.jpg",
          "fileName": "offline-item-2.jpg",
          "mimeType": "image/jpeg",
          "size": 120031
        }
      ],
      "signature": {
        "signerName": "João Silva",
        "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      },
      "finalize": true
    }
  ]
}
```
- **Response 200:**
```json
{
  "results": [
    {
      "externalId": "550e8400-e29b-41d4-a716-446655440100",
      "serverId": "550e8400-e29b-41d4-a716-446655440999",
      "status": "CREATED"
    }
  ]
}
```
- **Observações importantes:**
  - retries com o mesmo `externalId` retornam `UPDATED` para o mesmo `serverId` (sem duplicar vistoria)
  - se `finalize=true`, aplicam-se as mesmas validações de `POST /inspections/:id/finalize`
- **Status por item sincronizado:**
  - `CREATED`
  - `UPDATED`
  - `ERROR`

---

### 📊 Dashboards

#### GET /dashboards/summary
- **Autenticação:** Requerida
- **Query Parameters:**
  - `from` (opcional): `YYYY-MM-DD` - Data inicial
  - `to` (opcional): `YYYY-MM-DD` - Data final
  - `module` (opcional): ModuleType
  - `teamId` (opcional): UUID da equipe
- **Descrição:** Retorna resumo geral das vistorias
- **Response:**
```json
{
  "averagePercent": 85.5,
  "inspectionsCount": 150,
  "pendingCount": 12
}
```

**Nota:** Considera apenas vistorias finalizadas (exclui `RASCUNHO`)

#### GET /dashboards/ranking/teams
- **Autenticação:** Requerida
- **Query Parameters:**
  - `from` (opcional): `YYYY-MM-DD`
  - `to` (opcional): `YYYY-MM-DD`
  - `module` (opcional): ModuleType
- **Descrição:** Retorna ranking de equipes por percentual médio
- **Response:**
```json
[
  {
    "teamId": "550e8400-e29b-41d4-a716-446655440001",
    "teamName": "Equipe Alpha",
    "averagePercent": 92.5,
    "inspectionsCount": 45,
    "pendingCount": 2
  },
  {
    "teamId": "550e8400-e29b-41d4-a716-446655440002",
    "teamName": "Equipe Beta",
    "averagePercent": 88.3,
    "inspectionsCount": 38,
    "pendingCount": 5
  }
]
```

**Nota:** Ordenado por `averagePercent` decrescente

---

## ⚖️ Regras de Negócio

### Cálculo de Percentual de Conformidade

**Fórmula:**
```
Itens avaliados = itens com answer != "NAO_APLICAVEL"
Percentual = (qtd CONFORME / qtd avaliados) * 100
```

**Casos especiais:**
- Se não houver itens avaliados (todos `NAO_APLICAVEL`), percentual = **100** (decisão prática)

**Exemplo:**
- Total de itens: 10
- CONFORME: 7
- NAO_CONFORME: 2
- NAO_APLICAVEL: 1
- Itens avaliados: 9 (7 + 2)
- Percentual: (7 / 9) * 100 = **77.78%**

### Idempotência para Offline-First

- Cada vistoria pode carregar `externalId` (UUID gerado no frontend)
- O backend garante unicidade de `externalId` no banco
- Reenvio do mesmo registro via `POST /sync/inspections` atualiza a vistoria existente em vez de duplicar

### Pendência Automática

Quando uma vistoria é finalizada:

1. **Se houver pelo menos 1 item `NAO_CONFORME`:**
   - Status da vistoria vira `PENDENTE_AJUSTE`
   - Cria ou atualiza `PendingAdjustment` com status `PENDENTE`

2. **Se não houver `NAO_CONFORME`:**
   - Status da vistoria vira `FINALIZADA`

### Validações ao Finalizar

1. **Assinatura obrigatória:**
   - Deve existir pelo menos 1 `Signature` vinculado à vistoria
   - Erro: `400 - "Assinatura do líder/encarregado é obrigatória para finalizar"`

2. **Evidências para não conformidades:**
   - Se um item tem `answer = "NAO_CONFORME"` e `checklistItem.requiresPhotoOnNonConformity = true`
   - Deve existir pelo menos 1 `Evidence` vinculado a esse `InspectionItem`
   - Erro: `400 - "Item 'X' requer foto de evidência quando não conforme"`

### Permissões por Role

#### FISCAL
- ✅ Criar vistoria
- ✅ Editar vistoria (apenas se status = `RASCUNHO`)
- ✅ Finalizar vistoria
- ❌ Editar vistoria finalizada
- ❌ Resolver pendências
- ✅ Ver apenas suas próprias vistorias (`/inspections/mine`)

#### GESTOR
- ✅ Criar vistoria
- ✅ Editar vistoria (sempre)
- ✅ Finalizar vistoria
- ✅ Resolver pendências
- ✅ Ver todas as vistorias (`/inspections`)

#### ADMIN
- ✅ Todas as permissões do GESTOR
- ✅ Gerenciar usuários (`/users`)
- ✅ Gerenciar equipes (`/teams`)
- ✅ Gerenciar colaboradores (`/collaborators`)
- ✅ Gerenciar checklists (`/checklists`)

---

## 🚨 Tratamento de Erros

### Formato de Erro

A API retorna erros no seguinte formato:

```json
{
  "statusCode": 400,
  "message": "Mensagem de erro descritiva",
  "error": "Bad Request"
}
```

### Erros Comuns

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Causas:**
- Token ausente
- Token inválido
- Token expirado

**Solução:** Fazer novo login

#### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```
**Causas:**
- Usuário sem permissão para a ação
- FISCAL tentando editar vistoria finalizada

#### 400 Bad Request - Validação
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 6 characters"
  ],
  "error": "Bad Request"
}
```

#### 400 Bad Request - Regra de Negócio
```json
{
  "statusCode": 400,
  "message": "Assinatura do líder/encarregado é obrigatória para finalizar",
  "error": "Bad Request"
}
```

#### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Vistoria não encontrada",
  "error": "Not Found"
}
```

### Tratamento no Frontend

**Exemplo com try/catch:**
```javascript
try {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro na requisição');
  }
  
  const data = await response.json();
  return data;
} catch (error) {
  console.error('Erro:', error.message);
  // Tratar erro (mostrar toast, etc)
  throw error;
}
```

**Exemplo com interceptor (Axios):**
```javascript
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado, redirecionar para login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 🔄 Exemplos de Fluxos

### Fluxo 1: Criar e Finalizar Vistoria (FISCAL)

1. **Login**
```javascript
POST /auth/login
→ Recebe token
```

2. **Listar Checklists**
```javascript
GET /checklists?module=QUALIDADE
→ Seleciona um checklist
```

3. **Listar Equipes**
```javascript
GET /teams
→ Seleciona uma equipe
```

4. **Criar Vistoria**
```javascript
POST /inspections
{
  module: "QUALIDADE",
  checklistId: "...",
  teamId: "...",
  serviceDescription: "...",
  externalId: "...",      // opcional para fluxo offline-first
  createdOffline: true
}
→ Recebe vistoria com items criados automaticamente
```

5. **Atualizar Respostas dos Itens**
```javascript
PUT /inspections/:id/items
[
  { inspectionItemId: "...", answer: "CONFORME", notes: "Ok" },
  { inspectionItemId: "...", answer: "NAO_CONFORME", notes: "Acabamento fora do padrão" }
]
```

6. **Upload de Evidência para Item Não Conforme**
```javascript
POST /inspections/:id/evidences
FormData: { file: ..., inspectionItemId: "..." }
```

7. **Adicionar Assinatura**
```javascript
POST /inspections/:id/signature
{
  signerName: "João Silva",
  imageBase64: "..."
}
```

8. **Finalizar Vistoria**
```javascript
POST /inspections/:id/finalize
→ Status vira FINALIZADA ou PENDENTE_AJUSTE
```

### Fluxo 2: Resolver Pendência (GESTOR)

1. **Listar Vistorias Pendentes**
```javascript
GET /inspections?status=PENDENTE_AJUSTE
```

2. **Ver Detalhes da Vistoria**
```javascript
GET /inspections/:id
→ Ver itens não conformes
```

3. **Resolver Pendência**
```javascript
POST /inspections/:id/resolve
{
  resolutionNotes: "Não conformidade corrigida e validada em campo.",
  resolutionEvidence: "..." // Opcional
}
→ Status vira RESOLVIDA
```

### Fluxo 3: Dashboard (GESTOR/ADMIN)

1. **Resumo Geral**
```javascript
GET /dashboards/summary?from=2024-01-01&to=2024-12-31
→ { averagePercent, inspectionsCount, pendingCount }
```

2. **Ranking de Equipes**
```javascript
GET /dashboards/ranking/teams?from=2024-01-01&to=2024-12-31
→ Array ordenado por percentual
```

### Fluxo 4: Sincronização Offline (FISCAL)

1. **Criar vistoria local no app (offline)**
```javascript
// frontend gera externalId UUID
inspection.externalId = "550e8400-e29b-41d4-a716-446655440100"
```

2. **Coletar respostas/evidências/assinatura localmente**
```javascript
// dados ficam no storage local do app até haver conexão
```

3. **Sincronizar em lote quando online**
```javascript
POST /sync/inspections
{
  inspections: [ ... ]
}
→ retorna mapping externalId -> serverId
```

4. **Retry seguro em caso de falha parcial**
```javascript
POST /sync/inspections
// reenviar mesmos registros com mesmo externalId
→ backend atualiza, sem criar duplicidade
```

---

## 📤 Upload de Arquivos

### Evidências

**Endpoint:** `POST /inspections/:id/evidences`

**Formato:** `multipart/form-data`

**Campos:**
- `file` (obrigatório): Arquivo de imagem
- `inspectionItemId` (opcional): UUID do item relacionado

**Limitações:**
- Tamanho máximo: **5MB**
- Formatos aceitos: **JPG, JPEG, PNG, WEBP**

**Exemplo Completo:**
```javascript
async function uploadEvidence(inspectionId, file, inspectionItemId = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (inspectionItemId) {
    formData.append('inspectionItemId', inspectionItemId);
  }

  const response = await fetch(
    `http://localhost:3000/inspections/${inspectionId}/evidences`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao fazer upload');
  }

  return await response.json();
}

// Uso
const fileInput = document.querySelector('input[type="file"]');
await uploadEvidence(
  inspectionId,
  fileInput.files[0],
  inspectionItemId
);
```

**Validação de Arquivo no Frontend:**
```javascript
function validateFile(file) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (file.size > maxSize) {
    throw new Error('Arquivo muito grande. Máximo: 5MB');
  }
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Formato não suportado. Use: JPG, PNG ou WEBP');
  }
  
  return true;
}
```

### Assinatura (Base64)

**Endpoint:** `POST /inspections/:id/signature`

**Formato:** JSON com imagem em base64

**Conversão de Canvas para Base64:**
```javascript
// Assumindo um canvas de assinatura
const canvas = document.getElementById('signatureCanvas');
const imageBase64 = canvas.toDataURL('image/png').split(',')[1]; // Remove prefixo

await fetch(`http://localhost:3000/inspections/${inspectionId}/signature`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    signerName: 'João Silva',
    imageBase64: imageBase64
  })
});
```

**Conversão de File para Base64:**
```javascript
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // Remove prefixo
      resolve(base64);
    };
    reader.onerror = reject;
  });
}

// Uso
const base64 = await fileToBase64(fileInput.files[0]);
```

---

## 📥 Download de PDF

**Endpoint:** `GET /inspections/:id/pdf`

**Response:** Arquivo PDF binário

**Exemplo Completo:**
```javascript
async function downloadPdf(inspectionId) {
  const response = await fetch(
    `http://localhost:3000/inspections/${inspectionId}/pdf`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao gerar PDF');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vistoria-${inspectionId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
```

**Com Axios:**
```javascript
const response = await axios.get(
  `/inspections/${inspectionId}/pdf`,
  {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob'
  }
);

const url = window.URL.createObjectURL(new Blob([response.data]));
const link = document.createElement('a');
link.href = url;
link.setAttribute('download', `vistoria-${inspectionId}.pdf`);
document.body.appendChild(link);
link.click();
```

---

## 🔧 Utilitários para Frontend

### Cliente HTTP (Exemplo)

```javascript
class ApiClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Erro na requisição'
      }));
      throw new Error(error.message || 'Erro desconhecido');
    }

    // Se for download de PDF, retornar blob
    if (response.headers.get('content-type')?.includes('application/pdf')) {
      return await response.blob();
    }

    return await response.json();
  }

  // Métodos auxiliares
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Upload de arquivo
  async uploadFile(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('file', file);
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    return this.request(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
        // Não definir Content-Type, o browser define automaticamente com boundary
      },
      body: formData
    });
  }
}

// Uso
const api = new ApiClient();

// Login
const { accessToken, user } = await api.post('/auth/login', {
  email: 'fiscal@sanorte.com',
  password: 'senha123'
});
api.setToken(accessToken);

// Listar vistorias
const inspections = await api.get('/inspections/mine');

// Criar vistoria
const inspection = await api.post('/inspections', {
  module: 'QUALIDADE',
  checklistId: '...',
  teamId: '...',
  serviceDescription: '...'
});
```

### Helpers de Validação

```javascript
// Validar email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validar UUID
function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

// Validar data (YYYY-MM-DD)
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// Formatar percentual
function formatPercent(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toFixed(2)}%`;
}

// Formatar data
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}
```

### Constantes

```javascript
export const MODULE_TYPES = {
  QUALIDADE: 'QUALIDADE',
  SEGURANCA_TRABALHO: 'SEGURANCA_TRABALHO',
  OBRAS_INVESTIMENTO: 'OBRAS_INVESTIMENTO',
  OBRAS_GLOBAL: 'OBRAS_GLOBAL',
  CANTEIRO: 'CANTEIRO'
};

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  GESTOR: 'GESTOR',
  FISCAL: 'FISCAL'
};

export const INSPECTION_STATUS = {
  RASCUNHO: 'RASCUNHO',
  FINALIZADA: 'FINALIZADA',
  PENDENTE_AJUSTE: 'PENDENTE_AJUSTE',
  RESOLVIDA: 'RESOLVIDA'
};

export const CHECKLIST_ANSWER = {
  CONFORME: 'CONFORME',
  NAO_CONFORME: 'NAO_CONFORME',
  NAO_APLICAVEL: 'NAO_APLICAVEL'
};

export const PENDING_STATUS = {
  PENDENTE: 'PENDENTE',
  RESOLVIDA: 'RESOLVIDA'
};
```

---

## 📝 Notas Importantes

### 1. IDs e Relacionamentos

- Todos os IDs são UUIDs
- Ao criar uma vistoria, os `InspectionItem` são criados automaticamente baseados no checklist
- Não é necessário criar `InspectionItem` manualmente

### 2. Status da Vistoria

- `RASCUNHO`: Pode editar tudo
- `FINALIZADA`: FISCAL não pode editar, GESTOR/ADMIN podem
- `PENDENTE_AJUSTE`: Aguardando resolução
- `RESOLVIDA`: Pendência resolvida

### 3. Percentual de Conformidade

- Calculado automaticamente ao finalizar
- Considera apenas itens avaliados (não `NAO_APLICAVEL`)
- Se não houver itens avaliados, retorna 100%

### 4. Upload de Arquivos

- Evidências: multipart/form-data
- Assinatura: JSON com base64
- Tamanho máximo: 5MB
- Formatos: JPG, PNG, WEBP

### 5. Filtros de Data

- Formato: `YYYY-MM-DD`
- Exemplo: `2024-01-15`
- Use sempre UTC ou ajuste no frontend

### 6. Paginação

**✅ Implementada em todas as listagens:**
- GET /users
- GET /teams
- GET /collaborators
- GET /checklists
- GET /inspections
- GET /inspections/mine

Todos os endpoints de listagem retornam dados paginados com metadados (total, totalPages, hasNext, hasPrev).

### 7. CORS

- A API está configurada para aceitar requisições de qualquer origem em desenvolvimento
- Em produção, configure CORS adequadamente

---

## 🆘 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do servidor
2. Confirme que o token está válido
3. Verifique as permissões do usuário
4. Valide os dados enviados

---

**Última atualização:** 2026-02-16
**Versão da API:** 1.1.0
