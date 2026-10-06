import {
  Application, Container, Graphics, Particle, ParticleContainer, Sprite, Texture,
} from 'pixi.js';
import {
  COLS, ROWS, TILE, TOWER_COST, TOWER_RANGE, PATH, Game, type GameEvent,
} from './game';

interface Spark { p: Particle; vx: number; vy: number; life: number; max: number }

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    width: COLS * TILE,
    height: ROWS * TILE,
    background: 0x1d2b1d,
    antialias: true,
    preference: 'webgpu', // falls back to WebGL when WebGPU is unavailable
  });
  const hud = document.getElementById('hud')!;
  document.getElementById('app')!.appendChild(app.canvas);
  const rendererName = app.renderer.name;

  const make = (draw: (g: Graphics) => void): Texture => {
    const g = new Graphics();
    draw(g);
    return app.renderer.generateTexture(g);
  };
  const enemyTex = make((g) => g.circle(10, 10, 10).fill(0xe74c3c));
  const towerTex = make((g) => g.rect(0, 0, TILE - 8, TILE - 8).fill(0x3498db));
  const bulletTex = make((g) => g.circle(4, 4, 4).fill(0xf1c40f));
  const sparkTex = make((g) => g.circle(3, 3, 3).fill(0xffffff));

  // static map: path
  const map = new Graphics();
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    map.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  map.stroke({ width: TILE - 6, color: 0x8b6b3d, join: 'round', cap: 'square' });
  app.stage.addChild(map);

  const world = new Container();
  const ghost = new Graphics().circle(0, 0, TOWER_RANGE).stroke({ width: 1, color: 0xffffff, alpha: 0.4 });
  ghost.visible = false;
  app.stage.addChild(world, ghost);

  const sparksLayer = new ParticleContainer({
    dynamicProperties: { position: true, color: true, vertex: true },
  });
  app.stage.addChild(sparksLayer);

  const game = new Game();
  const towerSprites: Sprite[] = [];
  const enemySprites = new Map<number, Sprite>();
  const bulletSprites = new Map<number, Sprite>();
  const sparks: Spark[] = [];

  const burst = (e: GameEvent, count: number, color: number, speed: number): void => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random());
      const p = new Particle({ texture: sparkTex, x: e.x, y: e.y, tint: color, anchorX: 0.5, anchorY: 0.5 });
      sparksLayer.addParticle(p);
      sparks.push({ p, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5 });
    }
  };

  const tileAt = (ev: PointerEvent | MouseEvent) => {
    const r = app.canvas.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * app.canvas.width / app.renderer.resolution;
    const y = ((ev.clientY - r.top) / r.height) * app.canvas.height / app.renderer.resolution;
    return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) };
  };
  app.canvas.addEventListener('pointerdown', (ev) => {
    const { col, row } = tileAt(ev);
    if (game.placeTower(col, row)) {
      const s = new Sprite(towerTex);
      s.position.set(col * TILE + 4, row * TILE + 4);
      world.addChild(s);
      towerSprites.push(s);
    }
  });
  app.canvas.addEventListener('pointermove', (ev) => {
    const { col, row } = tileAt(ev);
    ghost.visible = game.canPlace(col, row);
    ghost.position.set((col + 0.5) * TILE, (row + 0.5) * TILE);
  });
  app.canvas.addEventListener('pointerleave', () => { ghost.visible = false; });

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    game.update(dt);

    for (const ev of game.events) {
      if (ev.type === 'hit') burst(ev, 4, 0xf1c40f, 120);
      else if (ev.type === 'kill') burst(ev, 16, 0xe74c3c, 200);
      else if (ev.type === 'leak') burst(ev, 10, 0x9b59b6, 150);
    }

    const alive = new Set<number>();
    for (const e of game.enemies) {
      alive.add(e.id);
      let s = enemySprites.get(e.id);
      if (!s) { s = new Sprite(enemyTex); s.anchor.set(0.5); world.addChild(s); enemySprites.set(e.id, s); }
      s.position.set(e.x, e.y);
      s.alpha = 0.4 + 0.6 * (e.hp / e.maxHp);
    }
    for (const [id, s] of enemySprites) if (!alive.has(id)) { s.destroy(); enemySprites.delete(id); }

    const bullets = new Set<number>();
    for (const p of game.projectiles) {
      bullets.add(p.id);
      let s = bulletSprites.get(p.id);
      if (!s) { s = new Sprite(bulletTex); s.anchor.set(0.5); world.addChild(s); bulletSprites.set(p.id, s); }
      s.position.set(p.x, p.y);
    }
    for (const [id, s] of bulletSprites) if (!bullets.has(id)) { s.destroy(); bulletSprites.delete(id); }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const k = sparks[i];
      k.life -= dt;
      if (k.life <= 0) { sparksLayer.removeParticle(k.p); sparks.splice(i, 1); continue; }
      k.p.x += k.vx * dt;
      k.p.y += k.vy * dt;
      k.p.alpha = k.life / k.max;
    }

    hud.textContent = `Renderer: ${rendererName} | Gold: ${game.gold} | Lives: ${game.lives} | Wave: ${game.wave} | Click a grass tile to build a tower (${TOWER_COST}g)` +
      (game.gameOver ? ' | GAME OVER' : '');
  });
}

main();
