# Holograma (seção inicial da home)

Código-fonte do bundle `js/hologram.js` (Three.js + pós-processamento, tudo local, sem CDN).

Para regenerar o bundle:

```bash
cd hologram-src
npm init -y && npm i three@0.160.0 esbuild
npx esbuild hologram.js --bundle --minify --format=iife --target=es2020 --outfile=../js/hologram.js
```

- `?holo_t=7` na URL congela a animação num instante (útil para depurar).
- Com `prefers-reduced-motion`, mostra o prédio já construído, sem animação.
