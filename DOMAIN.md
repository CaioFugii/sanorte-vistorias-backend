# Domínio — Sanorte Vistorias (Backend)

Referência do **modelo de domínio**, **enums**, **entidades** e **regras de negócio** persistidas na API. Este repositório é a **fonte de verdade** para validações server-side.

Código-fonte principal:

- Enums: `src/common/enums/`
- Entidades: `src/entities/`
- Regras puras de vistoria: `src/inspections/inspection-domain.service.ts`
- Orquestração e validações: `src/inspections/inspections.service.ts`

Alinhamento com frontend: `sanorte-vistorias/src/domain/enums.ts` e `types.ts`.

---

## Enums (`src/common/enums/`)

### `ModuleType`

| Valor | Descrição |
|-------|-----------|
| `CAMPO` | Vistorias de campo |
| `REMOTO` | Remotas — `serviceDescription` opcional; não gera `PENDENTE_AJUSTE` |
| `POS_OBRA` | Pós-obra |
| `SEGURANCA_TRABALHO` | Segurança do Trabalho — `teamId` opcional; não gera pendência |
| `OBRAS_INVESTIMENTO` | Obras de investimento |
| `QUALIDADE` | Legado / uso interno em dados históricos |
| `OBRAS_GLOBAL` | Legado |
| `CANTEIRO` | Legado |

O frontend expõe apenas os cinco módulos operacionais ativos. Valores legados permanecem no banco para compatibilidade.

### `UserRole`

`ADMIN` | `GESTOR` | `SUPERVISOR` | `FISCAL`

Enforced via `@Roles()` + `RolesGuard` nos controllers.

### `InspectionStatus`

```
RASCUNHO → FINALIZADA | PENDENTE_AJUSTE → RESOLVIDA
```

### `ChecklistAnswer`

`CONFORME` | `NAO_CONFORME` | `NAO_APLICAVEL`

### `InspectionScope`

`TEAM` (padrão) | `COLLABORATOR`

### `PendingStatus`

Status da entidade `PendingAdjustment`:

`PENDENTE` | `RESOLVIDA`

### `InvestmentWorkStatus`

`EM_ANDAMENTO` | `PARALISADA` | `FINALIZADA` | `CANCELADA`

### Relatórios

- `ReportFieldType`: `text`, `textarea`, `number`, `date`, `datetime`, `select`, `radio`, `checkbox`, `image`, `signature`
- `ReportOrientation`: `RETRATO` | `PAISAGEM`

---

## Modelo de entidades

### Diagrama de relacionamentos

```
User ─────────────────────┐
Team ── Contract (M:N) ───┼── Inspection
Collaborator ─ Sector ─────┤       │
Checklist ─ Section ─ Item ┘       ├── InspectionItem
                                   ├── Evidence
                                   ├── Signature
                                   ├── PendingAdjustment (1:1)
                                   ├── ServiceOrder (opcional)
                                   ├── Contract (opcional)
                                   └── InvestmentWork (opcional)

ReportType ── ReportTypeField
ReportRecord ── ReportFile
```

### Entidade central: `Inspection`

| Campo | Descrição |
|-------|-----------|
| `module` | `ModuleType` — define regras de status e campos obrigatórios |
| `inspectionScope` | `TEAM` ou `COLLABORATOR` |
| `status` | Ciclo de vida da vistoria |
| `externalId` | UUID idempotente para sync offline |
| `scorePercent` | Nota recalculada ao atualizar itens |
| `hasParalysisPenalty` | Flag persistente de penalidade de 25% |
| `paralyzedReason` / `paralyzedAt` | Metadados de paralisação |
| `finalizedAt` | Timestamp de finalização |
| `teamId` | Obrigatório exceto `SEGURANCA_TRABALHO` |
| `serviceDescription` | Obrigatório exceto `REMOTO` |
| `serviceOrderId` | Vínculo opcional com ordem de serviço |
| `investmentWorkId` | Vínculo opcional com obra de investimento |
| `contractId` | Contrato associado |

