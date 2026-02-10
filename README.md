# Sistema de Vistorias em Campo - Backend API

API REST desenvolvida com NestJS para gerenciamento de vistorias em campo realizadas por fiscais.

## 🚀 Tecnologias

- **NestJS** - Framework Node.js
- **TypeORM** - ORM para PostgreSQL
- **PostgreSQL** - Banco de dados
- **JWT** - Autenticação
- **PDFKit** - Geração de PDFs
- **TypeScript** - Linguagem

## 📋 Pré-requisitos

- Node.js 18+ 
- PostgreSQL 12+
- npm ou yarn

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone <repo-url>
cd sanorte-vistorias-backend
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=vistorias_db

PORT=3000
NODE_ENV=development

JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h

UPLOAD_MAX_SIZE=5242880
STORAGE_PATH=./storage
```

4. Crie o banco de dados:
```bash
createdb vistorias_db
```

5. Execute as migrations:
```bash
npm run migration:run
```

6. Execute o seed para criar usuários iniciais:
```bash
npm run seed
```

## 👥 Usuários Padrão (Seed)

Após executar o seed, os seguintes usuários estarão disponíveis:

| Email | Senha | Role |
|-------|-------|------|
| admin@sanorte.com | senha123 | ADMIN |
| gestor@sanorte.com | senha123 | GESTOR |
| fiscal@sanorte.com | senha123 | FISCAL |

**⚠️ IMPORTANTE:** Altere as senhas em produção!

## 🏃 Executando a Aplicação

### Desenvolvimento
```bash
npm run start:dev
```

A API estará disponível em `http://localhost:3000`

### Produção
```bash
npm run build
npm run start:prod
```

## 📚 Estrutura do Projeto

```
src/
├── auth/              # Autenticação JWT
├── users/             # Gerenciamento de usuários
├── teams/             # Gerenciamento de equipes
├── collaborators/     # Gerenciamento de colaboradores
├── checklists/        # Gerenciamento de checklists
├── inspections/       # Gerenciamento de vistorias
├── dashboards/        # Dashboards e relatórios
├── files/             # Upload de arquivos
├── pdf/               # Geração de PDFs
├── entities/           # Entidades TypeORM
├── common/             # Enums, decorators, guards
├── config/             # Configurações
└── database/          # Migrations e seeds
```

## 🔐 Autenticação

A API usa JWT para autenticação. Para acessar endpoints protegidos:

1. Faça login em `POST /auth/login`:
```json
{
  "email": "fiscal@sanorte.com",
  "password": "senha123"
}
```

2. Use o token retornado no header:
```
Authorization: Bearer <token>
```

## 📖 Endpoints Principais

### Autenticação
- `POST /auth/login` - Login
- `GET /auth/me` - Dados do usuário logado

### Equipes
- `GET /teams` - Listar equipes
- `POST /teams` - Criar equipe (ADMIN)
- `PUT /teams/:id` - Atualizar equipe (ADMIN)
- `DELETE /teams/:id` - Deletar equipe (ADMIN)

### Colaboradores
- `GET /collaborators` - Listar colaboradores
- `POST /collaborators` - Criar colaborador (ADMIN)
- `PUT /collaborators/:id` - Atualizar colaborador (ADMIN)
- `DELETE /collaborators/:id` - Deletar colaborador (ADMIN)

### Checklists
- `GET /checklists?module=SEGURANCA_TRABALHO` - Listar checklists
- `GET /checklists/:id` - Detalhes do checklist
- `POST /checklists` - Criar checklist (ADMIN)
- `PUT /checklists/:id` - Atualizar checklist (ADMIN)
- `POST /checklists/:id/items` - Adicionar item (ADMIN)
- `PUT /checklists/:id/items/:itemId` - Atualizar item (ADMIN)
- `DELETE /checklists/:id/items/:itemId` - Remover item (ADMIN)

