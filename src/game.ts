export const TILE = 48;
export const COLS = 20;
export const ROWS = 12;
export const TOWER_COST = 50;
export const TOWER_RANGE = 3 * TILE;
export const TOWER_COOLDOWN = 0.5;
export const TOWER_DAMAGE = 1;
export const PROJECTILE_SPEED = 400;

export interface Vec { x: number; y: number }
export interface Enemy { id: number; x: number; y: number; hp: number; maxHp: number; speed: number; seg: number }
export interface Tower { col: number; row: number; cooldown: number }
export interface Projectile { id: number; x: number; y: number; target: Enemy; speed: number }

export type GameEvent =
  | { type: 'hit'; x: number; y: number }
  | { type: 'kill'; x: number; y: number }
  | { type: 'leak'; x: number; y: number }
  | { type: 'shot'; x: number; y: number };

/** Waypoints in tile coordinates (tile centres). */
export const PATH_TILES: Vec[] = [
  { x: 0, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 8 }, { x: 11, y: 8 },
  { x: 11, y: 3 }, { x: 16, y: 3 }, { x: 16, y: 9 }, { x: 19, y: 9 },
];

export const PATH: Vec[] = PATH_TILES.map((p) => ({ x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE }));

export function isPathTile(col: number, row: number): boolean {
  for (let i = 0; i < PATH_TILES.length - 1; i++) {
    const a = PATH_TILES[i], b = PATH_TILES[i + 1];
    if (col >= Math.min(a.x, b.x) && col <= Math.max(a.x, b.x) &&
        row >= Math.min(a.y, b.y) && row <= Math.max(a.y, b.y)) return true;
  }
  return false;
}

export class Game {
  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  gold = 150;
  lives = 20;
  wave = 0;
  private nextId = 1;
  private spawnQueue = 0;
  private spawnTimer = 0;
  private waveTimer = 3;
  events: GameEvent[] = [];

  get gameOver(): boolean { return this.lives <= 0; }

  canPlace(col: number, row: number): boolean {
    return col >= 0 && col < COLS && row >= 0 && row < ROWS &&
      !isPathTile(col, row) &&
      !this.towers.some((t) => t.col === col && t.row === row);
  }

  placeTower(col: number, row: number): boolean {
    if (this.gold < TOWER_COST || !this.canPlace(col, row)) return false;
    this.gold -= TOWER_COST;
    this.towers.push({ col, row, cooldown: 0 });
    return true;
  }

  private spawn(): void {
    const hp = 3 + this.wave * 2;
    this.enemies.push({
      id: this.nextId++, x: PATH[0].x, y: PATH[0].y, hp, maxHp: hp,
      speed: 50 + this.wave * 4, seg: 1,
    });
  }

  update(dt: number): void {
    this.events.length = 0;
    if (this.gameOver) return;

    if (this.spawnQueue > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawn();
        this.spawnQueue--;
        this.spawnTimer = 0.8;
      }
    } else if (this.enemies.length === 0) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.wave++;
        this.spawnQueue = 5 + this.wave * 2;
        this.waveTimer = 3;
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      let move = e.speed * dt;
      while (move > 0 && e.seg < PATH.length) {
        const t = PATH[e.seg];
        const dx = t.x - e.x, dy = t.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d <= move) { e.x = t.x; e.y = t.y; e.seg++; move -= d; }
        else { e.x += (dx / d) * move; e.y += (dy / d) * move; move = 0; }
      }
      if (e.seg >= PATH.length) {
        this.lives--;
        this.events.push({ type: 'leak', x: e.x, y: e.y });
        this.enemies.splice(i, 1);
      }
    }

    for (const t of this.towers) {
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const tx = (t.col + 0.5) * TILE, ty = (t.row + 0.5) * TILE;
      let best: Enemy | null = null;
      let bestProgress = -1;
      for (const e of this.enemies) {
        if (e.hp <= 0 || Math.hypot(e.x - tx, e.y - ty) > TOWER_RANGE) continue;
        if (e.seg > bestProgress) { best = e; bestProgress = e.seg; }
      }
      if (best) {
        t.cooldown = TOWER_COOLDOWN;
        this.projectiles.push({ id: this.nextId++, x: tx, y: ty, target: best, speed: PROJECTILE_SPEED });
        this.events.push({ type: 'shot', x: tx, y: ty });
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const e = p.target;
      if (e.hp <= 0 || !this.enemies.includes(e)) { this.projectiles.splice(i, 1); continue; }
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step) {
        e.hp -= TOWER_DAMAGE;
        this.events.push({ type: 'hit', x: e.x, y: e.y });
        if (e.hp <= 0) {
          this.gold += 10;
          this.events.push({ type: 'kill', x: e.x, y: e.y });
          this.enemies.splice(this.enemies.indexOf(e), 1);
        }
        this.projectiles.splice(i, 1);
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
  }
}
