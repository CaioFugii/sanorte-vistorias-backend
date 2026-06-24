# Sanorte Vistorias — Guia para Agentes (Backend)

Guia para agentes e desenvolvedores trabalhando neste repositório: **API REST NestJS** da plataforma **Gestão Operacional** da Sanorte Infraestrutura.

## Contexto do ecossistema

Este repositório é a **fonte de verdade** para persistência e regras server-side. Repositórios relacionados:

| Repositório | Papel |
|-------------|-------|
| `sanorte-vistorias` | SPA React — consome esta API |
| `specs/` (monorepo local) | Épicos e histórias de produto — consultar antes de features novas |

Documentação deste repo:

| Arquivo | Conteúdo |
|---------|----------|
| `README.md` | Setup, endpoints e regras resumidas |
| `ARCHITECTURE.md` | Módulos, entidades, infraestrutura |
| `DOMAIN.md` | Enums, entidades e regras de negócio |
| `CHANGELOG.md` | Histórico de versões |
| `API_DOCUMENTATION.md` | Payloads completos de request/response |
| `.skills/node-memory-audit.md` | Auditoria de memória (Heroku) |

---

## Stack

- NestJS 10, TypeORM, PostgreSQL
- JWT (Passport), Cloudinary (uploads), Sentry (monitoramento)
- Jest (testes unitários)

---

## Estrutura do código

```
src/
├── auth/              Login, JWT, guards
├── users/             CRUD usuários
├── teams/             Equipes
├── sectors/           Setores
├── collaborators/     Colaboradores
├── checklists/        Checklists, seções, itens
├── inspections/       Vistorias, sync, regras de domínio
├── dashboards/        KPIs e rankings
├── service-orders/    Ordens de serviço + importação
├── contracts/         Contratos
├── investment-works/  Obras de investimento
├── reports/           Relatórios de engenharia
├── uploads/           Upload multipart
├── cloudinary/        Integração Cloudinary
├── monitoring/        Smoke test Sentry
├── entities/          Entidades TypeORM
├── common/enums/      Enums compartilhados
├── database/
│   ├── migrations/    Alterações de schema
│   └── seeds/         Dados iniciais
└── config/            Database, TypeORM, app
```

