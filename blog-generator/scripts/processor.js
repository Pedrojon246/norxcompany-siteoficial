// scripts/processor.js — Motor de processamento de texto (sem IA)

const natural = require('natural');
const thesaurus = require('../data/thesaurus');

const tokenizer = new natural.WordTokenizer();
const stemmerPT = natural.PorterStemmerPt;

// ─────────────────────────────────────────────
// TextRank — extrai as frases mais importantes
// Algoritmo baseado em grafos de similaridade
// ─────────────────────────────────────────────
function textRank(text, numSentences = 4) {
  // Divide em frases
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 40 && s.length < 500);

  if (sentences.length <= numSentences) return sentences;

  // Vetoriza cada frase com TF
  const vectors = sentences.map(sentence => {
    const words = tokenizer.tokenize(sentence.toLowerCase());
    const freq = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    return freq;
  });

  // Similaridade cosseno entre pares de frases
  function cosineSim(v1, v2) {
    const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
    let dot = 0, norm1 = 0, norm2 = 0;
    keys.forEach(k => {
      dot   += (v1[k] || 0) * (v2[k] || 0);
      norm1 += (v1[k] || 0) ** 2;
      norm2 += (v2[k] || 0) ** 2;
    });
    if (!norm1 || !norm2) return 0;
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // Constrói grafo e calcula score de cada frase
  const scores = new Array(sentences.length).fill(1);
  const DAMPING = 0.85;
  const ITERATIONS = 30;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const newScores = scores.map((_, i) => {
      let sum = 0;
      sentences.forEach((_, j) => {
        if (i === j) return;
        const sim = cosineSim(vectors[i], vectors[j]);
        if (sim > 0) {
          const totalSim = sentences.reduce((acc, _, k) => {
            if (k === j) return acc;
            return acc + cosineSim(vectors[j], vectors[k]);
          }, 0);
          if (totalSim > 0) sum += (sim / totalSim) * scores[j];
        }
      });
      return (1 - DAMPING) + DAMPING * sum;
    });
    newScores.forEach((s, i) => { scores[i] = s; });
  }

  // Retorna as top N frases em ordem original
  const ranked = scores
    .map((score, idx) => ({ score, idx }))
    .sort((a, b) => b.score - a.score)
    .slice(0, numSentences)
    .sort((a, b) => a.idx - b.idx)
    .map(item => sentences[item.idx]);

  return ranked;
}

// ─────────────────────────────────────────────
// Substituição de sinônimos
// ─────────────────────────────────────────────
function applySynonyms(text) {
  let result = text;

  Object.entries(thesaurus).forEach(([word, synonyms]) => {
    // Cria regex case-insensitive para palavra inteira
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let useCount = 0;

    result = result.replace(regex, (match) => {
      // Substitui ~60% das ocorrências para não ficar mecânico
      if (Math.random() < 0.6 && useCount < 2) {
        useCount++;
        const synonym = synonyms[Math.floor(Math.random() * synonyms.length)];
        // Mantém capitalização original
        if (match[0] === match[0].toUpperCase()) {
          return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        }
        return synonym;
      }
      return match;
    });
  });

  return result;
}

// ─────────────────────────────────────────────
// Limpeza de HTML e texto bruto do RSS
// ─────────────────────────────────────────────
function cleanText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')          // Remove tags HTML
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')           // Colapsa espaços múltiplos
    .trim();
}

// ─────────────────────────────────────────────
// Detecta nicho automaticamente pelo conteúdo
// ─────────────────────────────────────────────
function detectNiche(title, content) {
  const text = (title + ' ' + content).toLowerCase();

  const scores = {
    cripto:  0,
    tech:    0,
    startup: 0,
    imoveis: 0,
  };

  const keywords = {
    cripto:  ['bitcoin', 'crypto', 'blockchain', 'token', 'defi', 'nft', 'web3', 'criptomoeda', 'exchange', 'wallet', 'altcoin', 'ethereum', 'bnb', 'staking', 'mineração', 'halving'],
    tech:    ['tecnologia', 'software', 'inteligência artificial', 'ia', 'app', 'aplicativo', 'startup tech', 'programação', 'dados', 'cloud', 'nuvem', 'digital', 'smartphone', 'hardware', 'código'],
    startup: ['startup', 'empreendedor', 'investimento', 'venture', 'rodada', 'serie a', 'unicórnio', 'pitch', 'fundador', 'acelerador', 'incubadora', 'scale-up', 'captação', 'valuation'],
    imoveis: ['imóvel', 'imobiliária', 'corretor', 'apartamento', 'casa', 'financiamento', 'aluguel', 'construtora', 'incorporadora', 'metro quadrado', 'cgi', 'fgts', 'minha casa'],
  };

  Object.entries(keywords).forEach(([niche, words]) => {
    words.forEach(word => {
      if (text.includes(word)) scores[niche]++;
    });
  });

  // Retorna o nicho com maior score, default: tech
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'tech';
}

// ─────────────────────────────────────────────
// Pipeline principal: processa um artigo RSS
// ─────────────────────────────────────────────
function processArticle(item) {
  const title   = cleanText(item.title || '');
  const rawText = cleanText(item.contentSnippet || item.content || item.summary || '');
  const source  = item.feedSource || '';

  if (!title || rawText.length < 100) return null;

  // 1. Extrai frases-chave via TextRank
  const keyPhrases = textRank(rawText, 4);
  if (keyPhrases.length < 2) return null;

  // 2. Aplica sinônimos nas frases extraídas
  const rewritten = keyPhrases.map(phrase => applySynonyms(phrase));

  // 3. Reescreve título com sinônimos (parcialmente)
  const rewrittenTitle = applySynonyms(title);

  // 4. Detecta nicho
  const niche = detectNiche(title, rawText);

  return {
    originalTitle: title,
    title:         rewrittenTitle,
    paragraphs:    rewritten,
    niche,
    source,
    sourceUrl:     item.link || '',
    publishedAt:   item.isoDate || new Date().toISOString(),
  };
}

module.exports = { processArticle, cleanText, detectNiche };
