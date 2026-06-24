# Arquitetura — Sanorte Vistorias (Backend)

API REST em **NestJS** para gestão de vistorias de campo, cadastros operacionais, dashboards analíticos e relatórios. Persistência em **PostgreSQL** via **TypeORM**.

## Visão geral

```
┌──────────────────────────────────────────────────────────────┐
│                     Clientes (HTTP)                          │
│          sanorte-vistorias (SPA)  |  sync offline            │
└────────────────────────────┬─────────────────────────────────┘
                             │ JWT Bearer
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Controllers          Rotas REST + guards (JWT + Roles)    │
├──────────────────────────────────────────────────────────────┤
│  Services             Regras de negócio, transações        │
├──────────────────────────────────────────────────────────────┤
│  TypeORM Repositories Entidades + queries                    │
├──────────────────────────────────────────────────────────────┤
│  PostgreSQL           Schema versionado por migrations       │
└──────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   Cloudinary (uploads)            Sentry (monitoramento)
```

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | NestJS 10 |
| ORM | TypeORM |
| Banco | PostgreSQL |
| Auth | Passport JWT |
| Upload | Cloudinary (via `cloudinary` + `multer`) |
| Monitoramento | Sentry |
| Testes | Jest |

## Bootstrap e infraestrutura transversal

`src/main.ts` configura:

- **ValidationPipe** global (`whitelist`, `forbidNonWhitelisted`, `transform`)
- **CORS** habilitado
- **HttpLoggingInterceptor** — log estruturado de requisições
- **GlobalExceptionFilter** — respostas de erro padronizadas
- **Sentry** — inicializado via `initSentry()` quando `SENTRY_DSN` está definido

Configuração via `@nestjs/config` (`app.config`, variáveis de ambiente).

## Módulos NestJS

Cada domínio segue o padrão `*.module.ts` + `*.controller.ts` + `*.service.ts` + `dto/`.

| Módulo | Responsabilidade |
|--------|------------------|
| `auth` | Login, JWT, guards (`JwtAuthGuard`, `RolesGuard`) |
| `users` | CRUD de usuários (ADMIN) |
| `teams` | Equipes vinculadas a contratos |
| `sectors` | Setores (ESGOTO, AGUA, REPOSICAO + customizados) |
| `collaborators` | Colaboradores por setor/contrato |
| `checklists` | Checklists, seções e itens |
| `inspections` | Ciclo de vida de vistorias + sync offline |
| `dashboards` | KPIs, rankings, analytics |
| `service-orders` | Ordens de serviço e importação |
| `contracts` | Contratos e escopo de acesso |
| `investment-works` | Obras de investimento |
| `reports` | Tipos e registros de relatórios de engenharia |
| `uploads` / `files` / `cloudinary` | Upload e armazenamento de mídia |
| `monitoring` | Smoke test Sentry |

`AppModule` (`src/app.module.ts`) registra todos os módulos e a conexão TypeORM assíncrona.

## Modelo de dados (entidades)

Entidades em `src/entities/`:

```
User ──────────────┐
Team ──────────────┼── Inspection ── InspectionItem
Collaborator ──────┤       │              │
Checklist ─────────┘       │              └── Evidence
  ├── ChecklistSection     ├── Signature
  └── ChecklistItem        ├── PendingAdjustment
Sector                     ├── ServiceOrder (opcional)
Contract                   ├── Contract (opcional)
InvestmentWork             └── InvestmentWork (opcional)

ReportType ── ReportTypeField
ReportRecord ── ReportFile
```

### Entidade central: `Inspection`

Campos relevantes:

- `module` (`ModuleType`): CAMPO, REMOTO, POS_OBRA, SEGURANCA_TRABALHO, OBRAS_INVESTIMENTO
- `inspectionScope`: TEAM ou COLLABORATOR
- `status`: RASCUNHO → FINALIZADA | PENDENTE_AJUSTE → RESOLVIDA
- `externalId`: identificador idempotente para sync offline
- `scorePercent`: nota recalculada ao atualizar itens
- Relacionamentos opcionais: `serviceOrder`, `contract`, `investmentWork`

## Autenticação e autorização

```
Request → JwtAuthGuard (valida token) → RolesGuard (@Roles(...)) → Controller
```

- `POST /auth/login` — retorna `accessToken` + `user`
- `GET /auth/me` — dados do usuário autenticado
- Token enviado em `Authorization: Bearer <token>`

