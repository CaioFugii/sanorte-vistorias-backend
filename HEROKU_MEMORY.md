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
| Log por request (`rssMb`, `heapUsedMb`, deltas) | Código no repo; **falta deploy** depois de `v156` | Qual `path` coincidiu com o salto de memória |
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

Candidatos deste projeto (ordem histórica de impacto):

- `POST /inspections/:id/evidences` e `POST /uploads`
- `POST /sync/inspections`
- `POST /inspections/:id/signature` (ainda `imageBase64`)
- `POST /service-orders/import` (`XLSX.read(file.buffer)` + Multer em memória)
- vários `GET /dashboards/*` em paralelo
- `findOne()` com grafo completo após update/paralyze/resolve

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

## Pendências

- [ ] Deploy do log por request (`HttpLoggingInterceptor` + `getProcessMemorySnapshot`)
- [ ] Log drain se for preciso guardar janelas de horas (o Metrics da Heroku não substitui path)
- [ ] Sentry Performance / Profiling (sample baixo) para transação + alocação
- [ ] Tirar base64 de assinatura/resolução; import de OS sem `file.buffer`; não recarregar `findOne()` pesado após mutação

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
