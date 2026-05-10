# Demanda — Nova Entidade de Obras de Investimento

Baseado na documentação atual da API do projeto de vistorias da Sanorte, será necessário implementar uma nova entidade de domínio voltada para o módulo de **OBRAS_INVESTIMENTO**, com relacionamento direto às `Inspections`, porém com regras próprias e fluxo independente.

Documentação de referência utilizada: fileciteturn0file0

---

# Objetivo

Criar uma nova entidade chamada provisoriamente de:

* `InvestmentProject`
* ou `InvestmentWork`
* ou `ObraInvestimento`

(A nomenclatura definitiva deve seguir o padrão atual do backend.)

Esta entidade representará uma obra/projeto de investimento.

Ela deverá:

* possuir informações próprias;
* possuir vínculo com contrato;
* possuir vínculo com usuário criador;
* permitir múltiplas inspeções relacionadas;
* funcionar como agrupador/contexto operacional das inspeções;
* permitir rastreabilidade completa da obra;
* ser compatível com os módulos já existentes da plataforma.

---

# Relação com Inspections

Hoje uma `Inspection` possui relação principal com:

* checklist;
* team;
* serviceOrder;
* module;
* evidências;
* score;
* status.

A nova entidade deverá introduzir um relacionamento:

```text
InvestmentWork 1:N Inspection
```

Ou seja:

* Uma obra poderá possuir N inspeções;
* Uma inspeção poderá pertencer opcionalmente a uma obra;
* Nem toda inspeção obrigatoriamente terá obra vinculada;
* Para `OBRAS_INVESTIMENTO`, a inspeção poderá ser criada **com OS ou sem OS**;
* OS significa **Ordem de Serviço**.

---

# Regras principais

## 1. Apenas módulo OBRAS_INVESTIMENTO

O vínculo entre `Inspection` e `InvestmentWork` só deverá existir quando:

```text
inspection.module = OBRAS_INVESTIMENTO
```

Para os demais módulos:

* QUALIDADE
* SEGURANCA_TRABALHO
* OBRAS_GLOBAL
* CANTEIRO

O campo deve permanecer `null`.

---

# 2. Nova obra poderá agrupar múltiplas inspeções

Exemplo:

```text
Obra: Ampliação Rede de Esgoto Bairro X

- Inspeção 01
- Inspeção 02
- Inspeção 03
- Inspeção 04
```

A obra funcionará como agrupador operacional e histórico.

---

# 3. Exclusão protegida

Não permitir exclusão da obra caso existam inspeções vinculadas.

Retornar erro de domínio:

```json
{
  "statusCode": 400,
  "message": "Não é possível remover obra com inspeções vinculadas",
  "error": "Bad Request"
}
```

---

# 4. Escopo por contrato

A entidade deve seguir o mesmo padrão atual do sistema:

* ADMIN vê tudo;
* GESTOR/FISCAL apenas contratos vinculados;
* filtros por contrato devem ser aplicados automaticamente.

A obra deve possuir:

```text
contractId
```

# Estrutura sugerida da entidade

## Tabela

```text
investment_works
```

---

## Payload necessário para criação

Para criar uma Obra de Investimento, o payload deve contemplar os campos abaixo:

```json
{
  "workName": "Obra de ampliação da rede de esgoto",
  "startDate": "2026-05-10",
  "expectedEndDate": "2026-08-10",
  "address": "Rua Exemplo, 123",
  "district": "Bairro Norte",
  "basin": "Bacia 01",
  "service": "Implantação de rede coletora",
  "teamId": "uuid",
  "materialNetwork": "PVC DN 150",
  "singularities": "Travessia em avenida de grande fluxo"
}
```

Mapeamento dos campos de negócio:

| Campo da tela          | Campo sugerido no backend |        Tipo | Obrigatório |
| ---------------------- | ------------------------- | ----------: | ----------: |
| Obra                   | `workName`                |      string |         Sim |
| Data de Início         | `startDate`               |        date |         Sim |
| Data prevista para fim | `expectedEndDate`         |        date |         Sim |
| Endereço               | `address`                 |      string |         Sim |
| Bairro                 | `district`                |      string |         Sim |
| Bacia                  | `basin`                   |      string |         Sim |
| Serviço                | `service`                 |      string |         Sim |
| Equipe                 | `teamId`                  |        uuid |         Sim |
| Material/Rede          | `materialNetwork`         |      string |         Sim |
| Singularidades         | `singularities`           | string/text |         Não |