### `InspectionItem`

- Resposta (`answer`) por item do checklist
- Campos de resolução: `resolvedAt`, `resolvedByUserId`, `resolutionNotes`, `resolutionEvidencePath`

### `PendingAdjustment`

Registro 1:1 com vistoria quando há pendência de ajuste. Atualizado na finalização e na resolução global.

### Cadastros auxiliares

| Entidade | Regras |
|----------|--------|
| `Sector` | Seed: ESGOTO, AGUA, REPOSICAO; não deletável se vinculado |
| `Team` | `isContractor = true` → não aceita colaboradores |
| `Collaborator` | Vinculado a `sectorId`; opcionalmente `contractId` |
| `Checklist` | `module`, `inspectionScope`, `sectorId`; seções e itens aninhados |
| `ServiceOrder` | Importável; mapeamento de setor na importação (AGUA, ESGOTO, REPOSICAO, etc.) |

---

## Regras de vistoria (`InspectionDomainService`)

Serviço injetável com lógica pura, testável isoladamente.

### Cálculo de nota — `calculateScorePercent`

```
base = (conformes / itens_avaliados) × 100
```

- Itens avaliados: resposta presente e ≠ `NAO_APLICAVEL`
- Sem itens avaliados → **100**
- Arredondamento: 2 casas decimais (`Math.round(value × 100) / 100`)

### Penalidade de paralisação — `applyParalysisPenalty`

```
nota_final = hasParalysisPenalty ? base × 0.75 : base
```

Penalidade **persistente** enquanto `hasParalysisPenalty = true`. Removida via `unparalyze` (GESTOR, SUPERVISOR, ADMIN).

### Status pós-finalização — `resolveFinalStatus`

| Módulo | Com `NAO_CONFORME` |
|--------|---------------------|
| `SEGURANCA_TRABALHO` | Sempre `FINALIZADA` |
| `REMOTO` | Sempre `FINALIZADA` |
| Demais | `PENDENTE_AJUSTE` |
| Qualquer (sem NC) | `FINALIZADA` |

### Detecção de não conformidade — `hasNonConformity`

Verifica se algum item possui `answer = NAO_CONFORME`.

---

## Orquestração (`InspectionsService`)

### Permissões por role

| Operação | FISCAL | GESTOR/SUPERVISOR | ADMIN |
|----------|--------|-------------------|-------|
| Criar vistoria | ✓ | ✓ | ✓ |
| Editar metadados | Só `RASCUNHO` | ✓ | ✓ |
| Atualizar itens | Só `RASCUNHO` | ✓ (reavalia status) | ✓ |
| Finalizar | ✓ | ✓ | — |
| Paralisar | ✓ | ✓ | ✓ |
| Desparalisar | — | ✓ | ✓ |
| Resolver pendências | ✓ | ✓ | ✓ |
| Listar geral (`GET /inspections`) | — | ✓ (sem rascunhos) | ✓ |
| Listar minhas (`GET /inspections/mine`) | ✓ | — | — |

### Criação (`POST /inspections`)

- Status inicial: `RASCUNHO`
- `teamId` obrigatório se módulo ≠ `SEGURANCA_TRABALHO`
- `serviceDescription` obrigatório se módulo ≠ `REMOTO`
- Equipe empreiteira não aceita colaboradores vinculados
- Gera `InspectionItem` para cada item ativo do checklist

### Atualização de itens (`PUT /inspections/:id/items`)

- Recalcula `scorePercent` (com penalidade se aplicável)
- GESTOR/SUPERVISOR/ADMIN em vistoria `FINALIZADA` ou `PENDENTE_AJUSTE`: reavalia status via `resolveFinalStatus`
- Exceção: módulos `SEGURANCA_TRABALHO` e `REMOTO` não vão para `PENDENTE_AJUSTE`

### Finalização (`POST /inspections/:id/finalize`)

Pré-condições:

