---
name: node-memory-audit
description: Audita uso de memória no backend Node.js/NestJS do Sanorte hospedado na Heroku. Use ao revisar uploads, sync, imports, queries TypeORM, buffers/base64, vazamentos ou erros R14/R15 de memória no sanorte-vistorias-backend.
---

# Node Memory Audit — Sanorte Backend (Heroku)

Auditoria de memória alinhada ao deploy **Heroku** (`Procfile`: `web: node dist/main`).

Objetivo: evitar **R14 (Memory quota exceeded)** e reinícios do dyno por pico de heap ou acúmulo de buffers.

## Contexto Heroku

| Fato | Implicação |
|------|------------|
| Dyno com RAM limitada (ex.: 512 MB) | Picos simultâneos de upload + query pesada estouram rápido |
| Filesystem efêmero | `/tmp` ok para arquivos temporários; limpar sempre |
| Processo único por dyno web | Sem assumir outro nó para absorver carga |
| GC não libera imediato | Buffers grandes ficam no heap até coleta |

## Padrões aprovados neste projeto

Use como referência ao revisar ou implementar.

### Uploads (Multer → Cloudinary)

```typescript
// ✅ Padrão: disco em /tmp + stream + cleanup
FileInterceptor('file', {
  storage: createTempDiskStorage('sanorte-upload'),
  limits: { fileSize: 10 * 1024 * 1024 },
})
// ...
try {
  await cloudinaryService.uploadImageFromPath(file.path, options);
} finally {
  await fs.unlink(file.path).catch(() => undefined);
}
```

Arquivos de referência:

- `src/common/multer/temp-disk.storage.ts`
- `src/cloudinary/cloudinary.service.ts` — `uploadImageFromPath`, `uploadImageStream`, `pipeline`
- `src/uploads/uploads.controller.ts`
- `src/inspections/inspections.service.ts` — `addEvidence`

### Queries enxutas (TypeORM)

```typescript
// ✅ Detalhe/PDF: findOneDetail — queries paralelas com select explícito
// ✅ Updates/gestão: findInspectionCoreForUpdateItems / findInspectionCoreForManagement
// ❌ Evitar findOne() com grafo completo de relations para operações pontuais
```

`findOne()` em `inspections.service.ts` ainda carrega grafo grande — **só** quando a resposta completa é necessária; não reutilizar em fluxos de update/paralyze/evidence.

### Sync offline

- Processar **uma vistoria por vez** no loop (`syncSingleInspection`)
- **Rejeitar** `dataUrl` em evidências/assets no payload (teste em `inspections.service.spec.ts`)
- Preferir URLs Cloudinary já enviadas via upload separado

### Validações sem carregar tudo

- `assertNonConformItemsHaveRequiredEvidence` — `count()` por item, não `relations: ['evidences']`

## Red flags — buscar no código

Execute grep mental ou real nestes padrões:

| Padrão | Risco |
|--------|-------|
| `memoryStorage()` / Multer sem `createTempDiskStorage` | Arquivo inteiro no heap |
| `file.buffer` | Buffer duplicado em RAM |
| `readFileSync` / `writeFileSync` em arquivos grandes | Bloqueio + heap |
| `Buffer.from(base64)` em payloads JSON grandes | Assinatura, resolução, sync |
| `findOne({ relations: [...] })` com muitas relations | Grafo ORM gigante |
| `find()` sem `select` / `take` em listagens | Linhas + joins desnecessários |
| `XLSX.read(file.buffer)` | Planilha inteira em memória |
| `FilesService` (`saveEvidence` usa `file.buffer`) | Legacy — deprecated |
| Resposta API com `dataUrl` embutido | Multiplica tamanho do JSON |
| Sync/import em lote sem limite de tamanho | Array JSON monolítico |
| Temp file sem `unlink` em `finally` | Disco + descriptor leak |
| `uploadImage(buffer)` sem necessidade | Preferir `uploadImageFromPath` |

Comandos úteis na auditoria:

```bash
cd sanorte-vistorias-backend
rg -n "memoryStorage|file\.buffer|readFileSync|writeFileSync|Buffer\.from|dataUrl|relations:\s*\[" src/
rg -n "findOne\(" src/inspections/ src/uploads/ src/service-orders/
```

## Pontos de entrada prioritários

Revisar primeiro (maior impacto histórico no projeto):

1. **`POST /inspections/:id/evidences`** — multipart
2. **`POST /uploads`** — multipart genérico
3. **`POST /sync/inspections`** — batch JSON
4. **`POST /inspections/:id/signature`** — base64 no body
5. **`POST .../items/:itemId/resolve`** — `resolutionEvidence` base64
6. **`GET /inspections/:id`** — `findOneDetail` vs `findOne`
7. **Import OS** — `service-orders.service.ts` + `XLSX.read(file.buffer)`
8. **Fluxos que ainda chamam `findOne()`** após update (paralyze/unparalyze/resolve)

## Processo de auditoria

```
1. Escopo      → endpoint, PR ou módulo
2. Entrada     → tamanho máximo de payload/upload
3. Heap        → buffers, base64, multer storage
4. ORM         → relations, select, paginação
5. Saída       → JSON com imagens embutidas?
6. Cleanup     → unlink, streams fechados, delete Cloudinary
7. Relatório   → achados + fix alinhado aos padrões do repo
```

## Correções recomendadas (ordem)

1. **Multer disk** + `uploadImageFromPath` + `finally unlink`
2. **Trocar `findOne()` pesado** por helper `findInspectionCore*` ou `findOneDetail`
3. **`select` explícito** e queries paralelas em vez de `relations` profundas
4. **Rejeitar base64 grande** — exigir URL Cloudinary ou upload prévio
5. **Limitar batch** — sync/import com tamanho máximo documentado
6. **Stream** planilhas grandes (se import crescer) — avaliar parser streaming
7. **Remover uso de `FilesService`** em código novo

## Formato de saída

```markdown
# Memory Audit — [escopo]

## Contexto Heroku
[dyno, endpoint, sintoma R14/R15 se houver]

## Resumo
[risco: Baixo | Médio | Alto | Crítico]

## Achados

### Crítico
- **Onde:** arquivo:linha
- **Problema:** ...
- **Impacto heap:** ...
- **Fix:** [padrão do projeto]

### Importante / Sugestão
...

## Verificação
- [ ] Upload usa createTempDiskStorage + unlink
- [ ] Sem file.buffer desnecessário
- [ ] Queries com select/limit
- [ ] Sync sem dataUrl
- [ ] Respostas sem base64 embutido
- [ ] npm test passa após fix

## Próximos passos
1. ...
```

## Testes após correção

```bash
cd sanorte-vistorias-backend
npm test -- uploads inspections
```

Cenários manuais em staging Heroku:

- Upload de imagem ~10 MB (limite atual)
- Sync com N vistorias (observar memória no log/metrics)
- Detalhe de vistoria com muitas evidências

## Referências

- `ARCHITECTURE.md` — uploads e integrações
- `DOMAIN.md` — sync offline (sem dataUrl)
- Skill `sanorte-backend` — padrões NestJS
- Commit histórico: *reduce memory usage in inspection management flows*, *fix uploads leaks memory*
