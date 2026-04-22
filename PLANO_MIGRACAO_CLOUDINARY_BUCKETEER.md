# Plano de Migracao: Cloudinary -> Bucketeer

## Objetivo

Migrar o armazenamento de imagens (evidencias e assinaturas) de Cloudinary para Bucketeer com baixo risco, sem indisponibilidade e com possibilidade de rollback rapido.

## Escopo

- Upload e delecao em `src/uploads/uploads.controller.ts`.
- Upload de evidencias e assinaturas em `src/inspections/inspections.service.ts`.
- Servico de armazenamento atual em `src/cloudinary/cloudinary.service.ts`.
- Campos persistidos em `evidences` e `signatures` (`cloudinary_public_id`, `url`, metadados).
- Configuracao de ambiente em `.env.example` e documentacao (`README.md`, `API_DOCUMENTATION.md`).

## Estado Atual (Resumo Tecnico)

- O backend usa `CloudinaryService` diretamente em fluxos de upload.
- `evidences` e `signatures` armazenam:
  - `cloudinary_public_id` (identificador do provedor)
  - `url` (URL publica)
  - metadados (`bytes`, `format`, `width`, `height` em evidencias)
- Exclusao depende de `cloudinary_public_id`.
- Existe endpoint generico `/uploads` retornando `publicId` + `url`.

## Estrategia Recomendada

Adotar migracao em duas etapas:

1. **Compatibilidade e dual-read**: backend passa a suportar Bucketeer sem quebrar registros antigos do Cloudinary.
2. **Cutover + limpeza**: novas escritas no Bucketeer, backfill opcional dos ativos antigos e remocao do acoplamento com Cloudinary.

## Fases do Plano

## Fase 1 - Preparacao de Infra e Seguranca

- Provisionar Bucketeer e bucket final (ex.: `sanorte-vistorias-prod`).
- Definir politica de acesso (privado com URL assinada, ou publico com CDN).
- Criar IAM com principio de menor privilegio (put/get/delete/list apenas no prefixo da aplicacao).
- Definir estrutura de chaves (keys), exemplo:
  - `quality/evidences/{inspectionId}/{uuid}.{ext}`
  - `quality/signatures/{inspectionId}/{uuid}.{ext}`
- Definir regras de lifecycle (expiracao/versionamento, se aplicavel).
- Publicar segredo das credenciais em ambiente seguro (sem hardcode).

## Fase 2 - Contrato de Armazenamento no Codigo

- Criar uma interface unica de storage (ex.: `AssetStorageService`) com operacoes:
  - `uploadImageFromPath`
  - `uploadImage`
  - `deleteAsset`
  - retorno padrao (`assetId`, `url`, `bytes`, `format`, `width`, `height`).
- Implementar adaptadores:
  - `CloudinaryStorageAdapter` (compatibilidade)
  - `BucketeerStorageAdapter` (novo padrao)
- Introduzir feature flag:
  - `STORAGE_PROVIDER=cloudinary|bucketeer`
  - opcional: `STORAGE_READ_FALLBACK=true` para leitura legada.
- Trocar injecoes diretas de `CloudinaryService` por servico abstrato nos modulos:
  - `src/uploads/uploads.controller.ts`
  - `src/inspections/inspections.service.ts`

## Fase 3 - Modelo de Dados e Migration

- Evitar acoplamento ao nome do provedor no schema.
- Criar migration para campos neutros, mantendo compatibilidade:
  - `storage_provider` (`cloudinary` | `bucketeer`)
  - `storage_asset_id` (substitui conceito de `cloudinary_public_id`)
  - `storage_bucket` (quando aplicavel)
  - `storage_key` (path/chave no Bucketeer)
- Backfill inicial (sem mover arquivo) para dados existentes:
  - `storage_provider='cloudinary'`
  - `storage_asset_id=cloudinary_public_id`
- Manter `url` por transicao; futuramente gerar URL sob demanda (especialmente se bucket privado).

## Fase 4 - Escrita no Bucketeer (Cutover)

- Em ambientes nao-produtivos:
  - ativar `STORAGE_PROVIDER=bucketeer`
  - validar upload/delecao em `/uploads`, evidencias e assinaturas.