### Vistorias
- `POST /inspections` - Criar vistoria (FISCAL/GESTOR)
- `GET /inspections` - Listar vistorias (ADMIN/GESTOR) com filtros
- `GET /inspections/mine` - Minhas vistorias (FISCAL)
- `GET /inspections/:id` - Detalhes da vistoria
- `PUT /inspections/:id` - Atualizar vistoria
- `PUT /inspections/:id/items` - Atualizar respostas dos itens
- `POST /inspections/:id/evidences` - Upload de evidência (multipart/form-data)
- `POST /inspections/:id/signature` - Adicionar assinatura
- `POST /inspections/:id/finalize` - Finalizar vistoria (FISCAL/GESTOR)
- `POST /inspections/:id/resolve` - Resolver pendência (GESTOR/ADMIN)
- `GET /inspections/:id/pdf` - Gerar PDF da vistoria

### Dashboards
- `GET /dashboards/summary?from=2024-01-01&to=2024-12-31` - Resumo geral
- `GET /dashboards/ranking/teams?from=2024-01-01&to=2024-12-31` - Ranking de equipes

## 🎯 Módulos (Hardcoded)

Os módulos são fixos e não possuem CRUD:
- `SEGURANCA_TRABALHO`
- `OBRAS_INVESTIMENTO`
- `OBRAS_GLOBAL`
- `CANTEIRO`

## 👮 Regras de Permissão (RBAC)

### FISCAL
- Pode criar e finalizar vistorias
- Pode editar apenas vistorias em RASCUNHO
- Não pode editar vistorias finalizadas
- Não pode resolver pendências

### GESTOR
- Pode criar e finalizar vistorias
- Pode editar vistorias finalizadas
- Pode resolver pendências

### ADMIN
- Acesso total ao sistema
- Pode gerenciar usuários, equipes, colaboradores e checklists

## 📝 Regras de Negócio

### Cálculo de Percentual
- Itens avaliados = itens com resposta diferente de `NAO_APLICAVEL`
- Percentual = (qtd CONFORME / qtd avaliados) * 100
- Se não houver itens avaliados, percentual = 100

### Pendência
- Se existir pelo menos 1 item `NAO_CONFORME` em vistoria finalizada:
  - Status vira `PENDENTE_AJUSTE`
  - Cria/atualiza `PendingAdjustment` com status `PENDENTE`
- Se não houver `NAO_CONFORME`, status permanece `FINALIZADA`

### Validações ao Finalizar
- Assinatura do líder/encarregado é obrigatória
- Itens `NAO_CONFORME` com `requiresPhotoOnNonConformity = true` devem ter pelo menos 1 evidência

## 📁 Upload de Arquivos

Arquivos são armazenados localmente em:
- `./storage/evidences/` - Fotos de evidência
- `./storage/signatures/` - Assinaturas

Formatos aceitos: JPG, PNG, WEBP
Tamanho máximo: 5MB (configurável via `UPLOAD_MAX_SIZE`)

## 📄 Geração de PDF

O PDF gerado inclui:
- Dados da vistoria
- Tabela com todos os itens do checklist e respostas
- Percentual de conformidade
- Evidências (referências)
- Assinatura digital

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes com cobertura
npm run test:cov

# Testes em modo watch
npm run test:watch
```

## 🗄️ Migrations

```bash
# Executar migrations
npm run migration:run

# Reverter última migration
npm run migration:revert

# Gerar nova migration (após alterar entidades)
npm run migration:generate -- -n NomeDaMigration
```

## 📦 Docker (Opcional)

Para facilitar o setup local, você pode usar Docker:

```yaml
# docker-compose.yml (exemplo)
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: vistorias_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```bash
docker-compose up -d
```

## 🔍 Exemplos de Requisições

### Criar Vistoria
```bash
curl -X POST http://localhost:3000/inspections \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "SEGURANCA_TRABALHO",
    "checklistId": "checklist-id",
    "teamId": "team-id",
    "serviceDescription": "Vistoria de segurança",
    "locationDescription": "Canteiro principal"
  }'
```