---

## Campos sugeridos

```ts
id: uuid
contractId: uuid
createdByUserId: uuid
workName: string
startDate: date
expectedEndDate: date
address: string
district: string
basin: string
service: string
teamId: uuid
materialNetwork: string
singularities?: string
status: InvestmentWorkStatus
active: boolean
createdAt: datetime
updatedAt: datetime
```

Observação: os campos genéricos anteriormente cogitados (`name`, `description`, `location`, `startedAt`, `finishedAt`) devem ser substituídos pelos campos de negócio acima, para evitar duplicidade conceitual.

---

# Novo enum

## InvestmentWorkStatus

```ts
[
  'EM_ANDAMENTO',
  'PARALISADA',
  'FINALIZADA',
  'CANCELADA'
]
```

---

# Alterações necessárias em Inspection

Adicionar:

```ts
investmentWorkId?: uuid
```

---

# Regras de validação

## POST /inspections

Quando:

```text
module = OBRAS_INVESTIMENTO
```

Deve aceitar:

```json
{
  "investmentWorkId": "uuid",
  "serviceOrderId": "uuid opcional"
}
```

Validações:

* obra deve existir;
* usuário deve possuir acesso ao contrato da obra;
* obra deve estar ativa;
* obra não pode estar CANCELADA;
* `serviceOrderId` deve ser opcional para `OBRAS_INVESTIMENTO`;
* quando `serviceOrderId` for informado, a OS deve existir;
* quando `serviceOrderId` for informado, a OS deve pertencer ao mesmo contrato da obra;
* quando `serviceOrderId` não for informado, a inspeção deve herdar/validar escopo pelo contrato da obra.

---

# Regras adicionais importantes

## Inspeções de Obras de Investimento com ou sem OS

Para o módulo:

```text
OBRAS_INVESTIMENTO
```

A inspeção poderá ser criada de duas formas:

1. **Com OS** (`serviceOrderId` informado)
2. **Sem OS** (`serviceOrderId = null`)

Isso altera a regra geral atual, onde `serviceOrderId` é obrigatório para módulos diferentes de `SEGURANCA_TRABALHO`.

Nova regra esperada:

```text
serviceOrderId é obrigatório para módulos diferentes de SEGURANCA_TRABALHO e OBRAS_INVESTIMENTO.
```

Ou seja:

* `SEGURANCA_TRABALHO`: OS opcional;
* `OBRAS_INVESTIMENTO`: OS opcional;
* demais módulos: OS obrigatória.

---

## Contrato da obra

A obra sempre deve possuir `contractId`.

Quando a inspeção de `OBRAS_INVESTIMENTO` possuir OS, a obra e a OS devem pertencer ao mesmo contrato.

Exemplo inválido:

```text
OS -> Contrato A
Obra -> Contrato B
```

Deve retornar erro.

Quando a inspeção de `OBRAS_INVESTIMENTO` não possuir OS, o contrato deve ser inferido/validado a partir da obra vinculada.

---

# Novos endpoints

# Investment Works

## GET /investment-works

Auth:

```text
JWT
```

Perfis:

```text
ADMIN
GESTOR
FISCAL
```

Filtros:

* page
* limit
* status
* contractId
* search
* active

Retorno paginado.

---

## GET /investment-works/:id

Retornar:

* dados da obra;
* quantidade de inspeções;
* média das notas;
* últimas inspeções;
* percentual médio;
* total pendências.

---

## POST /investment-works

Perfis:

```text
ADMIN
GESTOR
```

Request:

