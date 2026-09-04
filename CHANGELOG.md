# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added

- `GET /dashboards/safety-work/inspectors-production` — produção diária por fiscal (apenas `SEGURANCA_TRABALHO`)
- `GET /dashboards/safety-work/quality-by-service` inclui vistorias de ST mesmo quando o serviço/setor não é de Qualidade
- `GET /service-orders/export` — Excel das ordens de serviço no layout da listagem (máximo 5000 linhas)
- `GET /dashboards/ranking/teams/export` e alias `GET /dashboards/quality/ranking/teams/export` — Excel do ranking de qualidade no layout da classificação avaliativa
- Campo `data_emissao` (date) no schema de todos os tipos de relatório de engenharia
- Campo `titulo_complemento` (select) nos relatórios `LIGACAO_PASSEIO` e `LIGACOES`; opções de `preco` passam a gravar só o código
- Relação M:N entre equipes e setores (`team_sectors`); `sectorIds` em `POST/PUT /teams` e filtro `sectorId` em `GET /teams`
- Limite de 50 perguntas (`ChecklistItem`) por checklist em `POST /checklists/:id/items`
- `evaluationModule` (`CAMPO` | `POS_OBRA`) em vistorias de `OBRAS_INVESTIMENTO`; vistorias antigas do módulo foram migradas para `CAMPO`
- Log de memória do processo (`rssMb`, `heapUsedMb` e delta) em `Request completed` / `Request failed`
- Upload direto ao S3 na evidência de vistoria nova (`POST /inspections/:id/evidences/presign` + `from-storage`)
- `HEROKU_MEMORY.md` — registro do pico/crash na Heroku (2026-08-17) e como avaliar o próximo
- `ARCHITECTURE.md` — documentação de arquitetura da API
- `DOMAIN.md` — enums, entidades e regras de negócio
- `CHANGELOG.md` — histórico de alterações
- Filtros em `GET /inspections`: `contractId`, `service`, `executionFrom`/`executionTo` e `inspectionFrom`/`inspectionTo`
- Filtro `createdByUserId` em `GET /inspections` (fiscal responsável)
- `GET /users/fiscals` para ADMIN, GESTOR e SUPERVISOR listarem fiscais no escopo de contrato
- Filtro `contractId` em `GET /users`
- Filtros `equipe` e `resultado` em `GET /service-orders`

### Changed

- `GET /checklists` deixa de hidratar `items`/`sections` (só `sectionCount`/`itemCount`); `POST /inspections` e mutações devolvem `findOneDetail`
- `GET /teams` lista sem hidratar `collaborators`/`contracts` (hidrata `sectors`); grafo completo em `GET /teams/:id`
- Ranking de Qualidade (`GET /dashboards/ranking/teams`): média, quantidade e pendências incluem `OBRAS_INVESTIMENTO`; `fieldPercent` junta Campo + OI classificado como Campo; `postWorkPercent` junta Pós-obra + OI classificado como Pós-obra
- `GET /inspections` e `GET /inspections/mine`: filtro `osNumber` só aplica com no mínimo 3 caracteres
- `GET /inspections`: filtro `service` só aplica com no mínimo 3 caracteres

### Fixed

- Crash de boot na Heroku por binding nativo do `bcrypt` (trocado por `bcryptjs`)

### Removed

- Pasta `src/database/seeds` e scripts `seed` / `seed:local` / `seed:dump-prd` / `seed:load-prd`

## [1.0.1] — 2026-06-09

### Added

- Serviço de logging HTTP estruturado (`HttpLoggingInterceptor`)
- Integração com Sentry para monitoramento de erros

### Changed

- Métricas e documentação de dashboards de ranking de equipes
- Otimização de uso de memória em fluxos de gestão de vistorias

### Fixed

- Vazamento de memória em uploads de arquivos

## [1.0.0] — 2026-05-10

Versão base em produção. Inclui funcionalidades entregues entre fev/2026 e mai/2026.

### Added

- API REST NestJS 10 + TypeORM + PostgreSQL
- Autenticação JWT (`auth/login`, `auth/me`) com guards por role
- CRUD de usuários, equipes, setores, colaboradores e checklists
- Ciclo completo de vistorias: criação, itens, evidências, assinatura, paralisação, finalização e resolução de pendências
- Sync offline idempotente por `externalId` (`POST /sync/inspections`)
- Upload de mídia via Cloudinary (`uploads`, evidências, assinaturas)
- Dashboards: resumo, rankings por equipe, analytics de qualidade e segurança
- Ordens de serviço com importação e mapeamento de setores
- Contratos e escopo de acesso por usuário/equipe
- Módulo de obras de investimento (`investment-works`)
- Módulo de relatórios de engenharia (`reports`)
- Paginação padronizada em todas as listagens
- Migrations TypeORM versionadas e seed de dados iniciais
- Testes unitários de services (`inspections`, `dashboards`, `uploads`)
- Documentação de API em `API_DOCUMENTATION.md`
- Preparação para deploy Heroku (release Sentry via slug commit)

### Changed

- Coluna `familia` em ordens de serviço (abr/2026)
- Imagem de referência em itens de checklist (abr/2026)
- Regras de unicidade de equipes e vínculo com contratos (mar/2026)
- Setores expandidos além do seed padrão (ESGOTO, AGUA, REPOSICAO)

### Fixed

- Compatibilidade NestJS 10 (remoção de `@nestjs/serve-static`)
- Tipagem de `UserRole` no `UsersService`
- Rotas de importação de ordens de serviço
