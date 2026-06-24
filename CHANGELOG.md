# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added

- `ARCHITECTURE.md` — documentação de arquitetura da API
- `DOMAIN.md` — enums, entidades e regras de negócio
- `CHANGELOG.md` — histórico de alterações

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
