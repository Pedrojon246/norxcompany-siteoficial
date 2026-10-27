/* ════════════════════════════════════════════════════════════════════════════
   NORX · Holograma "Prédio que nasce do chão"
   Fonte do bundle js/hologram.js  (build: ver hologram-src/README.md)
   Tudo procedural — nenhum modelo 3D, nenhuma imagem, nenhuma CDN.
   ════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

(function () {
  const root = document.getElementById('holo');
  if (!root) return;
  const canvas = root.querySelector('.holo-canvas');
  const qs = new URLSearchParams(location.search);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 820px)').matches || /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);

  /* ── Renderer ─────────────────────────────────────────────────────────── */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    root.classList.add('holo--nogl');
    return;
  }
  let DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 600);

  /* ── Paleta (marca Norx: ouro sobre preto) ────────────────────────────── */
  const GOLD = new THREE.Color('#c9a961');
  const HOT = new THREE.Color('#fff1c9');
  const CYAN = new THREE.Color('#8eeaff');

  const U = {
    uTime: { value: 0 },
    uReveal: { value: -5 },
    uLead: { value: 1.8 },
    uPulse: { value: -99 },
    uCity: { value: 0 },
    uGold: { value: GOLD },
    uHot: { value: HOT },
    uCyan: { value: CYAN },
  };

  /* ── Dimensões do prédio ──────────────────────────────────────────────── */
  const FH = 0.4;                 // altura de um pavimento (unidades)
  const TW = {                    // torre principal (torcida e afunilada)
    y0: 1.2, rows: 64, cols: 144, ucols: 24,
    h: 64 * FH, r0: 3.0, r1: 1.55, twist: 1.3, n: 3.0,
  };
  const TOP = TW.y0 + TW.h;       // 26.8
  const SPIRE = 5.0;
  const FULL = TOP + SPIRE;

  function ringRadius(o, t) {
    const k = t * t * (3 - 2 * t) * 0.55 + t * 0.45;       // afunilamento suave
    return (o.r0 + (o.r1 - o.r0) * k) * (1 + 0.07 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
  }
  function twistAt(o, t) { return o.twist * t; }
  function gridPos(o, t, th, out) {
    const r = ringRadius(o, t);
    const c = Math.cos(th), s = Math.sin(th), e = 2 / o.n;
    const x = r * Math.sign(c) * Math.pow(Math.abs(c), e);
    const z = r * Math.sign(s) * Math.pow(Math.abs(s), e);
    const rot = twistAt(o, t), cr = Math.cos(rot), sr = Math.sin(rot);
    out[0] = x * cr - z * sr; out[2] = x * sr + z * cr; out[1] = o.y0 + o.h * t;
    return out;
  }

  function buildTowerGeometry(o, withCap) {
    const pos = [], aU = [], idx = [];
    const tmp = [0, 0, 0];
    for (let k = 0; k <= o.rows; k++) {
      const t = k / o.rows;
      for (let j = 0; j <= o.cols; j++) {
        gridPos(o, t, (j / o.cols) * Math.PI * 2, tmp);
        pos.push(tmp[0], tmp[1], tmp[2]);
        aU.push((j / o.cols) * o.ucols);
      }
    }
    const W = o.cols + 1;
    for (let k = 0; k < o.rows; k++) {
      for (let j = 0; j < o.cols; j++) {
        const a = k * W + j, b = a + 1, c = a + W, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    if (withCap) {
      const ci = pos.length / 3;
      pos.push(0, o.y0 + o.h, 0); aU.push(0);
      const base = o.rows * W;
      for (let j = 0; j < o.cols; j++) idx.push(ci, base + j + 1, base + j);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    // une a costura para a normal não "quebrar" na lateral
    const n = g.attributes.normal;
    for (let k = 0; k <= o.rows; k++) {
      const i0 = k * W, i1 = k * W + o.cols;
      const x = (n.getX(i0) + n.getX(i1)) / 2, y = (n.getY(i0) + n.getY(i1)) / 2, z = (n.getZ(i0) + n.getZ(i1)) / 2;
      n.setXYZ(i0, x, y, z); n.setXYZ(i1, x, y, z);
    }
    return g;
  }

  // Estrutura aramada: anéis de piso + montantes + diagrid
  function buildTowerLines(o) {
    const P = [];
    const tmp = [0, 0, 0], tmp2 = [0, 0, 0];
    const get = (k, j, out) => gridPos(o, k / o.rows, (j / o.cols) * Math.PI * 2, out);
    const seg = (a, b) => P.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    const cell = o.cols / o.ucols;                 // colunas por célula
    // anéis
    for (let k = 0; k <= o.rows; k += 2) {
      for (let j = 0; j < o.cols; j++) { get(k, j, tmp); get(k, j + 1, tmp2); seg(tmp, tmp2); }
    }
    // montantes verticais (a cada 2 células)
    for (let j = 0; j < o.cols; j += cell * 2) {
      for (let k = 0; k < o.rows; k++) { get(k, j, tmp); get(k + 1, j, tmp2); seg(tmp, tmp2); }
    }
    // diagrid
    const step = 8, jw = cell * 4;
    for (let k = 0; k < o.rows; k += step) {
      for (let j = 0; j < o.cols; j += jw * 2) {
        const k2 = Math.min(o.rows, k + step);
        for (let s = 0; s < step; s++) {
          const ka = k + s, kb = k + s + 1;
          if (kb > o.rows) break;
          const f0 = s / step, f1 = (s + 1) / step;
          get(ka, j + jw * f0 * 2, tmp);  get(kb, j + jw * f1 * 2, tmp2);  seg(tmp, tmp2);
          get(ka, j + jw * 2 - jw * f0 * 2, tmp); get(kb, j + jw * 2 - jw * f1 * 2, tmp2); seg(tmp, tmp2);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    return g;
  }

  /* ── GLSL compartilhado ───────────────────────────────────────────────── */
  const GLSL_COMMON = `
    float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    vec2 hash22(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
  `;

  /* ── Material da fachada (torre + espelho no chão) ────────────────────── */
  const facadeVert = `
    attribute float aU;
    varying vec3 vW; varying vec3 vN; varying float vU;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vW = wp.xyz;
      vN = normalize(mat3(modelMatrix) * normal);
      vU = aU;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const facadeFrag = `
    uniform float uTime, uReveal, uLead, uPulse, uMirror, uOpacity;
    uniform vec3 uGold, uHot, uCyan;
    varying vec3 vW; varying vec3 vN; varying float vU;
    ${GLSL_COMMON}
    float gline(float x, float w){ return 1.0 - smoothstep(0.0, w, min(fract(x), 1.0 - fract(x))); }
    void main(){
      float y = uMirror > 0.5 ? -vW.y : vW.y;
      float d = uReveal - y;
      if (d < 0.0) discard;

      vec3 V = normalize(cameraPosition - vW);
      float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.4);

      vec2 g = vec2(vU, (y - ${TW.y0.toFixed(2)}) / ${(FH * 2).toFixed(2)});
      vec2 id = floor(g), f = fract(g);
      vec2 fw = fwidth(g);
      float rnd = hash(id);
      float rnd2 = hash(id + 7.7);

      // células "montam" aleatoriamente atrás da frente de varredura
      float appear = smoothstep(rnd * 1.8, rnd * 1.8 + 0.5, d);

      float lx = 1.0 - smoothstep(0.0, max(fw.x * 1.1, 0.035), min(f.x, 1.0 - f.x));
      float ly = 1.0 - smoothstep(0.0, max(fw.y * 1.1, 0.035), min(f.y, 1.0 - f.y));
      float dens = 1.0 - smoothstep(0.35, 0.8, max(fw.x, fw.y));
      float lines = max(lx * 0.55, ly) * dens;

      // janelas acesas
      vec2 wm = smoothstep(0.16, 0.26, f) * smoothstep(0.16, 0.26, 1.0 - f);
      float win = wm.x * wm.y;
      float lit = step(0.46, rnd) * (0.45 + 0.55 * sin(uTime * (0.6 + rnd2 * 2.2) + rnd * 60.0) * 0.5 + 0.275);
      lit *= dens;

      vec3 col = vec3(0.0);
      col += uGold * lines * 0.5 * appear;
      col += mix(uGold, uHot, rnd2 * rnd2) * win * lit * 0.7 * appear;
      col += uGold * 0.022 * appear;                      // vidro
      col += mix(uGold, uHot, 0.3) * fres * 0.5;           // borda/fresnel
      col *= gl_FrontFacing ? 1.0 : 0.4;

      // base brilhando (energia subindo do chão)
      col += uGold * 0.3 * exp(-max(y, 0.0) * 0.5) * (0.3 + ly);

      // frente de varredura
      float band = exp(-d * 2.4);
      float edge = exp(-d * d * 55.0);
      col += mix(uHot, uCyan, 0.28) * (band * 0.3 + edge * 2.0);

      // pulso de "tokenização" subindo pelo prédio
      float pd = y - uPulse;
      float pulse = exp(-pd * pd * 2.2);
      float hexCell = step(0.55, rnd) * wm.x * wm.y;
      col += uHot * pulse * (0.3 + 0.9 * hexCell);
      col += uGold * exp(-abs(pd) * 6.0) * 0.5 * ly;

      // scanlines
      col *= 0.9 + 0.1 * sin(gl_FragCoord.y * 1.4 - uTime * 7.0);

      if (uMirror > 0.5) col *= uOpacity * (1.0 - smoothstep(0.0, 16.0, -y));
      gl_FragColor = vec4(col, 1.0);
    }`;

  function facadeMaterial(mirror) {
    return new THREE.ShaderMaterial({
      uniforms: { ...U, uMirror: { value: mirror ? 1 : 0 }, uOpacity: { value: 0.3 } },
      vertexShader: facadeVert, fragmentShader: facadeFrag,
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
  }

  const wireVert = `
    varying vec3 vW;
    void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const wireFrag = `
    uniform float uReveal, uLead, uMirror, uTime;
    uniform vec3 uGold, uHot, uCyan;
    varying vec3 vW;
    void main(){
      float y = uMirror > 0.5 ? -vW.y : vW.y;
      float front = uReveal + uLead;
      float d = front - y;
      if (d < 0.0) discard;
      float k = smoothstep(uLead + 1.2, 0.0, d);              // mais quente perto da frente
      vec3 col = mix(uGold * 0.55, mix(uHot, uCyan, 0.25) * 1.4, k);
      col *= 0.75 + 0.25 * sin(y * 3.0 - uTime * 2.0);
      if (uMirror > 0.5) col *= 0.22 * (1.0 - smoothstep(0.0, 16.0, -y));
      gl_FragColor = vec4(col, 1.0);
    }`;
  function wireMaterial(mirror) {
    return new THREE.ShaderMaterial({
      uniforms: { ...U, uMirror: { value: mirror ? 1 : 0 } },
      vertexShader: wireVert, fragmentShader: wireFrag,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
  }

  /* ── Torre ────────────────────────────────────────────────────────────── */
  const hero = new THREE.Group();
  scene.add(hero);

  const towerGeo = buildTowerGeometry(TW, true);
  const podA = { y0: 0, rows: 3, cols: 96, ucols: 16, h: 1.2, r0: 5.2, r1: 5.0, twist: 0, n: 9 };
  const podB = { y0: 0, rows: 2, cols: 96, ucols: 20, h: 1.2, r0: 4.6, r1: 4.2, twist: 0.2, n: 7 };
  podB.y0 = 0; // base sob a torre; sobe junto
  const podGeoA = buildTowerGeometry(podA, true);

  const towerMat = facadeMaterial(false);
  const towerMesh = new THREE.Mesh(towerGeo, towerMat);
  const podMesh = new THREE.Mesh(podGeoA, towerMat);
  const towerLines = new THREE.LineSegments(buildTowerLines(TW), wireMaterial(false));
  hero.add(podMesh, towerMesh, towerLines);

  // espire
  const spireGeo = new THREE.BufferGeometry();
  spireGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, TOP, 0, 0, FULL, 0,
    0.28, TOP, 0, 0, FULL, 0, -0.28, TOP, 0, 0, FULL, 0, 0, TOP, 0.28, 0, FULL, 0, 0, TOP, -0.28, 0, FULL, 0,
  ], 3));
  const spire = new THREE.LineSegments(spireGeo, wireMaterial(false));
  hero.add(spire);

  // reflexo no chão (espelhado em Y)
  const mirror = new THREE.Group();
  mirror.scale.y = -1;
  const mTower = new THREE.Mesh(towerGeo, facadeMaterial(true));
  const mPod = new THREE.Mesh(podGeoA, mTower.material);
  const mLines = new THREE.LineSegments(towerLines.geometry, wireMaterial(true));
  mirror.add(mTower, mPod, mLines);
  scene.add(mirror);
  [mTower, mPod, mLines].forEach(m => (m.renderOrder = 1));
  [podMesh, towerMesh, towerLines, spire].forEach(m => (m.renderOrder = 3));

  /* ── Cidade ao redor (cresce em onda) ─────────────────────────────────── */
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const R = rng(20271027);
  const cityCount = isMobile ? 70 : 150;
  const placed = [];
  const solid = [], edges = [];
  for (let tries = 0; placed.length < cityCount && tries < cityCount * 30; tries++) {
    const rad = 15 + Math.pow(R(), 0.82) * 50, ang = R() * Math.PI * 2;
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    const w = 1.6 + R() * 2.6, dd = 1.6 + R() * 2.6;
    const sz = Math.max(w, dd) * 0.5 + 0.7;
    if (placed.some(p => Math.hypot(p.x - x, p.z - z) < p.s + sz)) continue;
    placed.push({ x, z, s: sz });
    const t = Math.min(1, (rad - 15) / 40);
    const h = (1.8 + R() * 3.5 + (1 - t) * (2 + R() * 7.5)) * (R() > 0.93 ? 1.5 : 1);
    const box = new THREE.BoxGeometry(w, h, dd); box.translate(x, h / 2, z);
    const eg = new THREE.EdgesGeometry(box);
    const delay = (rad - 15) * 0.05 + R() * 0.6, seed = R();
    [[box, solid], [eg, edges]].forEach(([g, arr]) => {
      const n = g.attributes.position.count;
      const fill = v => new THREE.Float32BufferAttribute(new Float32Array(n).fill(v), 1);
      const c = new Float32Array(n * 2); for (let i = 0; i < n; i++) { c[i * 2] = x; c[i * 2 + 1] = z; }
      g.setAttribute('aC', new THREE.BufferAttribute(c, 2));
      g.setAttribute('aH', fill(h)); g.setAttribute('aDelay', fill(delay)); g.setAttribute('aSeed', fill(seed));
      if (g.index) { /* mergeGeometries exige mesmo formato */ }
      arr.push(g);
    });
  }
  const solidNI = solid.map(g => g.index ? g.toNonIndexed() : g);
  solidNI.forEach(g => { g.deleteAttribute('uv'); });
  const cityGeo = mergeGeometries(solidNI);
  const cityEdgeGeo = mergeGeometries(edges);

  const cityVert = `
    attribute vec2 aC; attribute float aH; attribute float aDelay; attribute float aSeed;
    uniform float uCity;
    varying vec3 vW; varying float vU; varying float vLY; varying float vGrow; varying float vH; varying float vSeed; varying float vTop;
    void main(){
      float gr = clamp((uCity - aDelay) / 1.5, 0.0, 1.0);
      gr = 1.0 - pow(1.0 - gr, 3.0);
      vec3 p = position; vLY = p.y; p.y *= gr;
      vec3 lp = vec3(position.x - aC.x, 0.0, position.z - aC.y);
      #ifdef SOLID
        vec3 n = normal;
        float u = abs(n.x) > 0.5 ? lp.z * sign(n.x) : lp.x * -sign(n.z);
        vTop = abs(n.y) > 0.5 ? 1.0 : 0.0;
        vU = u * 1.6 + aSeed * 13.0;
      #else
        vU = 0.0; vTop = 0.0;
      #endif
      vGrow = gr; vH = aH; vSeed = aSeed;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vW = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const cityFrag = `
    uniform float uTime;
    uniform vec3 uGold, uHot, uCyan;
    varying vec3 vW; varying float vU; varying float vLY; varying float vGrow; varying float vH; varying float vSeed; varying float vTop;
    ${GLSL_COMMON}
    void main(){
      if (vGrow < 0.002) discard;
      float r = length(vW.xz);
      float fade = 0.75 * exp(-r * 0.036) * smoothstep(0.0, 0.25, vGrow);
      vec3 col = vec3(0.0);
      #ifdef SOLID
        vec2 g = vec2(vU, vLY / 0.55);
        vec2 id = floor(g), f = fract(g);
        vec2 fw = fwidth(g);
        float rnd = hash(id + vSeed * 31.0);
        float dens = 1.0 - smoothstep(0.35, 0.8, max(fw.x, fw.y));
        float ly = 1.0 - smoothstep(0.0, max(fw.y * 1.1, 0.04), min(f.y, 1.0 - f.y));
        vec2 wm = smoothstep(0.18, 0.28, f) * smoothstep(0.18, 0.28, 1.0 - f);
        float lit = step(0.52, rnd) * (0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * (0.5 + rnd * 2.0) + rnd * 40.0)));
        col += uGold * (ly * 0.32 * dens * (1.0 - vTop));
        col += mix(uGold, uHot, rnd) * wm.x * wm.y * lit * 0.55 * dens * (1.0 - vTop);
        col += uGold * 0.035;
        col += uGold * vTop * 0.05;
      #else
        col = uGold * 0.85 + uHot * 0.35 * smoothstep(vH - 0.8, vH, vLY);
      #endif
      // aresta que sobe (lembra a frente de construção)
      float front = exp(-pow((vLY * vGrow - vH * vGrow) * 1.2, 2.0)) * (1.0 - vGrow) * 2.0;
      col += uHot * front * 0.6;
      col *= fade;
      gl_FragColor = vec4(col, 1.0);
    }`;
  const cityUniforms = { ...U };
  const cityMat = new THREE.ShaderMaterial({
    uniforms: cityUniforms, vertexShader: cityVert, fragmentShader: cityFrag,
    defines: { SOLID: 1 }, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const cityEdgeMat = new THREE.ShaderMaterial({
    uniforms: cityUniforms, vertexShader: cityVert, fragmentShader: cityFrag,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const city = new THREE.Mesh(cityGeo, cityMat);
  const cityEdges = new THREE.LineSegments(cityEdgeGeo, cityEdgeMat);
  city.renderOrder = 2; cityEdges.renderOrder = 2;
  city.frustumCulled = false; cityEdges.frustumCulled = false;
  scene.add(city, cityEdges);

  /* ── Chão: grade, anéis HUD, rachaduras incandescentes ────────────────── */
  const groundMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uCrack: { value: 0 }, uRing: { value: 0 }, uGlow: { value: 1 }, uPlat: { value: 0 }, uGrid: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      uniform float uTime, uCrack, uRing, uGlow, uPlat, uGrid;
      uniform vec3 uGold, uHot, uCyan;
      varying vec3 vW;
      ${GLSL_COMMON}
      float gridLine(vec2 p, float w){ vec2 q = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(q.x, q.y) / w, 1.0); }
      float vor(vec2 x){
        vec2 n = floor(x), f = fract(x); vec2 mg, mr; float md = 8.0;
        for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){ vec2 g = vec2(float(i),float(j)); vec2 o = hash22(n+g); vec2 r = g+o-f; float d = dot(r,r); if (d<md){ md=d; mr=r; mg=g; } }
        md = 8.0;
        for (int j=-2;j<=2;j++) for (int i=-2;i<=2;i++){ vec2 g = mg+vec2(float(i),float(j)); vec2 o = hash22(n+g); vec2 r = g+o-f; if (dot(mr-r,mr-r) > 0.00001) md = min(md, dot(0.5*(mr+r), normalize(r-mr))); }
        return md;
      }
      float ringAt(float r, float R, float w){ return exp(-pow((r-R)/w, 2.0)); }
      void main(){
        vec2 p = vW.xz; float r = length(p);
        vec3 col = vec3(0.003, 0.003, 0.004);

        // grade urbana
        float gm = gridLine(p / 2.0, 1.0), gM = gridLine(p / 10.0, 1.5);
        float gf = exp(-r * 0.022) * smoothstep(5.5, 12.0, r);
        col += uGold * (gm * 0.10 + gM * 0.55) * gf * uGrid;

        // anéis do pedestal (HUD)
        float a = atan(p.y, p.x);
        float tick = step(0.55, fract((a + uTime * 0.06) * 24.0 / 6.28318));
        float tick2 = step(0.5, fract((a - uTime * 0.04) * 90.0 / 6.28318));
        col += uGold * ringAt(r, 7.4, 0.05) * 1.1 * uPlat;
        col += uGold * ringAt(r, 8.1, 0.16) * tick * 0.8 * uPlat;
        col += uGold * ringAt(r, 9.2, 0.035) * tick2 * 0.9 * uPlat;
        col += uGold * ringAt(r, 10.8, 0.04) * 0.5 * uPlat;
        col += mix(uGold, uHot, 0.5) * exp(-r * 0.28) * 0.22 * uPlat;

        // onda de choque ao nascer
        col += mix(uGold, uHot, 0.55) * ringAt(r, uRing, 0.35) * smoothstep(60.0, 8.0, uRing) * 1.6;

        // rachaduras incandescentes
        float lim = uCrack * 15.0;
        if (r < lim){
          float e = vor(p * 0.46);
          float crack = 1.0 - smoothstep(0.0, 0.04, e);
          float halo = 1.0 - smoothstep(0.0, 0.3, e);
          float cf = smoothstep(lim, lim * 0.55, r) * exp(-r * 0.12);
          col += (mix(uGold, uHot, 0.65) * crack * 2.3 + uGold * halo * 0.22) * cf * uGlow;
        }

        col *= smoothstep(118.0, 55.0, r);
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthWrite: false, depthTest: false,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 96), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.renderOrder = -5;
  scene.add(ground);

  /* ── Céu (halo quente no horizonte + estrelas) ────────────────────────── */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    uniforms: { ...U },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uGold; uniform float uTime; varying vec3 vD;
      ${GLSL_COMMON}
      void main(){
        float h = vD.y;
        vec3 col = vec3(0.0);
        col += uGold * exp(-abs(h) * 11.0) * 0.10;
        col += vec3(0.06, 0.035, 0.01) * exp(-abs(h) * 7.0) * 0.5;
        vec2 uv = vec2(atan(vD.z, vD.x) * 60.0, h * 90.0);
        vec2 id = floor(uv), f = fract(uv) - 0.5;
        float s = step(0.992, hash(id)) * smoothstep(0.5, 0.0, length(f)) * smoothstep(0.03, 0.3, h);
        s *= 0.55 + 0.45 * sin(uTime * 1.5 + hash(id + 3.0) * 40.0);
        col += vec3(1.0, 0.95, 0.85) * s * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  }));
  sky.renderOrder = -10; scene.add(sky);

  /* ── Coluna de energia (feixe) ────────────────────────────────────────── */
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uBeam: { value: 0 } },
    vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      uniform float uBeam, uTime; uniform vec3 uGold, uHot;
      varying vec3 vW; varying vec3 vN;
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float c = pow(abs(dot(normalize(vN), V)), 1.6);
        float hf = (1.0 - smoothstep(0.0, 70.0, vW.y)) * smoothstep(-0.5, 1.5, vW.y);
        float streak = 0.75 + 0.25 * sin(vW.y * 2.0 - uTime * 14.0 + vW.x * 3.0);
        gl_FragColor = vec4(mix(uGold, uHot, c * 0.6) * c * hf * streak * uBeam, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 70, 40, 1, true), beamMat);
  beam.position.y = 35; beam.renderOrder = 4; scene.add(beam);

  /* ── Partículas: poeira de energia subindo + estilhaços do impacto ────── */
  const pCount = isMobile ? 700 : 1900;
  const pGeo = new THREE.BufferGeometry();
  const seed = new Float32Array(pCount * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pCount * 3), 3));
  pGeo.setAttribute('aS', new THREE.BufferAttribute(seed, 4));
  const pointVert = `
    attribute vec4 aS;
    uniform float uTime, uPx, uAmt, uReveal;
    varying float vA;
    void main(){
      float sp = 0.5 + aS.x * 1.1;
      float life = fract(uTime * sp * 0.07 + aS.y);
      float ang = aS.z * 6.28318 + life * 1.8 + uTime * 0.05;
      float rad = 3.2 + pow(aS.w, 1.4) * 15.0;
      vec3 p = vec3(cos(ang) * rad, life * 34.0, sin(ang) * rad);
      vA = sin(3.14159 * life) * uAmt * smoothstep(0.0, 4.0, uReveal - p.y + 3.0);
      vec4 mv = viewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (0.5 + aS.x * 1.3) * uPx * (15.0 / -mv.z);
    }`;
  const pointFrag = `
    uniform vec3 uGold, uHot; varying float vA;
    void main(){
      vec2 c = gl_PointCoord - 0.5; float d = length(c);
      float a = smoothstep(0.5, 0.0, d); a *= a;
      gl_FragColor = vec4(mix(uGold, uHot, 0.5) * a * vA * 1.4, 1.0);
    }`;
  const dust = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    uniforms: { ...U, uPx: { value: 1 }, uAmt: { value: 0 } },
    vertexShader: pointVert, fragmentShader: pointFrag,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }));
  dust.frustumCulled = false; dust.renderOrder = 5; scene.add(dust);

  const bCount = isMobile ? 160 : 380;
  const bGeo = new THREE.BufferGeometry();
  const bs = new Float32Array(bCount * 4); for (let i = 0; i < bs.length; i++) bs[i] = Math.random();
  bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bCount * 3), 3));
  bGeo.setAttribute('aS', new THREE.BufferAttribute(bs, 4));
  const burst = new THREE.Points(bGeo, new THREE.ShaderMaterial({
    uniforms: { ...U, uPx: { value: 1 }, uT: { value: -1 } },
    vertexShader: `
      attribute vec4 aS; uniform float uT, uPx; varying float vA;
      void main(){
        float ang = aS.x * 6.28318; float sp = 3.0 + aS.y * 12.0;
        vec3 v = vec3(cos(ang) * sp * (0.4 + aS.w), 5.0 + aS.z * 17.0, sin(ang) * sp * (0.4 + aS.w));
        vec3 o = vec3(cos(ang) * aS.w * 3.5, 0.0, sin(ang) * aS.w * 3.5);
        float t = max(uT, 0.0);
        vec3 p = o + v * t + vec3(0.0, -0.5 * 19.0 * t * t, 0.0);
        p.y = max(p.y, 0.02);
        vA = (uT < 0.0 ? 0.0 : 1.0) * (1.0 - smoothstep(0.6, 3.2, t));
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.8 + aS.y * 1.8) * uPx * (15.0 / -mv.z);
      }`,
    fragmentShader: pointFrag.replace('* vA * 1.4', '* vA * 1.8'),
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }));
  burst.frustumCulled = false; burst.renderOrder = 5; scene.add(burst);

  /* ── Órbitas de tokens (aneis tracejados + moedas hexagonais "N") ─────── */
  const orbit = new THREE.Group(); orbit.visible = false; scene.add(orbit);
  const orbitDefs = [
    { r: 7.2, y: 17.5, tilt: 0.38, spd: 0.22, tok: 2, dash: 14 },
    { r: 10.0, y: 12.0, tilt: -0.3, spd: -0.15, tok: 2, dash: 22 },
    { r: 5.2, y: 24.0, tilt: 0.18, spd: 0.3, tok: 1, dash: 10 },
  ];
  function coinTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const hex = (r) => { x.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } x.closePath(); };
    const g = x.createRadialGradient(128, 128, 10, 128, 128, 126);
    g.addColorStop(0, 'rgba(255,224,150,0.55)'); g.addColorStop(0.6, 'rgba(201,169,97,0.12)'); g.addColorStop(1, 'rgba(201,169,97,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    hex(86); x.fillStyle = 'rgba(40,28,8,0.55)'; x.fill(); x.lineWidth = 7; x.strokeStyle = '#ffe9ae'; x.stroke();
    hex(66); x.lineWidth = 2.5; x.strokeStyle = 'rgba(255,233,174,0.55)'; x.stroke();
    x.fillStyle = '#fff2cf'; x.font = '700 92px Georgia, "Cormorant Garamond", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('N', 128, 136);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const coinTex = coinTexture();
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uA: { value: 0 }, uDash: { value: 14 } },
    vertexShader: `attribute float aT; varying float vT; varying vec3 vW; void main(){ vT = aT; vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      uniform float uA, uTime, uDash; uniform vec3 uGold, uHot; varying float vT; varying vec3 vW;
      void main(){
        float dash = step(0.45, fract(vT * uDash + uTime * 0.25));
        float base = 0.25 + 0.75 * dash;
        gl_FragColor = vec4(mix(uGold, uHot, 0.35) * base * uA, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const coins = [];
  orbitDefs.forEach((d, i) => {
    const grp = new THREE.Group(); grp.position.y = d.y; grp.rotation.z = d.tilt; grp.rotation.x = d.tilt * 0.6;
    const N = 220, pts = new Float32Array(N * 3), tt = new Float32Array(N);
    for (let k = 0; k < N; k++) { const a = (k / (N - 1)) * Math.PI * 2; pts.set([Math.cos(a) * d.r, 0, Math.sin(a) * d.r], k * 3); tt[k] = k / (N - 1); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pts, 3)); lg.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
    const m = ringMat.clone(); m.uniforms = { ...U, uA: { value: 0 }, uDash: { value: d.dash } };
    const line = new THREE.Line(lg, m); line.renderOrder = 6; grp.add(line);
    for (let c = 0; c < d.tok; c++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: coinTex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      sp.scale.setScalar(isMobile ? 2.3 : 2.0); sp.renderOrder = 7; grp.add(sp);
      coins.push({ sp, d, phase: (c / d.tok) * Math.PI * 2 + i, m });
    }
    orbit.add(grp);
    d._m = m;
  });

  // luz de sinalização no topo
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: coinTex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  beacon.visible = false; beacon.position.set(0, FULL + 0.1, 0); beacon.scale.setScalar(1.6); beacon.renderOrder = 8;
  const bTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,245,215,1)'); g.addColorStop(0.25, 'rgba(255,214,130,0.55)'); g.addColorStop(1, 'rgba(201,169,97,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  beacon.material.map = bTex; beacon.scale.setScalar(3.4);
  scene.add(beacon);


  /* ── Anel de varredura: sobe junto com a frente de construção ─────────── */
  const scanMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uS: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      uniform float uS, uTime; uniform vec3 uGold, uHot, uCyan; varying vec2 vP;
      void main(){
        float r = length(vP); float a = atan(vP.y, vP.x);
        float ring = exp(-pow((r - 0.96) / 0.018, 2.0)) * 2.2;
        float inner = exp(-pow((r - 0.80) / 0.008, 2.0)) * 0.7;
        float tick = step(0.5, fract((a + uTime * 0.4) * 36.0 / 6.28318)) * exp(-pow((r - 1.04) / 0.02, 2.0));
        float disc = smoothstep(1.0, 0.2, r) * 0.10;
        vec3 col = mix(uGold, mix(uHot, uCyan, 0.25), 0.6) * (ring + inner + tick * 0.9) + uGold * disc;
        gl_FragColor = vec4(col * uS, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const scanRing = new THREE.Mesh(new THREE.CircleGeometry(1, 96), scanMat);
  scanRing.rotation.x = -Math.PI / 2; scanRing.renderOrder = 9; scanRing.visible = false;
  scene.add(scanRing);

  /* ── Pós-processamento ────────────────────────────────────────────────── */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: isMobile ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.6, 0.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finishPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGlitch: { value: 0 }, uAspect: { value: 1 }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uGlitch, uFlash; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        float band = step(0.93, h(vec2(floor(uv.y * 38.0), floor(uTime * 24.0))));
        uv.x += (h(vec2(floor(uv.y * 38.0), uTime)) - 0.5) * 0.045 * uGlitch * band;
        vec2 c = uv - 0.5; float ab = 0.0008 + 0.003 * dot(c, c) + uGlitch * 0.004;
        vec3 col = vec3(texture2D(tDiffuse, uv + c * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c * ab).b);
        col += vec3(1.0, 0.82, 0.5) * uFlash * (1.0 - dot(c, c) * 2.2);
        col *= 1.0 - dot(c, c) * 1.05;
        col += (h(uv * 900.0 + uTime) - 0.5) * 0.022;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  composer.addPass(finishPass);

  /* ── Tamanho / enquadramento ──────────────────────────────────────────── */
  let W = 0, H = 0;
  function resize() {
    const r = root.getBoundingClientRect();
    W = Math.max(2, Math.round(r.width)); H = Math.max(2, Math.round(r.height));
    renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
    composer.setPixelRatio(DPR); composer.setSize(W, H);
    camera.aspect = W / H;
    const portrait = camera.aspect < 0.9;
    // desktop: prédio levemente à direita (texto à esquerda). mobile: prédio no alto (texto embaixo)
    if (portrait) camera.setViewOffset(W, H, 0, H * 0.13, W, H);
    else if (camera.aspect < 1.25) camera.setViewOffset(W, H, 0, H * 0.06, W, H);
    else camera.setViewOffset(W, H, -W * 0.15, 0, W, H);
    camera.updateProjectionMatrix();
    const px = DPR;
    dust.material.uniforms.uPx.value = px; burst.material.uniforms.uPx.value = px;
    finishPass.uniforms.uAspect.value = camera.aspect;
  }
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(root);

  /* ── Rótulos HTML ancorados na torre ──────────────────────────────────── */
  const labels = [...root.querySelectorAll('.holo-label')].map(el => ({ el, t: parseFloat(el.dataset.t), side: 1, vis: 0 }));
  const _v = new THREE.Vector3();
  function anchorOnTower(t) {
    const th = 0.0; const p = [0, 0, 0]; gridPos(TW, t, th, p); return _v.set(p[0], p[1], p[2]);
  }

  /* ── Linha do tempo (t = tempo de obra, controlado pela rolagem) ───────── */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const T = { crack0: 0.25, tower0: 1.0, towerDur: 7.0, city0: 4.0, done: 8.6 };
  const T_END = T.done + 1.0;     // fim da obra (p = 1)
  const INTRO = 1.6;              // abertura que toca sozinha ao carregar (chão racha, feixe acende)

  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', e => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

  const runway = document.getElementById('holo-runway') || root;
  const copyEl = root.querySelector('.holo-copy');
  const hintEl = root.querySelector('.holo-scroll');
  const hudEl = root.querySelector('.holo-hud');
  const shadeEl = root.querySelector('.holo-shade');
  function progress() {
    const r = runway.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight));
  }
  // texto some enquanto o prédio sobe e volta (com os botões) quando a obra termina
  function applyScrollUI(p) {
    const co = p < 0.03 ? 1 : p < 0.13 ? 1 - (p - 0.03) / 0.10 : p < 0.88 ? 0 : (p - 0.88) / 0.08;
    const o = clamp(co);
    if (copyEl) { copyEl.style.opacity = o.toFixed(3); copyEl.style.transform = 'translateY(' + ((1 - o) * 26).toFixed(1) + 'px)'; copyEl.style.pointerEvents = o > 0.6 ? 'auto' : 'none'; }
    if (shadeEl) shadeEl.style.opacity = (0.22 + 0.78 * o).toFixed(3);
    if (hintEl) hintEl.style.opacity = (1 - sm(0.0, 0.06, p)).toFixed(3);
    if (hudEl) hudEl.style.opacity = sm(0.04, 0.12, p).toFixed(3);
  }

  const hudFloors = root.querySelector('[data-hud="floors"]');
  const hudPct = root.querySelector('[data-hud="pct"]');
  const hudStatus = root.querySelector('[data-hud="status"]');
  const hudBar = root.querySelector('[data-hud="bar"]');
  let lastPct = -1, spin = 0;

  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  function update(t, dt, tr) {
    if (tr === undefined) tr = t;
    U.uTime.value = tr;

    // chão / feixe / estilhaços (poeira e onda de choque tocam no relógio real; rachaduras seguem a obra)
    groundMat.uniforms.uCrack.value = sm(T.crack0, T.crack0 + 1.6, t);
    groundMat.uniforms.uRing.value = tr > 0.5 ? (tr - 0.5) * 15.0 : 0;
    groundMat.uniforms.uGlow.value = 1.0 - 0.55 * sm(T.done - 1.5, T.done + 2, t);
    groundMat.uniforms.uPlat.value = sm(1.2, 3.2, t);
    groundMat.uniforms.uGrid.value = sm(1.6, 6.4, t);
    burst.material.uniforms.uT.value = tr > 0.55 ? tr - 0.55 : -1;
    const rise = sm(T.tower0 - 0.4, T.tower0 + 0.6, t);
    const beamI = rise * (0.65 - 0.55 * sm(T.tower0 + T.towerDur * 0.45, T.done + 1.0, t));
    beamMat.uniforms.uBeam.value = Math.max(0, beamI) * (t < 0.4 ? 0 : 1);
    dust.material.uniforms.uAmt.value = sm(0.8, 2.5, t);

    // torre
    const bt = clamp((t - T.tower0) / T.towerDur);
    const e = bt < 1 ? bt * 0.55 + easeIO(bt) * 0.45 : 1;   // quase linear: a rolagem responde de forma uniforme
    const revealY = -2 + (FULL + 4 + 2) * e;
    U.uReveal.value = bt >= 1 ? 999 : revealY;
    U.uLead.value = 3.2;
    U.uCity.value = Math.max(0, t - T.city0);
    const built = t > T.done;
    U.uPulse.value = built ? ((tr * 6.5) % 46) - 8 : -99;

    // anel de varredura
    const tt = clamp((revealY - TW.y0) / TW.h);
    const sr = revealY < TW.y0 ? 5.6 : ringRadius(TW, tt) * 1.15 + 0.6;
    scanRing.visible = bt > 0 && bt < 1;
    scanRing.position.y = revealY; scanRing.scale.setScalar(sr);
    scanMat.uniforms.uS.value = sm(0, 0.04, bt) * (1 - sm(0.94, 1, bt));

    // HUD
    const pct = Math.round(clamp((Math.min(revealY, TOP) - TW.y0) / TW.h) * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      if (hudPct) hudPct.textContent = String(pct).padStart(3, '0') + '%';
      if (hudFloors) hudFloors.textContent = String(Math.round(pct / 100 * TW.rows)).padStart(2, '0');
      if (hudBar) hudBar.style.transform = 'scaleX(' + (pct / 100) + ')';
      if (hudStatus) hudStatus.textContent = pct >= 100 ? 'MODELO CONCEITUAL · ONLINE' : t < T.tower0 ? 'INICIALIZANDO' : 'MATERIALIZANDO';
    }

    // órbitas
    const oa = sm(T.done - 0.6, T.done + 1.4, t);
    orbit.visible = oa > 0.001;
    orbitDefs.forEach(d => { d._m.uniforms.uA.value = oa * 0.9; });
    coins.forEach(c => {
      const a = c.phase + tr * c.d.spd * 1.8;
      c.sp.position.set(Math.cos(a) * c.d.r, 0, Math.sin(a) * c.d.r);
      c.sp.material.opacity = oa;
    });
    beacon.visible = revealY > FULL;
    beacon.material.opacity = (0.55 + 0.45 * Math.sin(tr * 3.0)) * sm(0, 1, revealY - FULL);

    // clímax: o prédio fecha → glitch, clarão e "soco" de câmera
    const tc = T.tower0 + T.towerDur;
    const bump = Math.exp(-Math.pow((t - tc) / 0.45, 2));
    let gl = bump > 0.25 ? 1 : 0;
    if (built && Math.sin(tr * 0.9) > 0.994) gl = 0.7;
    finishPass.uniforms.uGlitch.value = gl;
    finishPass.uniforms.uTime.value = tr;
    finishPass.uniforms.uFlash.value = bump * 0.32;

    // câmera: rasteira junto ao chão → sobe acompanhando a obra → recua para o plano geral
    const kb = clamp((t - 0.4) / (T.done + 1.2 - 0.4));
    const ck = easeIO(kb);
    const aspect = camera.aspect;
    const D = (aspect < 0.9 ? 98 : aspect < 1.25 ? 88 : 68);
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 2.5);
    mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 2.5);
    if (built) spin += dt * 0.035;
    const theta = 0.62 + spin + mouse.sx * 0.22 - (1 - ck) * 1.0;
    const R0 = 26, Rk = R0 + (D - R0) * ck;
    const camY = 1.6 + (9.5 - 1.6) * ck - mouse.sy * 1.6;
    const follow = (1 - ck) * Math.min(Math.max(revealY, 0), FULL) * 0.34;
    const tgtY = 4.5 + (13.8 - 4.5) * ck + follow;
    camPos.set(Math.sin(theta) * Rk, camY, Math.cos(theta) * Rk);
    camTgt.set(0, tgtY, 0);
    camera.position.copy(camPos); camera.lookAt(camTgt);
    camera.fov = 32 + (1 - ck) * 14 - bump * 2.5; camera.updateProjectionMatrix();

    // rótulos
    camera.updateMatrixWorld();
    labels.forEach(L => {
      const show = built && t > T.done + 0.25 + L.t * 0.7 && W > 820;
      L.vis += ((show ? 1 : 0) - L.vis) * Math.min(1, dt * 4);
      if (L.vis < 0.01) { L.el.style.opacity = 0; return; }
      anchorOnTower(L.t); _v.project(camera);
      const sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
      L.el.style.opacity = L.vis;
      L.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
    });

    bloom.strength = 0.42 + bump * 0.55;
  }

  /* ── Loop ─────────────────────────────────────────────────────────────── */
  let t0 = performance.now(), last = t0, running = false, inView = true, raf = 0, frames = 0, slowFrames = 0;
  let tSm = 0, trReal = 0;
  let manualT = qs.has('holo_t') ? parseFloat(qs.get('holo_t')) : null;

  function tick(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    trReal = (now - t0) / 1000;
    let t;
    if (manualT != null) t = manualT;
    else {
      const p = progress();
      applyScrollUI(p);
      const target = Math.max(Math.min(INTRO, trReal), INTRO + p * (T_END - INTRO) - (p > 0 ? 0 : 0));
      tSm += (target - tSm) * (1 - Math.exp(-dt * 7));
      t = tSm;
    }
    update(t, dt, trReal);
    composer.render();
    frames++;
    if (frames > 20 && frames < 140 && dt > 0.034) slowFrames++;
    if (frames === 140 && slowFrames > 60 && DPR > 1) { DPR = Math.max(1, DPR * 0.7); resize(); }
    if (frames === 140 && slowFrames > 100 && bloom.enabled) { bloom.enabled = false; }
    if (manualT == null) schedule();
  }
  function schedule() { if (!raf && running && inView && !document.hidden) raf = requestAnimationFrame(tick); }
  function start() { if (running) return; running = true; last = performance.now(); schedule(); }

  new IntersectionObserver(es => { inView = es[0].isIntersecting; if (inView) { last = performance.now(); schedule(); } }, { threshold: 0 }).observe(runway);
  document.addEventListener('visibilitychange', () => { last = performance.now(); schedule(); });

  const replayBtn = root.querySelector('.holo-replay');
  if (replayBtn) replayBtn.addEventListener('click', () => runway.scrollIntoView({ behavior: 'smooth' }));

  resize();
  if (reduced) {
    // sem animação: mostra o prédio já construído (um quadro estático)
    manualT = T.done + 4.5;
    update(manualT, 0.016); composer.render();
    root.classList.add('holo--ready', 'holo--static');
    window.addEventListener('resize', () => { update(manualT, 0.016); composer.render(); });
  } else {
    update(manualT != null ? manualT : 0, 0.016, 0);
    composer.render();
    root.classList.add('holo--ready');
    if (manualT == null) applyScrollUI(progress());
    start();
  }

  // depuração: ?holo_t=4 congela no instante; window.__holo.settle(t) / .seek(t)
  window.__holo = {
    settle(t) { manualT = t; for (let i = 0; i < 80; i++) update(t, 0.05, t); composer.render(); },
    seek(t) { manualT = t; update(t, 0.016, t); composer.render(); },
  };
})();
