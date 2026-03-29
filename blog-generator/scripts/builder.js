// scripts/builder.js — Gera páginas HTML estáticas

const fs   = require('fs-extra');
const path = require('path');
const { format } = require('date-fns');
const { ptBR }   = require('date-fns/locale');

const OUTPUT_DIR = path.join(__dirname, '../public/blog');

// Ícones por nicho
const NICHE_META = {
  cripto:  { label: 'Criptomoedas',  icon: '₿', color: '#D4AF37' },
  tech:    { label: 'Tecnologia',    icon: '⚡', color: '#4ECDC4' },
  startup: { label: 'Startups',      icon: '🚀', color: '#A8E6CF' },
  imoveis: { label: 'Mercado Imobiliário', icon: '🏠', color: '#7B68EE' },
};

// ─────────────────────────────────────────────
// Gera slug único a partir do título
// ─────────────────────────────────────────────
function makeSlug(title, date) {
  const dateStr = format(new Date(date), 'yyyy-MM-dd');
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${dateStr}-${slug}`;
}

// ─────────────────────────────────────────────
// Template HTML de um post individual
// ─────────────────────────────────────────────
function buildPostHTML(post) {
  const niche   = NICHE_META[post.niche] || NICHE_META.tech;
  const dateStr = format(new Date(post.publishedAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const readTime = Math.ceil((post.paragraphs.join(' ').split(' ').length) / 200);

  const paragraphsHTML = post.paragraphs
    .map(p => `      <p>${p}</p>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.title} | Blog Norx Company</title>
  <meta name="description" content="${post.paragraphs[0]?.slice(0, 155) || ''}">
  <meta property="og:title" content="${post.title}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Norx Company Blog">
  <link rel="canonical" href="https://norxcompany.com.br/blog/${post.slug}.html">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root{--gold:#D4AF37;--bg:#060918;--card:#0f1628;--text:#fff;--muted:#7a85a3;--niche:${niche.color};}
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Exo 2',sans-serif;background:var(--bg);color:var(--text);line-height:1.7;}
    a{color:var(--gold);text-decoration:none;}
    a:hover{text-decoration:underline;}

    /* HEADER */
    .site-header{background:rgba(6,9,24,.95);backdrop-filter:blur(20px);border-bottom:1px solid rgba(212,175,55,.15);padding:1rem 2rem;position:sticky;top:0;z-index:100;display:flex;justify-content:space-between;align-items:center;}
    .site-header .logo{font-size:1rem;font-weight:800;letter-spacing:2px;background:linear-gradient(135deg,#fff,var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .site-header nav a{color:var(--muted);font-size:.82rem;margin-left:1.5rem;transition:.2s;}
    .site-header nav a:hover{color:var(--text);text-decoration:none;}

    /* POST */
    .post-wrap{max-width:760px;margin:0 auto;padding:4rem 2rem 6rem;}
    .post-niche{display:inline-flex;align-items:center;gap:.4rem;font-size:.72rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--niche);background:rgba(255,255,255,.05);border:1px solid var(--niche);padding:.25rem .75rem;border-radius:100px;margin-bottom:1.5rem;}
    .post-title{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;line-height:1.2;margin-bottom:1.5rem;}
    .post-meta{display:flex;align-items:center;gap:1rem;font-size:.78rem;color:var(--muted);margin-bottom:2.5rem;padding-bottom:2rem;border-bottom:1px solid rgba(255,255,255,.07);}
    .post-meta .date::before{content:'📅 ';}
    .post-meta .read::before{content:'⏱ ';}
    .post-meta .src::before{content:'📰 ';}

    /* INTRO NORX */
    .post-intro{background:rgba(212,175,55,.05);border-left:3px solid var(--gold);padding:1.25rem 1.5rem;border-radius:0 8px 8px 0;margin-bottom:2rem;font-size:.95rem;color:#c8c8d0;line-height:1.8;}

    /* CORPO */
    .post-body p{font-size:1rem;color:#c8c8d0;margin-bottom:1.4rem;line-height:1.8;}
    .post-body p:first-child::first-letter{font-size:2.5rem;font-weight:800;color:var(--gold);float:left;line-height:1;margin-right:.1em;margin-top:.05em;}

    /* OPINIÃO NORX */
    .post-opinion{background:var(--card);border:1px solid rgba(212,175,55,.2);border-radius:12px;padding:1.5rem 1.75rem;margin:2.5rem 0;}
    .post-opinion .op-label{font-size:.68rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:.75rem;}
    .post-opinion p{color:#b0bec5;font-size:.92rem;line-height:1.7;}

    /* CTA */
    .post-cta{background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(212,175,55,.03));border:1px solid rgba(212,175,55,.2);border-radius:12px;padding:1.5rem 1.75rem;margin-top:2.5rem;text-align:center;}
    .post-cta p{color:#b0bec5;font-size:.9rem;}
    .post-cta a{color:var(--gold);font-weight:700;}

    /* SOURCE */
    .post-source{margin-top:3rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.06);font-size:.75rem;color:var(--muted);}
    .post-source a{color:var(--muted);}
    .post-source a:hover{color:var(--gold);}

    /* BACK */
    .back-link{display:inline-flex;align-items:center;gap:.4rem;font-size:.82rem;color:var(--muted);margin-bottom:3rem;transition:.2s;}
    .back-link:hover{color:var(--gold);text-decoration:none;}

    /* FOOTER */
    .site-footer{border-top:1px solid rgba(212,175,55,.1);padding:2rem;text-align:center;font-size:.78rem;color:var(--muted);}
  </style>
</head>
<body>

<header class="site-header">
  <a href="https://norxcompany.com.br" class="logo">NORX COMPANY</a>
  <nav>
    <a href="https://norxcompany.com.br">Home</a>
    <a href="/blog">Blog</a>
    <a href="https://norxcoin.norxcompany.com.br">Norxcoin</a>
    <a href="https://wa.me/5522997547731">Contato</a>
  </nav>
</header>

<main class="post-wrap">
  <a href="/blog" class="back-link">← Voltar ao Blog</a>

  <div class="post-niche">${niche.icon} ${niche.label}</div>

  <h1 class="post-title">${post.title}</h1>

  <div class="post-meta">
    <span class="date">${dateStr}</span>
    <span class="read">${readTime} min de leitura</span>
    <span class="src">Norx Company</span>
  </div>

  <div class="post-intro">
    ${post.intro}
  </div>

  <div class="post-body">
${paragraphsHTML}
  </div>

  <div class="post-opinion">
    <div class="op-label">📌 Perspectiva Norx Company</div>
    <p>${post.opinion}</p>
  </div>

  <div class="post-cta">
    <p>${post.cta}</p>
  </div>

  <div class="post-source">
    Baseado em informações de: <a href="${post.sourceUrl}" target="_blank" rel="noopener">${post.source}</a>
  </div>
</main>

<footer class="site-footer">
  <p>© ${new Date().getFullYear()} Norx Company · <a href="https://norxcompany.com.br">norxcompany.com.br</a></p>
</footer>

</body>
</html>`;
}

// ─────────────────────────────────────────────
// Gera página index do blog
// ─────────────────────────────────────────────
function buildIndexHTML(posts) {
  const cardsHTML = posts.slice(0, 50).map(post => {
    const niche   = NICHE_META[post.niche] || NICHE_META.tech;
    const dateStr = format(new Date(post.publishedAt), "d MMM yyyy", { locale: ptBR });
    const excerpt = post.paragraphs[0]?.slice(0, 130) + '...' || '';

    return `
    <a href="/blog/${post.slug}.html" class="card">
      <div class="card-niche" style="color:${niche.color};border-color:${niche.color}">${niche.icon} ${niche.label}</div>
      <h2>${post.title}</h2>
      <p>${excerpt}</p>
      <div class="card-footer">
        <span>${dateStr}</span>
        <span class="read-more">Ler mais →</span>
      </div>
    </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog | Norx Company — Tecnologia, Cripto & Startups</title>
  <meta name="description" content="Acompanhe as principais notícias de tecnologia, criptomoedas, startups e mercado imobiliário com a perspectiva da Norx Company.">
  <link rel="canonical" href="https://norxcompany.com.br/blog">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root{--gold:#D4AF37;--bg:#060918;--card:#0f1628;--text:#fff;--muted:#7a85a3;--border:rgba(212,175,55,.15);}
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Exo 2',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;}
    a{color:inherit;text-decoration:none;}

    .site-header{background:rgba(6,9,24,.95);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:1rem 2rem;position:sticky;top:0;z-index:100;display:flex;justify-content:space-between;align-items:center;}
    .site-header .logo{font-size:1rem;font-weight:800;letter-spacing:2px;background:linear-gradient(135deg,#fff,var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .site-header nav a{color:var(--muted);font-size:.82rem;margin-left:1.5rem;transition:.2s;}
    .site-header nav a:hover{color:var(--text);}

    .hero-blog{text-align:center;padding:5rem 2rem 4rem;background:radial-gradient(ellipse at 50% 0%,rgba(212,175,55,.07),transparent 70%);}
    .hero-blog .tag{font-size:.7rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);border:1px solid var(--border);padding:.25rem .75rem;border-radius:100px;display:inline-block;margin-bottom:1rem;}
    .hero-blog h1{font-size:clamp(2rem,5vw,3.5rem);font-weight:800;margin-bottom:1rem;}
    .hero-blog h1 span{background:linear-gradient(135deg,#fff,var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .hero-blog p{color:var(--muted);max-width:500px;margin:0 auto;}

    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem;max-width:1200px;margin:0 auto;padding:2rem;}

    .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.5rem;transition:.3s;display:flex;flex-direction:column;gap:.75rem;}
    .card:hover{border-color:rgba(212,175,55,.3);transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.3);}
    .card-niche{font-size:.65rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border:1px solid;padding:.2rem .6rem;border-radius:4px;display:inline-block;width:fit-content;}
    .card h2{font-size:1rem;font-weight:700;color:var(--text);line-height:1.4;}
    .card p{font-size:.82rem;color:var(--muted);line-height:1.6;flex:1;}
    .card-footer{display:flex;justify-content:space-between;align-items:center;font-size:.75rem;color:var(--muted);padding-top:.75rem;border-top:1px solid rgba(255,255,255,.05);margin-top:auto;}
    .read-more{color:var(--gold);font-weight:600;}

    .site-footer{border-top:1px solid var(--border);padding:2rem;text-align:center;font-size:.78rem;color:var(--muted);}
    .site-footer a{color:var(--gold);}
  </style>
</head>
<body>

<header class="site-header">
  <a href="https://norxcompany.com.br" class="logo">NORX COMPANY</a>
  <nav>
    <a href="https://norxcompany.com.br">Home</a>
    <a href="https://norxcoin.norxcompany.com.br">Norxcoin</a>
    <a href="https://wa.me/5522997547731">Contato</a>
  </nav>
</header>

<div class="hero-blog">
  <div class="tag">BLOG</div>
  <h1>Tecnologia, Cripto <span>& Inovação</span></h1>
  <p>Notícias do mercado com a perspectiva da Norx Company.</p>
</div>

<div class="grid">
  ${cardsHTML}
</div>

<footer class="site-footer">
  <p>© ${new Date().getFullYear()} <a href="https://norxcompany.com.br">Norx Company</a> · Todos os direitos reservados.</p>
</footer>

</body>
</html>`;
}

// ─────────────────────────────────────────────
// Salva post e atualiza index
// ─────────────────────────────────────────────
async function savePost(post) {
  await fs.ensureDir(OUTPUT_DIR);
  const slug = makeSlug(post.title, post.publishedAt);
  post.slug  = slug;

  // Salva HTML do post
  const html = buildPostHTML(post);
  await fs.writeFile(path.join(OUTPUT_DIR, `${slug}.html`), html, 'utf8');

  return post;
}

async function rebuildIndex(posts) {
  await fs.ensureDir(OUTPUT_DIR);
  const html = buildIndexHTML(posts);
  await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), html, 'utf8');
}

// Carrega/salva registro JSON de posts já publicados
async function loadRegistry() {
  const file = path.join(OUTPUT_DIR, 'registry.json');
  try { return await fs.readJson(file); }
  catch { return []; }
}

async function saveRegistry(posts) {
  const file = path.join(OUTPUT_DIR, 'registry.json');
  await fs.writeJson(file, posts, { spaces: 2 });
}

module.exports = { savePost, rebuildIndex, loadRegistry, saveRegistry, makeSlug };
