# Tower Defense

A 2D tower defense game built with [PixiJS v8](https://pixijs.com) using the WebGPU renderer
(automatic WebGL fallback), batched sprites and a `ParticleContainer` for effects.

## Run

```
npm install
npm run dev     # development server
npm test        # game logic tests
npm run build   # type-check and production build
```

Click a grass tile to build a tower (50 gold). Towers shoot the enemy furthest along the path.
