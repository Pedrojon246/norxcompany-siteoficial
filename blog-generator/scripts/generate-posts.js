// scripts/generate-posts.js — Orquestrador principal
// Executa: node scripts/generate-posts.js
// ou via GitHub Actions (cron)

const Parser   = require('rss-parser');
const feeds    = require('../data/feeds');
const templates = require('../data/templates');
const { processArticle } = require('./processor');
const { savePost, rebuildIndex, loadRegistry, saveRegistry } = require('./builder');

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'NorxCompany-Blog-Bot/1.0' },
});

const IS_TEST = process.argv.includes('--test');
const POSTS_PER_RUN = 3; // 3 posts por execução (dia sim dia não pelo cron)

// ─────────────────────────────────────────────
// Pega um elemento aleatório de um array
// ─────────────────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─────────────────────────────────────────────
// Busca itens de todos os feeds de um nicho
// ─────────────────────────────────────────────
async function fetchFeedItems(niche) {
  const feedList = feeds[niche];
  const allItems = [];

  for (const feed of feedList) {
    try {
      console.log(`  Lendo: ${feed.name}`);
      const parsed = await parser.parseURL(feed.url);
      const items  = (parsed.items || []).slice(0, 5).map(item => ({
        ...item,
        feedSource: feed.name,
      }));
      allItems.push(...items);
    } catch (err) {
      console.warn(`  ⚠️  Falhou: ${feed.name} — ${err.message}`);
    }
  }

  return allItems;
}

// ─────────────────────────────────────────────
// Monta artigo completo com intro/opinião/CTA
// ─────────────────────────────────────────────
function assemblePost(processed) {
  const tpl = templates[processed.niche];

  return {
    ...processed,
    intro:  pick(tpl.intros),
    opinion: pick(tpl.opinions),
    cta:    pick(tpl.ctas),
  };
}

// ─────────────────────────────────────────────
// Verifica se post já foi publicado (por título)
// ─────────────────────────────────────────────
function isDuplicate(title, registry) {
  const normalized = title.toLowerCase().trim();
  return registry.some(p =>
    p.originalTitle?.toLowerCase().trim() === normalized ||
    p.title?.toLowerCase().trim() === normalized
  );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   NORX BLOG GENERATOR — iniciando    ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // Carrega posts já publicados
  const registry = await loadRegistry();
  console.log(`📋 Posts no registro: ${registry.length}`);

  const newPosts = [];
  const niches   = Object.keys(feeds); // cripto, tech, startup, imoveis

  // Embaralha nichos para variar a ordem
  const shuffled = niches.sort(() => Math.random() - 0.5);

  for (const niche of shuffled) {
    if (newPosts.length >= POSTS_PER_RUN) break;

    console.log(`\n📡 Nicho: ${niche.toUpperCase()}`);
    const items = await fetchFeedItems(niche);
    console.log(`   ${items.length} itens encontrados`);

    // Embaralha para não pegar sempre os mesmos
    const shuffledItems = items.sort(() => Math.random() - 0.5);

    for (const item of shuffledItems) {
      if (newPosts.length >= POSTS_PER_RUN) break;

      // Processa texto
      const processed = processArticle(item);
      if (!processed) {
        console.log(`   ⏭  Pulou (conteúdo insuficiente): ${item.title?.slice(0,50)}`);
        continue;
      }

      // Checa duplicata
      if (isDuplicate(processed.originalTitle, registry)) {
        console.log(`   ⏭  Pulou (duplicata): ${processed.originalTitle?.slice(0,50)}`);
        continue;
      }

      // Monta post completo
      const post = assemblePost(processed);

      // Em modo teste, só exibe — não salva
      if (IS_TEST) {
        console.log(`\n   ✅ [TESTE] Post gerado:`);
        console.log(`      Título: ${post.title}`);
        console.log(`      Nicho:  ${post.niche}`);
        console.log(`      Fonte:  ${post.source}`);
        console.log(`      Parágrafos: ${post.paragraphs.length}`);
        newPosts.push(post);
        continue;
      }

      // Salva HTML
      try {
        const saved = await savePost(post);
        console.log(`\n   ✅ Publicado: ${saved.slug}`);
        newPosts.push(saved);
      } catch (err) {
        console.error(`   ❌ Erro ao salvar: ${err.message}`);
      }
    }
  }

  if (newPosts.length === 0) {
    console.log('\n⚠️  Nenhum post novo gerado nesta execução.');
    return;
  }

  if (!IS_TEST) {
    // Atualiza registro
    const updatedRegistry = [...newPosts, ...registry].slice(0, 200); // máx 200 posts
    await saveRegistry(updatedRegistry);

    // Reconstrói index
    await rebuildIndex(updatedRegistry);
    console.log('\n📄 Index do blog atualizado.');
  }

  console.log(`\n✨ ${newPosts.length} post(s) gerado(s) com sucesso!`);
  console.log('');
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
