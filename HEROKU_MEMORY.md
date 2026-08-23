# Memória na Heroku — registro e como avaliar

App: `sanorte-vistorias-backend`  
Dyno: `web` Standard-1X (**512 MB**)  
Frontend: Netlify (não consome RAM deste dyno)

Usar este arquivo no próximo pico, crash (`R14` / `H10`) ou revisão de carga. Auditoria de código: `.skills/node-memory-audit.md`.

> A pasta `docs/` do backend está no `.gitignore` (gerada). Este registro fica na raiz do repositório para versionar.

## O que já está ligado (2026-08-17)

| Peça | Estado | O que mostra |
|------|--------|----------------|
| `log-runtime-metrics` | **Ativo** em produção (após restart 15:19 BRT) | RSS do dyno a cada ~20s, independente de deploy |
| Log por request (`rssMb`, `heapUsedMb`, deltas) | **Ativo** em produção (visto nos logs de 2026-08-18) | Qual `path` coincidiu com o salto de memória |
| Log drain (Papertrail, etc.) | **Não há** | Logplex guarda ~1.500 linhas; janelas longas se perdem |
| Sentry (addon free) | Instalado (`SENTRY_DSN`) | Erros, não heap. Profiling ainda não está no app |

Idle após o restart das 15:19 BRT: `sample#memory_rss≈126 MB` de `sample#memory_quota=512 MB`.

## Como avaliar o próximo pico

1. No Metrics da Heroku, anotar o horário do pico (BRT).
2. Nos logs, filtrar `sample#memory_rss`. Acima de **~450 MB** o R14 está próximo.

```bash
heroku logs -a sanorte-vistorias-backend -n 1500 | grep -E 'sample#memory_rss|R14|R15|H10|Error R14'
```

3. Depois do deploy do interceptor, no mesmo minuto filtrar `Request completed` e olhar:
   - `path`, `method`, `durationMs`
   - `rssMb` / `heapUsedMb` (absoluto)
   - `rssDeltaMb` / `heapUsedDeltaMb` (variação naquele request; com concorrência o delta é aproximado)

4. Cruzar com Sentry no mesmo horário.

Candidatos deste projeto (ordem de impacto observada):

- `GET /checklists?limit=100` com `relations: items/sections` — +20 a +42 MB por chamada
- `POST /inspections` (`create` → `findOne()` com 15 relations) — crash 2026-08-18 10:33
- `findOne()` com grafo completo após create/update/paralyze/resolve
- `POST /inspections/:id/evidences` e `POST /uploads` (multipart; presign+S3 no fluxo novo)
- `POST /sync/inspections`
- `POST /inspections/:id/signature` (ainda `imageBase64`)
- `POST /service-orders/import` (`XLSX.read(file.buffer)` + Multer em memória)
- `GET /inspections/export` (`XLSX.write` em buffer; limitado a 5000 linhas)
- vários `GET /dashboards/*` em paralelo

## Registro — 2026-08-17

Janela pedida: **10:00–15:00 BRT**. O Logplex **não cobriu** esse intervalo (só ~15:08–15:12 BRT, ~1.500 linhas).

| Horário (BRT) | Fato |
|---------------|------|
| 10:02 | Deploy `v155` (reinicia dyno) |
| 12:58 | Deploy `v156` (reinicia dyno) |
| **14:59:11** | `web.1` subiu de novo **sem release novo** → crash / App crashed, não deploy |
| 15:08–15:12 | Único recorte de log ainda no buffer |
| 15:19 | Restart para ativar `log-runtime-metrics` |

No recorte pós-crash: preenchimento de vistoria em campo, não dashboard.

- 14x `POST /inspections/:id/evidences` (vários com 1,7s–4,2s)
- `POST /inspections`, `PUT .../items`, `POST .../finalize`
- Usuários no recorte: `andre@sanorte.com.br`, `joao.paiva@sanorte.com`

