# ADR 0001 - MVP Qualidade com Sincronizacao Offline-First

## Status
Aceito

## Contexto
A API atual em NestJS + TypeORM + PostgreSQL ja suporta fluxo completo de vistoria online (rascunho, evidencias, assinatura, finalizacao, pendencia/ajuste e resolucao), com arquivos locais em `./storage`.

O frontend do MVP de Qualidade passara a operar em modo offline-first, acumulando dados localmente e sincronizando manualmente quando houver conexao.

Restricoes aplicadas:
- sem rewrite completo;
- sem remover endpoints;
- com compatibilidade para payload legado;
- sem dependencia de storage externo (manter local/mock).

## Auditoria (Fase 0)

### Entidades existentes mapeadas
- `Inspection`: vistoria com `module`, `status`, `scorePercent`, `finalizedAt`, relacoes com itens/evidencias/assinaturas.
- `InspectionItem`: resposta por item de checklist (`answer`, `notes`).
- `Checklist` e `ChecklistItem`: estrutura base do checklist (sem secoes antes desta evolucao).
- `Evidence`: evidencia vinculada a vistoria e opcionalmente item.
- `Signature`: assinatura do lider/encarregado.
- `User`: usuarios com perfis `ADMIN`, `GESTOR`, `FISCAL`.
- `PendingAdjustment`: pendencia quando existe nao conformidade.

### Endpoints existentes relevantes
- `POST /inspections`
- `GET /inspections`, `GET /inspections/mine`, `GET /inspections/:id`
- `PUT /inspections/:id`
- `PUT /inspections/:id/items`
- `POST /inspections/:id/evidences` (multipart)
- `POST /inspections/:id/signature` (base64)
- `POST /inspections/:id/finalize`
- `POST /inspections/:id/resolve`
- `GET/POST/PUT/DELETE` de `checklists` e itens

### Regras existentes de score/status
- respostas: `CONFORME | NAO_CONFORME | NAO_APLICAVEL`;
- score: `conformes / avaliados` (avaliados = diferente de `NAO_APLICAVEL`);
- ao finalizar:
  - assinatura obrigatoria;
  - item `NAO_CONFORME` pode exigir foto;
  - se houver nao conformidade => `PENDENTE_AJUSTE`, senao `FINALIZADA`.

### Fluxo de upload existente
- evidencias via multipart (`POST /inspections/:id/evidences`) para `storage/evidences`;
- assinatura via base64 (`POST /inspections/:id/signature`) para `storage/signatures`;
- sem dependencias de cloud storage.

## Gaps para MVP Qualidade Offline-First
1. **Modulo Qualidade** nao existe no enum de modulos.
2. **Checklist com secoes** nao era suportado (apenas lista linear de itens).
3. **Sincronizacao offline** nao existia (sem `externalId`, sem endpoint batch, sem idempotencia formal).
4. **Modelo de sincronia** nao tinha metadados (`createdOffline`, `syncedAt`).
5. **Contrato de sync** inexistente para retries seguros e mapeamento `externalId -> serverId`.

## Decisoes

### 1) Abordagem de sync escolhida
**A) Endpoint de sincronizacao em lote** (`POST /sync/inspections`), por menor impacto no contrato legado e menor risco de regressao.

Trade-off:
- pro: nao altera semantica dos endpoints antigos;
- pro: concentra idempotencia e regras de retry em um ponto unico;
- contra: existe um fluxo adicional para manter documentado/testado.

### 2) Mudancas minimas de modelagem
- novo enum de modulo: `QUALIDADE`;
- nova entidade/tabela `ChecklistSection`;
- `ChecklistItem` passa a ter `sectionId` (com backfill para secao padrao);
- `Inspection` recebe:
  - `externalId` (UUID, unico quando nao nulo),
  - `createdOffline` (boolean),
  - `syncedAt` (timestamp).

### 3) Regras de dominio centralizadas
- logica de score/status consolidada em `InspectionDomainService`, reutilizada no fluxo de finalizacao.

### 4) Compatibilidade
- payload legado de checklist item sem `sectionId` continua valido:
  - backend associa automaticamente na `Seção padrão`;
- endpoints antigos continuam operando sem quebra;
- uploads permanecem em filesystem local.

## Plano incremental (PRs/commits)
1. **PR1 - Auditoria e ADR**
   - registrar mapeamento atual + gaps + plano.
2. **PR2 - Modelagem**
   - migration: `QUALIDADE`, `checklist_sections`, `checklist_items.section_id`, colunas offline/sync em `inspections`;
   - entidades TypeORM e relacoes.
3. **PR3 - Servicos e compatibilidade**
   - default section em checklist legado;
   - `InspectionDomainService` para score/status;
   - ajustes de relacoes retornadas.
4. **PR4 - Sync endpoint**
   - `POST /sync/inspections` com upsert por `externalId`;
   - retorno por registro: `externalId`, `serverId`, status.
5. **PR5 - Testes + documentacao**
   - testes unitarios obrigatorios;
   - README + `examples.http` com fluxo de sync/finalizacao.

## Riscos e mitigacoes
- **Risco: regressao em checklists antigos sem secao**
  - mitigacao: migration com backfill + fallback em servico.
- **Risco: duplicacao em retries de sync**
  - mitigacao: `externalId` unico + upsert logico no endpoint batch.
- **Risco: payloads heterogeneos (legado vs novo)**
  - mitigacao: manter campos antigos opcionais e defaults de compatibilidade.
- **Risco: alteracao de permissao acidental**
  - mitigacao: teste unitario para `FISCAL` sem edicao apos finalizada.
- **Risco: inconsistencias na finalizacao via sync**
  - mitigacao: reaproveitar `finalize()` com validacoes ja existentes.

## Resultado esperado
A API permanece compativel com consumidores atuais, suporta o MVP de Qualidade com offline-first no frontend e permite sincronizacao manual segura/idempotente via endpoint batch.
