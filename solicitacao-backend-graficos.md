# Solicitação Backend — Padronização e otimização de endpoints dos gráficos

## Objetivo

Separar o retorno do Ranking por Equipes por cenário de uso no frontend para reduzir payload e manter contratos claros:

- **Qualidade**: mantém métricas de qualidade.
- **Segurança do Trabalho**: expõe somente a métrica específica de safety work.

## Contexto

Hoje existe uma rota genérica que retorna campos além do necessário para alguns cenários.
No frontend, o gráfico foi dividido em:

1. **Qualidade**
   - `averagePercent` (Média)
   - `fieldPercent` (Campo)
   - `remotePercent` (Remoto)
   - `postWorkPercent` (Pós-obra)
   - `pendingCount` (Pendentes)
   - `inspectionsCount` (Qtd Vistorias)

2. **Segurança do Trabalho** (1 métrica principal)
   - `averagePercent` (Média)
   - `safetyWorkPercent` (Seg. Trabalho)
   - `inspectionsCount` (Qtd Vistorias)

## Escopo solicitado

### 1) Criar rota dedicada para Segurança do Trabalho

**Rota**

`GET /dashboards/ranking/teams/safety-work`

**Query params**

- `from` (obrigatório)
- `to` (obrigatório)
- `contractId` (opcional)

**Response esperado (array)**

```json
[
  {
    "teamId": "string",
    "teamName": "string",
    "averagePercent": 0,
    "safetyWorkPercent": 0,
    "inspectionsCount": 0
  }
]
```

**Regra**

- Não retornar campos extras além dos listados acima.

### 2) Manter rota de Qualidade com contrato mínimo

A rota usada por Qualidade pode permanecer a atual (ou equivalente otimizada), desde que garanta no mínimo:

- `teamId`
- `teamName`
- `averagePercent`
- `fieldPercent`
- `remotePercent`
- `postWorkPercent`
- `pendingCount`
- `inspectionsCount`

Campos sem uso nesse cenário (ex.: `safetyWorkPercent`, `paralyzedCount`, `paralysisRatePercent`) podem ser removidos **desde que não impactem consumidores existentes**.

### 3) Compatibilidade e transição

- Preservar consumidores legados, se existirem.
- Marcar endpoint antigo como `deprecated/legacy` somente se necessário.
- Frontend passará a consumir:
  - Qualidade: rota atual (ou equivalente otimizada para Qualidade).
  - Segurança do Trabalho: `GET /dashboards/ranking/teams/safety-work`.

## Critérios de aceite

- [ ] Endpoint de Safety Work criado com retorno enxuto.
- [ ] Filtros `from`, `to` e `contractId` aplicados corretamente.
- [ ] Endpoint de Qualidade mantém todas as colunas exigidas pelo frontend.
- [ ] Sem regressão de performance.
- [ ] Sem quebra de contrato para consumidores legados.

## Observações de entrega (opcional, recomendado)

- Atualizar documentação da API (Swagger/OpenAPI), se aplicável.
- Adicionar/ajustar testes de contrato e integração para os dois cenários.
- Validar paginação/ordenação (se houver na rota atual) para manter comportamento esperado do frontend.

