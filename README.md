# Norx Company — Site Institucional

Site institucional da Norx Company, construído em HTML/CSS/JS puro para deploy no Vercel.

## 🗂️ Estrutura

```
norx-company/
├── index.html                    ← Home
├── vercel.json                   ← Configuração do Vercel
├── css/
│   └── main.css                  ← Estilos globais
├── js/
│   └── main.js                   ← Header, footer e animações (injetados via JS)
├── assets/
│   └── images/                   ← Logos e assets visuais
├── produtos/
│   ├── norxcoin.html
│   ├── norxpay.html
│   ├── grupbuy.html
│   ├── corretor-pro.html
│   └── snake-mining.html
└── blog/
    ├── index.html                ← Lista de posts
    └── norxcoin-lancamento.html  ← Exemplo de post
```

## 🚀 Deploy no Vercel

1. Faça push deste repositório para o GitHub
2. Acesse [vercel.com](https://vercel.com) e clique em "Add New Project"
3. Importe o repositório do GitHub
4. Nas configurações, **não altere nada** — o Vercel detecta automaticamente como site estático
5. Clique em **Deploy**

## ✍️ Como adicionar um novo post no Blog

1. Crie um novo arquivo `.html` na pasta `blog/` baseando-se em `norxcoin-lancamento.html` como template
2. Adicione o link do novo post em `blog/index.html` (na seção "Todos os Posts")
3. Faça commit e push — o Vercel faz deploy automaticamente

## 🎨 Paleta de Cores

| Variável | Valor | Uso |
|---|---|---|
| `--bg` | `#080808` | Fundo principal |
| `--surface` | `#1c1c1c` | Cards e superfícies |
| `--accent` | `#c9a961` | Gold — cor de destaque |
| `--text` | `#f0ede8` | Texto principal |
| `--text-secondary` | `#9e9e9e` | Texto secundário |

## 📁 Adicionando novas logos

Coloque os arquivos em `assets/images/` e referencie com o caminho `/assets/images/nome-do-arquivo.ext`.

## 🛠️ Desenvolvimento local

Qualquer servidor HTTP simples funciona. Opções:

```bash
# Python
python3 -m http.server 3000

# Node.js (npx)
npx serve .

# VS Code: instale a extensão "Live Server"
```

Acesse `http://localhost:3000`