- Em producao:
  - deploy com codigo compativel (sem ativar flag)
  - ativar flag por janela controlada
  - monitorar erros 4xx/5xx, latencia e tamanho medio de upload.
- Garantir idempotencia de delecao (nao falhar fluxo de negocio se arquivo ja foi removido).

## Fase 5 - Migracao de Ativos Legados (Opcional, recomendado)

- Criar job batch para copiar ativos Cloudinary -> Bucketeer:
  - selecionar registros por pagina (`evidences` e `signatures`)
  - baixar asset pela `url` antiga
  - subir no Bucketeer
  - atualizar `storage_provider`, `storage_key`, `storage_bucket`, `url`
  - manter log de sucesso/falha por registro.
- Executar em lotes pequenos e reprocessaveis.
- Reconciliar contagem final:
  - total registros vs total migrados
  - lista de falhas para reexecucao.

## Fase 6 - Descomissionamento Cloudinary

- Quando `storage_provider='cloudinary'` for zero (ou aceitavelmente baixo):
  - remover dependencia de runtime do Cloudinary
  - remover `CloudinaryModule` de `src/app.module.ts`
  - remover variavel `CLOUDINARY_URL` de `.env.example`
  - atualizar docs (`README.md` e `API_DOCUMENTATION.md`)
  - planejar migration de limpeza para remover `cloudinary_public_id` apos periodo de seguranca.

## Variaveis de Ambiente (Proposta)

- `STORAGE_PROVIDER=bucketeer`
- `S3_ENDPOINT=...` (endpoint do Bucketeer)
- `S3_REGION=...`
- `S3_BUCKET=...`
- `S3_ACCESS_KEY_ID=...`
- `S3_SECRET_ACCESS_KEY=...`
- `S3_FORCE_PATH_STYLE=true|false` (conforme endpoint)
- `S3_SIGNED_URL_TTL_SECONDS=...` (se bucket privado)

## Plano de Testes

- Testes unitarios:
  - adaptador Bucketeer (upload/delecao/erros)
  - servico abstrato com selecao por provider.
- Testes de integracao:
  - `POST /uploads` retorna `assetId/url` validos
  - upload de evidencia e assinatura em inspecoes
  - delecao de evidencia remove registro e tenta remover asset remoto.
- Testes de regressao:
  - leitura de registros legados Cloudinary
  - sync offline que depende de `url` e identificador de asset.

## Observabilidade e Operacao

- Adicionar logs estruturados com:
  - provider
  - bucket/key (sem vazar credenciais)
  - tempo de upload/delecao
  - tamanho do arquivo.
- Criar metricas:
  - taxa de sucesso de upload/delecao
  - latencia p95
  - erros por provider.
- Criar alerta para aumento de falhas apos cutover.

## Rollback

- Rollback rapido via flag:
  - `STORAGE_PROVIDER=cloudinary`
- Como o schema sera compativel, o rollback nao depende de migration reversa imediata.
- Manter Cloudinary ativo durante periodo de estabilizacao (ex.: 2 a 4 semanas).

## Riscos e Mitigacoes

- **URLs privadas quebrando consumo atual**: manter `url` publica/assinada compativel e validar clientes.
- **Falha em delecao remota**: tornar delecao resiliente e observavel; nao travar processo principal.
- **Inconsistencia durante backfill**: job idempotente com checkpoints e reprocessamento.
- **Aumento de latencia**: usar upload por stream e monitorar p95/p99.

## Cronograma Sugerido

- Semana 1: Fases 1 e 2 (infra + abstracao no codigo).
- Semana 2: Fases 3 e 4 (schema compativel + cutover controlado).
- Semana 3: Fase 5 (migracao de legado) e monitoracao.
- Semana 4: Fase 6 (descomissionamento progressivo).

## Criterios de Conclusao

- 100% dos novos uploads no Bucketeer.
- Taxa de erro de upload/delecao dentro do baseline definido.
- Sem incidentes de acesso a imagem/assinatura apos cutover.
- Cloudinary removido de runtime e documentacao atualizada.