Roles (`UserRole`): `ADMIN`, `GESTOR`, `SUPERVISOR`, `FISCAL`.

Regras típicas:

- Endpoints de administração: `@Roles(UserRole.ADMIN)`
- Criação/edição de vistorias: FISCAL, GESTOR, SUPERVISOR (varia por operação)
- FISCAL só edita vistoria em `RASCUNHO`
- Listagem geral (`GET /inspections`) não expõe rascunhos

## Fluxo de vistoria (regras server-side)

Implementado principalmente em `inspections/inspections.service.ts`:

```
POST /inspections          → RASCUNHO
PUT  /inspections/:id/items → recalcula scorePercent
POST /inspections/:id/evidences
POST /inspections/:id/signature
POST /inspections/:id/paralyze   → penalidade 25% na nota
POST /inspections/:id/unparalyze → remove penalidade (GESTOR/SUPERVISOR/ADMIN)
POST /inspections/:id/finalize   → FINALIZADA ou PENDENTE_AJUSTE
POST /inspections/:id/items/:itemId/resolve
POST /inspections/:id/resolve    → RESOLVIDA
```

### Regras críticas

| Regra | Comportamento |
|-------|---------------|
| Finalização | Exige assinatura; evidência obrigatória para `NAO_CONFORME` quando `requiresPhotoOnNonConformity` |
| SEGURANCA_TRABALHO | Não gera `PENDENTE_AJUSTE`; `teamId` opcional; mantém `FINALIZADA` com não conformidades |
| Paralisação | Penalidade persistente de 25% em `scorePercent` |
| Reavaliação por gestor | Atualizar itens em FINALIZADA/PENDENTE_AJUSTE reavalia status (exceto ST) |
| Sync offline | `POST /sync/inspections` — idempotente por `externalId`; sem assets em `dataUrl` |

## Controllers auxiliares

- **`sync.controller.ts`** — endpoint dedicado para sincronização em lote (campo/offline)
- **`dashboards.controller.ts`** — agregações para gráficos e rankings (queries otimizadas com índices dedicados)
- **`service-orders`** — importação via parser (`service-order-import-parser.service.ts`)

## Persistência e migrations

- Configuração: `src/config/database.config.ts`, `typeorm.config.ts`
- **Nunca** alterar entidade sem migration em `src/database/migrations/`
- Seed: `src/database/seeds/run-seed.ts` (usuários, setores, dados de exemplo)

Comandos:

```bash
npm run migration:generate -- src/database/migrations/NomeDaMigration
npm run migration:run
npm run seed
```

## DTOs e validação

Entrada validada com `class-validator` nos DTOs de cada módulo (`dto/`). O `ValidationPipe` global rejeita campos não declarados nos DTOs.

Listagens usam DTOs de filtro (`FilterInspectionsDto`, etc.) com paginação padrão.

## Paginação

Resposta padrão:

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

## Uploads

- `POST /uploads` — multipart, autenticado; envia para Cloudinary
- Evidências de vistoria: `POST /inspections/:id/evidences` (multipart)
- Assinatura: `POST /inspections/:id/signature` (JSON com imagem base64 ou URL)

## Testes

Testes unitários junto aos services (`*.spec.ts`):

- `inspections.service.spec.ts` — fluxos principais
- `inspections.service.business-rules.spec.ts` — regras de negócio
- `dashboards.service.spec.ts`, `dashboards.controller.spec.ts`
- `uploads.controller.spec.ts`

Executar: `npm test`

## Monitoramento

- Sentry configurado via variáveis `SENTRY_*`
- `GET /monitoring/sentry-smoke-test` — protegido por header `x-monitoring-token`
- Release automática em Heroku via `HEROKU_SLUG_COMMIT` / `SOURCE_VERSION`

## Enums compartilhados

Definidos em `src/common/enums/`:

- `user-role.enum.ts`
- `module-type.enum.ts`
- `inspection-status`, `inspection-scope`, etc.

Devem permanecer alinhados com `sanorte-vistorias/src/domain/enums.ts`.

## Documentação de API

Payloads completos de request/response: `API_DOCUMENTATION.md`.

## Relacionamento com o ecossistema

Este repositório é a **API e camada de persistência**. O monorepo local (`sanorte/`) também contém:

- `sanorte-vistorias/` — SPA React (cliente principal)
- `specs/` — especificações de produto
- `AGENTS.md` — guia consolidado
