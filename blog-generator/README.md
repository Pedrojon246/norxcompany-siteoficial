# 📰 Norx Blog Generator

Blog automático da Norx Company.  
**Sem IA. Sem API paga. 100% código Node.js.**

Roda no GitHub Actions, publica no Vercel.  
3 posts a cada 2 dias — nichos: cripto, tech, startup, imóveis.

---

## Como funciona

```
RSS Feeds (grátis)
      ↓
rss-parser — lê os feeds
      ↓
TextRank (algoritmo matemático) — extrai frases-chave
      ↓
Thesaurus PT-BR — substitui sinônimos
      ↓
Templates por nicho — envolve com intro/opinião/CTA da Norx
      ↓
HTML estático gerado em /public/blog/
      ↓
GitHub Actions faz push → Vercel publica automaticamente
```

---

## Estrutura de arquivos

```
blog-generator/
├── .github/
│   └── workflows/
│       └── blog-generator.yml   ← cron do GitHub Actions
├── scripts/
│   ├── generate-posts.js        ← orquestrador principal
│   ├── processor.js             ← TextRank + sinônimos
│   └── builder.js               ← gerador de HTML
├── data/
│   ├── feeds.js                 ← feeds RSS por nicho
│   ├── thesaurus.js             ← dicionário de sinônimos PT-BR
│   └── templates.js             ← intros/opiniões/CTAs por nicho
├── public/
│   └── blog/                    ← HTMLs gerados aqui
│       ├── index.html           ← página principal do blog
│       ├── registry.json        ← controle de duplicatas
│       └── *.html               ← posts individuais
└── package.json
```

---

## Setup — passo a passo

### 1. Adicionar ao repositório norxcompany-siteoficial

```bash
# Na raiz do seu repositório, crie a pasta blog-generator
mkdir blog-generator
# Copie todos os arquivos deste projeto para blog-generator/
```

### 2. Instalar dependências localmente (para testar)

```bash
cd blog-generator
npm install
```

### 3. Testar localmente (sem publicar nada)

```bash
npm test
# ou
node scripts/generate-posts.js --test
```

Você verá no terminal os posts que seriam gerados, sem criar arquivo nenhum.

### 4. Gerar posts localmente (cria os HTMLs)

```bash
npm run generate
```

Os arquivos aparecem em `public/blog/`.

### 5. Configurar no GitHub

O arquivo `.github/workflows/blog-generator.yml` já está pronto.  
Basta fazer push do repositório — o GitHub Actions roda automaticamente.

**Permissão necessária:**  
Vá em `Settings > Actions > General > Workflow permissions`  
e marque **"Read and write permissions"**.

### 6. Conectar o blog ao site da Norx Company

No repositório do norxcompany-siteoficial, adicione no `vercel.json`:

```json
{
  "routes": [
    { "src": "/blog/(.*)", "dest": "/blog-generator/public/blog/$1" },
    { "src": "/blog",      "dest": "/blog-generator/public/blog/index.html" }
  ]
}
```

Assim `norxcompany.com.br/blog` aponta direto para os HTMLs gerados.

---

## Rodar manualmente pelo GitHub

Vá em `Actions > Gerador de Blog Norx > Run workflow`.  
Útil para testar antes de esperar o cron.

---

## Adicionar/remover feeds RSS

Edite `data/feeds.js` — basta adicionar ou remover URLs.  
Feeds que falham são ignorados automaticamente (sem quebrar o processo).

## Personalizar templates

Edite `data/templates.js` — adicione novos intros, opiniões e CTAs.  
O sistema rotaciona entre eles aleatoriamente.

## Adicionar sinônimos

Edite `data/thesaurus.js` — adicione pares `"palavra": ["sinônimo1", "sinônimo2"]`.

---

## Dependências (todas gratuitas)

| Pacote | Uso |
|--------|-----|
| `rss-parser` | Lê feeds RSS |
| `natural` | Tokenização e stemming PT-BR |
| `node-nlp` | NLP em português |
| `compromise` | Análise frasal |
| `axios` | HTTP |
| `cheerio` | Parse de HTML |
| `slugify` | Gera slugs de URL |
| `date-fns` | Formatação de datas PT-BR |
| `fs-extra` | Manipulação de arquivos |

---

## Custo total: R$ 0,00/mês
