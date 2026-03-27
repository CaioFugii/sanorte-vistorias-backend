# Orcamento Backend - Novas Funcionalidades

Data: 24/03/2026

## Premissas do Orcamento

- Escopo considerado: **apenas backend** (API, regras de negocio, banco, seguranca, testes automatizados backend e documentacao tecnica de endpoints).
- Nao inclui: desenvolvimento de app mobile, publicacao em lojas, UI frontend/dashboard, UX, QA manual completo e infraestrutura adicional fora do necessario para backend.
- Base de preco: **R$ 180/hora** (perfil Senior).
- Estimativas com margem tecnica de risco ja embutida para ambientes reais.

## Estimativa por Funcionalidade

| # | Funcionalidade | Escopo Backend Considerado | Complexidade | Esforco (h) | Valor Orcado (R$) |
|---|---|---|---|---:|---:|
| 1 | Replicar ultima vistoria/esqueleto para acelerar vistoria remota | Endpoint para clonar vistoria base, regras para copiar estrutura (itens, evidencias opcionais, metadados), validacoes de permissao/perfil, auditoria e testes | Media | 28h | 5.040 |
| 2 | Suporte backend para app do fiscal em modo offline com sincronizacao | Evolucao do fluxo de sincronizacao existente (idempotencia, conflitos, estrategia de retry, lote de sincronizacao, observabilidade, endurecimento de validacoes, testes de carga basica) | Alta | 64h | 11.520 |
| 3 | Novo perfil ENCARREGADO com visao de equipes subordinadas e performance | Novo papel em autorizacao, regras de visibilidade por subordinacao, ajustes de consultas e endpoints de performance por equipe subordinada, migracoes e testes de permissao | Alta | 40h | 7.200 |
| 4 | Ranking de perguntas com maior frequencia de NAO_CONFORME + base para grafico | Endpoint analitico agregando por item/pergunta, filtros por periodo/modulo/equipe, ordenacao e percentual, possiveis indices de banco e testes | Media | 20h | 3.600 |
| 5 | Indice de desenvolvimento GERAL (inexistente hoje) | Fase de descoberta tecnica + definicao de formula com negocio + implementacao de motor de calculo, persistencia (se necessario), endpoint e validacao de consistencia | Alta | 36h | 6.480 |

## Totais

- **Esforco total estimado:** 188 horas
- **Valor total estimado:** **R$ 33.840**

## Observacoes Importantes

- A funcionalidade de sync offline ja existe parcialmente no backend atual; por isso o orcamento considera **evolucao e robustez**, nao construcao do zero.
- O item "Indice de desenvolvimento GERAL" possui maior incerteza funcional, pois depende de regra de negocio ainda nao formalizada. Caso a formula mude durante o desenvolvimento, pode haver ajuste de esforco.
- Caso deseje, posso quebrar este mesmo orcamento em **fases de entrega (MVP + evolutivo)** com cronograma sugerido por sprint.