- Status = `RASCUNHO`
- Evidência obrigatória para itens `NAO_CONFORME` com `requiresPhotoOnNonConformity = true` (`assertNonConformItemsHaveRequiredEvidence`)

Efeitos:

- Calcula `scorePercent` final (com penalidade)
- Define status via `resolveFinalStatus`
- Cria/atualiza `PendingAdjustment` se status = `PENDENTE_AJUSTE`
- Define `finalizedAt`

**Assinatura:** não é validada server-side na finalização; o frontend exige assinatura (exceto REMOTO, ST e POS_OBRA).

### Paralisação

| Endpoint | Efeito |
|----------|--------|
| `POST .../paralyze` | `hasParalysisPenalty = true`, registra motivo; recalcula nota |
| `POST .../unparalyze` | Remove penalidade; recalcula nota (GESTOR/SUPERVISOR/ADMIN) |

### Resolução de pendências

**Por item** — `POST .../items/:itemId/resolve`:

- Vistoria deve estar em `PENDENTE_AJUSTE`
- Item deve ser `NAO_CONFORME`
- Aceita `resolutionEvidence` como URL ou base64

**Global** — `POST .../resolve`:

- Todos os itens NC devem ter `resolvedAt` preenchido
- Atualiza `PendingAdjustment` para `RESOLVIDA`
- Vistoria → `RESOLVIDA`

### Exclusão

Somente vistorias em `RASCUNHO`.

### Sync offline (`POST /sync/inspections`)

- Idempotente por `externalId`
- Não aceita assets em `dataUrl` — URLs Cloudinary ou upload separado
- Respeita mesmas regras de role e status por operação

---

## Outros domínios

### Dashboards

Agregações sobre vistorias finalizadas: rankings por equipe, não conformidades, performance por serviço. Setores canônicos incluem AGUA, ESGOTO, REPOSICAO (entre outros usados em queries).

### Ordens de serviço

Importação via parser (`service-order-import-parser.service.ts`) com mapeamento de família de serviço → setor. Regras de unicidade para setor REPOSICAO.

### Obras de investimento

CRUD com status `InvestmentWorkStatus`. Vistorias podem referenciar `investmentWorkId`.

### Relatórios de engenharia

Tipos configuráveis (`ReportType` + `ReportTypeField`). Registros (`ReportRecord`) com arquivos anexos (`ReportFile`).

### Contratos e escopo de acesso

Usuários vinculados a contratos (`contractIds`). Filtra visibilidade de dados operacionais conforme perfil.

---

## Paginação

Resposta padrão em listagens:

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

---

## Testes de domínio

| Arquivo | Cobertura |
|---------|-----------|
| `inspection-domain.service` (via specs) | Cálculo de nota, penalidade, status |
| `inspections.service.spec.ts` | Fluxos CRUD e cálculos |
| `inspections.service.business-rules.spec.ts` | Regras por módulo, paralisação, REMOTO, ST, empreiteira |

Executar: `npm test`

---

## Divergências intencionais frontend ↔ backend

| Regra | Frontend | Backend |
|-------|----------|---------|
| Assinatura na finalização | Obrigatória (exceto REMOTO, ST, POS_OBRA) | Não validada em `finalize` |
| Arredondamento de nota | Inteiro (`Math.round`) | 2 casas decimais |
| `ModuleType` | 5 valores ativos | Inclui valores legados (QUALIDADE, etc.) |

Ao alterar regras, atualizar ambos os lados e os testes correspondentes.

---

## Onde alterar

| Mudança | Local |
|---------|-------|
| Novo enum | `src/common/enums/` + migration se coluna enum |
| Nova entidade | `src/entities/` + migration |
| Regra pura de vistoria | `inspection-domain.service.ts` |
| Validação de fluxo | `inspections.service.ts` |
| Permissão de endpoint | Controller + `@Roles()` |

---

## Referências

- Domínio espelhado no client: `sanorte-vistorias/DOMAIN.md`
- Payloads de API: `API_DOCUMENTATION.md`
- Arquitetura da API: `ARCHITECTURE.md`