Hipótese principal: várias evidências simultâneas no dyno de 512 MB. Sem o log das 14:59, não dá para cravar a request do crash.

## Registro — 2026-08-18 (10:30–10:55 BRT)

Janela completa no export `logs-export-after-2026-08-18_10-30 (1).csv`. Interceptor por request **já estava** em produção.

| Horário (BRT) | Fato |
|---------------|------|
| 10:30:00–10:32:49 | RSS Heroku ~138 MB. `GET /checklists?limit=100` aloca +11 a +36 MB por chamada (gabriely, raquel). |
| 10:32:55 | `POST /inspections` (raqueldasilva@sanorte.com) entra e **não completa**. |
| 10:32:58 | `GET /service-orders` (gabriely) termina com Node RSS **548 MB** / heap 338 — mas ΔRSS só **+11 MB** (processo já estava inchado). |
| **10:33:12** | **R14**: `memory_rss=472 MB` + `memory_swap=426 MB` → total **898 MB (175%)**. |
| 10:33:15 | `GET /service-orders?osNumber=26101563370` — heap **555 MB**, router **10,5 s**. |
| 10:33:24 | `POST /inspections` → **H12** timeout 30 s / 503. |
| **10:33:32** | **R15**: total **1074 MB**, swap 597 MB, **SIGKILL**, exit 137. |
| 10:33:40 | web.1 up de novo (~152 MB). |
| 10:33:40–10:35:34 | Mesmo padrão (checklists + create). Heroku RSS 152→287 MB, sem novo R14. `POST /inspections` da Raquel às 10:35:14: **+33,5 MB** / 597 ms / JSON 63 KB. |
| 10:35:36–10:50:48 | Furo no export (~15 min). |
| 10:50–10:55 | Idle ~130 MB. `GET /checklists?limit=100` do joao.paiva ainda dá +37 MB, sem crash. |

Hipótese principal: `POST /inspections` (`create` → clona itens → `findOne()` com 15 relations) em cima de `GET /checklists?limit=100` (grafo `items`/`sections` ainda no heap). Upload de evidência **não** participou deste crash.

Mitigação no código (2026-08-18): listagem de checklists só com `sector` + contagens; `POST /inspections` (e update/paralyze/unparalyze/resolve) devolvem `findOneDetail`; o sync cria via `persistNewInspection` sem hidratar o grafo; fill/manage buscam `GET /checklists/:id`; listagem de teams sem joins de colaboradores/contratos.

## Pendências

- [x] Deploy do log por request (`HttpLoggingInterceptor` + `getProcessMemorySnapshot`)
- [x] Evidência da vistoria nova: upload direto ao S3 (presign + `from-storage`); multipart permanece como fallback local
- [ ] CORS no bucket S3: `PUT` + header `Content-Type` para a origem do Netlify (sem localhost em PRD)
- [ ] Log drain se for preciso guardar janelas de horas (o Metrics da Heroku não substitui path)
- [ ] Sentry Performance / Profiling (sample baixo) para transação + alocação
- [x] Listagem de checklists sem `items`/`sections` (a tela nova não precisa do grafo)
- [x] `POST /inspections` não devolver `findOne()` pesado — usar `findOneDetail` / `findInspectionCore*`
- [x] `update` / `paralyze` / `unparalyze` / `resolve` / `resolveItem` sem `findOne()` de grafo completo
- [x] `GET /teams` listagem sem hidratar `collaborators`/`contracts`
- [ ] Tirar base64 de assinatura/resolução; import de OS sem `file.buffer`

## Comandos

```bash
heroku logs -a sanorte-vistorias-backend -n 1500
heroku logs -a sanorte-vistorias-backend -n 1500 --source heroku
heroku ps -a sanorte-vistorias-backend
heroku labs:info log-runtime-metrics -a sanorte-vistorias-backend
```

Exemplo do sample (já em produção):

```text
heroku[web.1]: source=web.1 sample#memory_rss=126.56MB sample#memory_quota=512.00MB
```
