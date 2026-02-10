# 🚀 Guia de Deploy na Heroku

## Pré-requisitos

- Conta na [Heroku](https://www.heroku.com) (gratuita)
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) instalado
- Git configurado

## Deploy Rápido

### 1. Login e Criar App

```bash
# Login na Heroku
heroku login

# Criar aplicação
heroku create sua-app-name

# Ou usar o app.json (deploy via dashboard)
# Acesse: https://dashboard.heroku.com/new-app
```

### 2. Adicionar PostgreSQL

```bash
# Adicionar addon PostgreSQL (gratuito)
heroku addons:create heroku-postgresql:mini

# Verificar se foi adicionado
heroku addons
```

### 3. Configurar Variáveis de Ambiente

```bash
# Variáveis obrigatórias
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# Variáveis opcionais
heroku config:set JWT_EXPIRES_IN=24h
heroku config:set UPLOAD_MAX_SIZE=5242880
```

**Nota:** A variável `DATABASE_URL` é configurada automaticamente pelo addon PostgreSQL.

### 4. Fazer Deploy

```bash
# Adicionar remote Heroku (se ainda não tiver)
heroku git:remote -a sua-app-name

# Fazer deploy
git push heroku main

# Ou se estiver em outra branch
git push heroku sua-branch:main
```

### 5. Executar Migrations

As migrations são executadas automaticamente após o deploy (via `release` no Procfile).

Para executar manualmente:

```bash
heroku run npm run migration:run
```

### 6. Executar Seed (Opcional)

```bash
heroku run npm run seed
```

### 7. Abrir Aplicação

```bash
heroku open
```

## Comandos Úteis

```bash
# Ver logs em tempo real
heroku logs --tail

# Ver logs das últimas 100 linhas
heroku logs -n 100

# Executar comando no dyno
heroku run bash

# Ver variáveis de ambiente
heroku config

# Ver configuração específica
heroku config:get JWT_SECRET

# Ver status dos dynos
heroku ps

# Reiniciar aplicação
heroku restart

# Ver informações da aplicação
heroku info

# Escalar dynos (para produção)
heroku ps:scale web=1
```

## Verificação Pós-Deploy

### 1. Verificar se a aplicação está rodando

```bash
heroku ps
```

Deve mostrar algo como:
```
=== web (Free): node dist/main (1)
web.1: up 2024/01/15 10:30:00 +0000 (~ 5m ago)
```

### 2. Testar endpoint de health

```bash
curl https://sua-app-name.herokuapp.com/auth/login
```

### 3. Verificar logs

```bash
heroku logs --tail
```

## Troubleshooting

### Erro: "Cannot find module"

**Causa:** Dependências não instaladas ou build falhou.

**Solução:**
```bash
# Verificar build
heroku logs --tail

# Rebuild
git commit --allow-empty -m "rebuild"
git push heroku main
```

### Erro: "Connection refused" (banco de dados)

**Causa:** PostgreSQL não configurado ou DATABASE_URL incorreta.

**Solução:**
```bash
# Verificar addon
heroku addons

# Verificar DATABASE_URL
heroku config:get DATABASE_URL

# Se não existir, adicionar PostgreSQL
heroku addons:create heroku-postgresql:mini
```

### Erro: "Migration failed"

**Causa:** Erro nas migrations ou banco não acessível.

**Solução:**
```bash
# Ver logs do release
heroku releases

# Executar migration manualmente
heroku run npm run migration:run

# Verificar conexão com banco
heroku run npm run typeorm query "SELECT 1"
```

### Erro: "Port already in use"

**Causa:** Aplicação tentando usar porta fixa.

**Solução:** Verificar se `main.ts` está usando `process.env.PORT` (já configurado).

### Aplicação não inicia

**Verificações:**
1. Verificar Procfile:
```bash
cat Procfile
```

2. Verificar se o build foi bem-sucedido:
```bash
heroku logs --tail
```

3. Verificar variáveis de ambiente:
```bash
heroku config
```

## Variáveis de Ambiente

| Variável | Descrição | Obrigatório | Padrão |
|----------|-----------|-------------|--------|
| `DATABASE_URL` | URL do PostgreSQL | Sim* | - |
| `NODE_ENV` | Ambiente | Sim | - |
| `JWT_SECRET` | Secret para JWT | Sim | - |
| `JWT_EXPIRES_IN` | Expiração do token | Não | 24h |
| `UPLOAD_MAX_SIZE` | Tamanho máximo upload (bytes) | Não | 5242880 |
| `PORT` | Porta | Não* | - |

*Configurado automaticamente pela Heroku

## Limitações da Heroku Free

1. **Filesystem Efêmero:**
   - Arquivos salvos localmente são perdidos quando o dyno reinicia
   - Uploads de evidências e assinaturas não persistem
   - **Solução:** Implementar storage externo (S3, Cloudinary, etc)

2. **Sleep Mode:**
   - Dynos gratuitos "dormem" após 30 minutos de inatividade
   - Primeira requisição após sleep pode demorar alguns segundos

3. **Limite de Dynos:**
   - Plano free: 1 dyno web
   - Para escalar, upgrade para plano pago

## Próximos Passos (Produção)

1. **Storage de Arquivos:**
   - Implementar AWS S3 ou Cloudinary
   - Atualizar `FilesService` para usar storage externo

2. **Monitoramento:**
   - Adicionar Sentry para error tracking
   - Configurar New Relic ou similar

3. **Logging:**
   - Implementar logging estruturado
   - Configurar Papertrail ou Logentries

4. **Cache:**
   - Adicionar Redis para cache
   - Implementar cache em dashboards

5. **Rate Limiting:**
   - Implementar rate limiting
   - Proteger endpoints públicos

6. **SSL:**
   - Heroku já fornece SSL automático
   - Verificar certificado: `heroku certs`

## Suporte

Para mais informações:
- [Documentação Heroku](https://devcenter.heroku.com/)
- [Heroku Node.js Support](https://devcenter.heroku.com/articles/nodejs-support)
- [Heroku Postgres](https://devcenter.heroku.com/articles/heroku-postgresql)