```json
{
  "workName": "Ampliação Rede Bairro Norte",
  "startDate": "2026-05-10",
  "expectedEndDate": "2026-08-10",
  "address": "Rua Exemplo, 123",
  "district": "Bairro Norte",
  "basin": "Bacia 01",
  "service": "Implantação de rede coletora",
  "teamId": "uuid",
  "materialNetwork": "PVC DN 150",
  "singularities": "Travessia em avenida de grande fluxo",
  "contractId": "uuid"
}
```

Validações:

* `workName` obrigatório;
* `startDate` obrigatório;
* `expectedEndDate` obrigatório;
* `expectedEndDate` não deve ser menor que `startDate`;
* `address` obrigatório;
* `district` obrigatório;
* `basin` obrigatório;
* `service` obrigatório;
* `teamId` obrigatório;
* equipe deve existir;
* equipe deve estar ativa;
* equipe deve possuir vínculo com o contrato informado;
* `materialNetwork` obrigatório;
* `contractId` obrigatório;
* usuário deve possuir acesso ao contrato informado;
* `singularities` opcional.

---

## PUT /investment-works/:id

Permitir atualização parcial.

---

## DELETE /investment-works/:id

Regras:

* não excluir se houver inspeções vinculadas;
* soft delete é aceitável caso já exista padrão no projeto.

---

# Alterações em endpoints existentes

# POST /inspections

Adicionar suporte a:

```json
{
  "investmentWorkId": "uuid"
}
```

---

# GET /inspections

Adicionar filtros:

```text
investmentWorkId
```

---

# GET /inspections/:id

Retornar:

```json
{
  "investmentWork": {
    "id": "uuid",
    "name": "Obra X"
  }
}
```

---

# Dashboard futuro

A implementação deve ser preparada para dashboards futuros:

* qualidade por obra;
* ranking de obras;
* evolução mensal da obra;
* percentual médio da obra;
* quantidade de pendências por obra;
* quantidade de paralisações por obra.

Evitar modelagem que dificulte agregações SQL.

---

# Estrutura esperada no backend

O Cursor deve seguir o padrão arquitetural já utilizado no projeto:

* controllers;
* services;
* repositories;
* DTOs;
* validators;
* entities/models;
* migrations;
* guards;
* paginação padrão;
* escopo por contrato;
* enums centralizados.

---

# Alterações esperadas

## Banco de dados

Criar:

* migration da nova tabela;
* migration adicionando `investmentWorkId` em inspections;
* índices;
* foreign keys.

---

# Índices importantes

Criar índices para:

```text
contractId
status
createdAt
investmentWorkId
module
```

---

# Relacionamentos esperados

## InvestmentWork

```text
belongsTo Contract
belongsTo User(createdBy)
hasMany Inspection
```

## Inspection

```text
belongsTo InvestmentWork
```

---

# Requisitos técnicos

## Backend

Stack atual:

* Node.js
* TypeScript
* PostgreSQL
* ORM já utilizado no projeto
* JWT
* Cloudinary

---

# Cuidados importantes

## Não quebrar comportamento atual

A implementação:

* não pode impactar módulos existentes;
* não pode alterar regras atuais de score;
* não pode alterar regras de finalize;
* não pode impactar sync atual;
* não pode alterar dashboards existentes.

---

# Compatibilidade futura

A modelagem deve permitir futuramente:

* anexos próprios da obra;
* timeline da obra;
* etapas/fases da obra;
* cronograma;
* apontamentos;
* relatórios vinculados;
* geolocalização;
* mapa;
* dashboard executivo.

---

# Entregáveis esperados do Cursor

## Backend

Implementar:

* migrations;
* entidade/model;
* enum;
* DTOs;
* validações;
* CRUD completo;
* filtros;
* escopo por contrato;
* integração com inspections;
* relacionamentos;
* paginação;
* tratamento de erros;
* documentação Swagger/OpenAPI;
* atualização da documentação markdown do projeto.

---

# Critérios de aceite

A feature será considerada pronta quando:

* for possível criar obras;
* vincular inspeções à obra;
* listar inspeções por obra;
* filtrar inspeções por obra;
* manter isolamento por contrato;
* impedir inconsistência entre contratos;
* impedir exclusão indevida;
* manter compatibilidade total com o fluxo atual.
