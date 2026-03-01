// ─── HEADER & FOOTER INJECTION ───────────────────────────────────────────────

const NAV_HTML = `
<header class="site-header">
  <div class="header-inner">
    <a href="/index.html" class="site-logo">
      <img src="/assets/images/logo-norx-company.png" alt="Norx Company">
      <span>NORX</span>
    </a>
    <nav class="nav-main">
      <div class="nav-dropdown">
        <a href="#">Produtos ▾</a>
        <div class="dropdown-menu">
          <a href="/produtos/norxcoin.html"><img src="/assets/images/logo-norxcoin-token.png" alt="">Norxcoin</a>
          <a href="/produtos/norxpay.html"><img src="/assets/images/logo-norxpay.svg" alt="">NorxPay</a>
          <a href="/produtos/grupbuy.html"><img src="/assets/images/logo-grupbuy.png" alt="">GrupBuy</a>
          <a href="/produtos/corretor-pro.html"><img src="/assets/images/logo-corretor-pro.png" alt="">Corretor Pro</a>
          <a href="/produtos/snake-mining.html">🐍 Snake Mining</a>
        </div>
      </div>
      <a href="/index.html#ecosystem">Ecossistema</a>
      <a href="/index.html#blockchain">Blockchain</a>
      <a href="/blog/index.html">Blog</a>
    </nav>
    <button class="hamburger" id="hamburger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>
<nav class="mobile-nav" id="mobileNav">
  <a href="/index.html">Home</a>
  <a href="/produtos/norxcoin.html">Norxcoin</a>
  <a href="/produtos/norxpay.html">NorxPay</a>
  <a href="/produtos/grupbuy.html">GrupBuy</a>
  <a href="/produtos/corretor-pro.html">Corretor Pro</a>
  <a href="/produtos/snake-mining.html">Snake Mining</a>
  <a href="/index.html#blockchain">Blockchain</a>
  <a href="/blog/index.html">Blog</a>
</nav>
`;

const FOOTER_HTML = `
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/index.html" class="site-logo">
          <img src="/assets/images/logo-norx-company.png" alt="Norx Company">
          <span>NORX</span>
        </a>
        <p>Construindo o futuro da tecnologia financeira através de inovação, automação e soluções blockchain.</p>
      </div>
      <div class="footer-col">
        <h4>Produtos</h4>
        <ul>
          <li><a href="/produtos/norxcoin.html">Norxcoin</a></li>
          <li><a href="/produtos/norxpay.html">NorxPay</a></li>
          <li><a href="/produtos/grupbuy.html">GrupBuy</a></li>
          <li><a href="/produtos/corretor-pro.html">Corretor Pro</a></li>
          <li><a href="/produtos/snake-mining.html">Snake Mining</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Ecossistema</h4>
        <ul>
          <li><a href="/index.html#ecosystem">Norx Smart Chain</a></li>
          <li><a href="/index.html#blockchain">Blockchain</a></li>
          <li><a href="/blog/index.html">Blog & Novidades</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Norxcoin</h4>
        <div class="footer-contract">
          <p style="margin-bottom:0.5rem;">Contrato BSC:</p>
          <a href="https://bscscan.com/address/0x9F8ace87A43851aCc21B6a00A84b4F9088563179" target="_blank">
            0x9F8ace...563179 ↗
          </a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 Norx Company. Todos os direitos reservados.</p>
      <p>Tecnologia & Inovação</p>
    </div>
  </div>
</footer>
`;

// Inject nav and footer
document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);

// Set active nav link
const currentPath = window.location.pathname;
document.querySelectorAll('.nav-main a, .mobile-nav a').forEach(link => {
  if (link.getAttribute('href') === currentPath) {
    link.style.color = 'var(--accent)';
  }
});

// Hamburger toggle
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');

hamburger.addEventListener('click', () => {
  mobileNav.classList.toggle('open');
  document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
});

mobileNav.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    mobileNav.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// Header scroll effect
window.addEventListener('scroll', () => {
  const header = document.querySelector('.site-header');
  if (window.scrollY > 50) {
    header.style.boxShadow = '0 4px 40px rgba(0,0,0,0.5)';
  } else {
    header.style.boxShadow = 'none';
  }
});

// ─── SCROLL ANIMATIONS ──────────────────────────────────────────────────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, entry.target.dataset.delay || 0);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.animate-on-scroll').forEach((el, i) => {
  el.dataset.delay = (i % 4) * 100;
  observer.observe(el);
});