### Upload de Evidência
```bash
curl -X POST http://localhost:3000/inspections/inspection-id/evidences \
  -H "Authorization: Bearer <token>" \
  -F "file=@foto.jpg" \
  -F "inspectionItemId=item-id"
```

### Finalizar Vistoria
```bash
curl -X POST http://localhost:3000/inspections/inspection-id/finalize \
  -H "Authorization: Bearer <token>"
```

## 🚀 Deploy na Heroku

### Pré-requisitos

- Conta na [Heroku](https://www.heroku.com)
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) instalado
- Git configurado

### Passo a Passo

1. **Login na Heroku:**
```bash
heroku login
```

2. **Criar aplicação na Heroku:**
```bash
heroku create sua-app-name
```

3. **Adicionar addon PostgreSQL:**
```bash
heroku addons:create heroku-postgresql:mini
```

4. **Configurar variáveis de ambiente:**
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=seu-jwt-secret-super-seguro-aqui
heroku config:set JWT_EXPIRES_IN=24h
heroku config:set UPLOAD_MAX_SIZE=5242880
```

**Nota:** A variável `DATABASE_URL` é configurada automaticamente pelo addon PostgreSQL.

5. **Fazer deploy:**
```bash
git push heroku main
```

6. **Executar migrations:**
```bash
heroku run npm run migration:run
```

7. **Executar seed (opcional):**
```bash
heroku run npm run seed
```

8. **Abrir aplicação:**
```bash
heroku open
```

### Comandos Úteis

```bash
# Ver logs
heroku logs --tail

# Executar comando no dyno
heroku run bash

# Ver variáveis de ambiente
heroku config

# Verificar status
heroku ps

# Reiniciar aplicação
heroku restart
```

### ⚠️ Limitações na Heroku

**Filesystem Efêmero:**
- O filesystem da Heroku é efêmero (arquivos são perdidos quando o dyno reinicia)
- Uploads de evidências e assinaturas serão perdidos após reinicialização
- **Recomendação:** Para produção, implemente armazenamento em nuvem (AWS S3, Cloudinary, etc)

**Solução Temporária:**
- Para desenvolvimento/testes, os arquivos funcionarão normalmente
- Para produção, considere migrar para serviço de storage externo

### Variáveis de Ambiente na Heroku

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `DATABASE_URL` | URL do PostgreSQL (configurado automaticamente) | Sim |
| `NODE_ENV` | Ambiente (production) | Sim |
| `JWT_SECRET` | Secret para JWT | Sim |
| `JWT_EXPIRES_IN` | Expiração do token (padrão: 24h) | Não |
| `UPLOAD_MAX_SIZE` | Tamanho máximo de upload em bytes | Não |
| `PORT` | Porta (configurada automaticamente pela Heroku) | Não |

### Troubleshooting

**Erro de conexão com banco:**
```bash
# Verificar se o addon está ativo
heroku addons

# Verificar DATABASE_URL
heroku config:get DATABASE_URL
```

**Erro ao executar migrations:**
```bash
# Verificar se o build foi bem-sucedido
heroku logs --tail

# Executar migration manualmente
heroku run npm run migration:run
```

**Aplicação não inicia:**
```bash
# Verificar logs
heroku logs --tail

# Verificar se o Procfile está correto
cat Procfile
```

## 📝 Notas

- O sistema foi desenvolvido para funcionar localmente
- Uploads e PDFs são gerados no filesystem (na Heroku são efêmeros)
- Não há dependência de serviços externos (S3, GCP, etc) - mas recomendado para produção
- Em produção, considere implementar:
  - Armazenamento em nuvem para arquivos (AWS S3, Cloudinary, etc)
  - Cache para dashboards
  - Rate limiting
  - Logging estruturado
  - Monitoramento (Sentry, New Relic, etc)

## 📄 Licença

Este projeto é privado e proprietário.