Padrão por domínio: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`.

Regras puras de vistoria: `inspections/inspection-domain.service.ts`.  
Orquestração: `inspections/inspections.service.ts`.

---

## Padrões obrigatórios

### Alterações de schema

**Nunca** altere entidade sem migration.

```bash
npm run migration:generate -- src/database/migrations/NomeDaMigration
npm run migration:run
```

### Validação

- DTOs com `class-validator` em cada módulo (`dto/`)
- `ValidationPipe` global: `whitelist`, `forbidNonWhitelisted`, `transform`

### Autorização

```
Request → JwtAuthGuard → RolesGuard (@Roles(...)) → Controller
```

Guards em controllers definem quem acessa cada endpoint. O frontend espelha permissões em menu/rotas — manter alinhado.

### Testes

- Testes unitários junto ao service (`*.spec.ts`)
- Rodar `npm test` após mudanças em services
- Regras de vistoria: `inspections.service.spec.ts`, `inspections.service.business-rules.spec.ts`

---

## Produto (resumo)

### Módulos de vistoria (`ModuleType`)

Ativos: `CAMPO`, `REMOTO`, `POS_OBRA`, `SEGURANCA_TRABALHO`, `OBRAS_INVESTIMENTO`.  
Valores legados no banco: `QUALIDADE`, `OBRAS_GLOBAL`, `CANTEIRO`.

### Perfis (`UserRole`)

`ADMIN` | `GESTOR` | `SUPERVISOR` | `FISCAL`

Seed (senha `senha123`): `admin@sanorte.com`, `gestor@sanorte.com`, `supervisor@sanorte.com`, `fiscal@sanorte.com`.

Setores seed: `ESGOTO`, `AGUA`, `REPOSICAO`.

### Status de vistoria

`RASCUNHO` → `FINALIZADA` | `PENDENTE_AJUSTE` → `RESOLVIDA`

Detalhes completos: `DOMAIN.md`.

---

## Regras de negócio críticas

1. **Setores** — colaboradores e checklists vinculados por `sectorId`; setor não deletável se em uso.
2. **Checklist** — `inspectionScope`: `TEAM` (padrão) ou `COLLABORATOR`.
3. **FISCAL** — edita vistoria apenas em `RASCUNHO`.
4. **Criação** — `teamId` obrigatório exceto `SEGURANCA_TRABALHO`; `serviceDescription` obrigatório exceto `REMOTO`.
5. **Equipe empreiteira** (`isContractor`) — não aceita colaboradores vinculados.
6. **Finalização** — evidência obrigatória para `NAO_CONFORME` com `requiresPhotoOnNonConformity`; assinatura validada no frontend, não no `finalize` server-side.
7. **SEGURANCA_TRABALHO** e **REMOTO** — não geram `PENDENTE_AJUSTE` (`resolveFinalStatus`).
8. **Paralisação** — penalidade persistente de 25% (`scorePercent × 0.75`); removível via `unparalyze` (GESTOR/SUPERVISOR/ADMIN).
9. **Pendências** — resolução item a item; `POST .../resolve` só quando todos NC tiverem `resolvedAt`.
10. **Sync offline** — idempotente por `externalId`; não aceita assets em `dataUrl`.
11. **Paginação** — `{ data, meta: { page, limit, total, totalPages, hasNext, hasPrev } }`.

Cálculo de nota: `InspectionDomainService.calculateScorePercent` + `applyParalysisPenalty`.

---

## Setup e comandos

```bash
npm install
# Criar .env: DB_*, JWT_*, CLOUDINARY_URL, SENTRY_*, PORT=3000
npm run migration:run
npm run seed
npm run start:dev
```

API em `http://localhost:3000`. Auth: `Authorization: Bearer <token>`.

| Script | Uso |
|--------|-----|
| `npm run start:dev` | Desenvolvimento |
| `npm test` | Testes unitários — **rodar antes de concluir** |
| `npm run migration:run` | Aplicar migrations |
| `npm run migration:generate -- src/database/migrations/Nome` | Gerar migration |
| `npm run seed` | Dados iniciais |
| `npm run build` | Build de produção |

---

## Endpoints principais

| Área | Prefixo / rotas |
|------|-----------------|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Vistorias | `POST/GET/PUT /inspections`, `finalize`, `paralyze`, `resolve` |
| Sync | `POST /sync/inspections` |
| Uploads | `POST /uploads` |
| Dashboards | `GET /dashboards/*` |
| Cadastros | `/users`, `/teams`, `/sectors`, `/collaborators`, `/checklists` |
| OS | `/service-orders` |
| Obras | `/investment-works` |
| Relatórios | `/reports` |

Lista completa e payloads: `README.md` e `API_DOCUMENTATION.md`.

---

## Quando a tarefa exige frontend

Alterações que impactam contrato da API exigem atualização em `sanorte-vistorias`:

- Novos campos em responses consumidos pela UI
- Novos enums ou status
- Novas rotas com telas dedicadas

Atualize também `API_DOCUMENTATION.md` (backend e cópia no frontend, se mantida).

Specs de produto (monorepo): `specs/SPEC-001.md` e demais histórias em `specs/`.

---

## Checklist antes de concluir

- [ ] Código alterado neste repositório; frontend atualizado se contrato mudou
- [ ] Spec lida em `specs/` se for feature de produto
- [ ] Migration criada para alteração de schema
- [ ] DTOs com validação; guards de role nos controllers
- [ ] Enums em `common/enums/` alinhados com `sanorte-vistorias/src/domain/enums.ts`
- [ ] Regras de domínio em `inspection-domain.service.ts` quando aplicável
- [ ] `npm test` passa
- [ ] `API_DOCUMENTATION.md` atualizado se endpoint/payload mudou
- [ ] `CHANGELOG.md` atualizado se entrega relevante
- [ ] Uploads/queries pesadas revisadas com `.skills/node-memory-audit.md` (Heroku)
