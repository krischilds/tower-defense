import { describe, expect, it } from 'vitest';
import { Game, TOWER_COST, PATH_TILES } from './game';

describe('Game', () => {
  it('rejects placement on the path and accepts it elsewhere', () => {
    const g = new Game();
    expect(g.placeTower(PATH_TILES[0].x, PATH_TILES[0].y)).toBe(false);
    expect(g.placeTower(0, 0)).toBe(true);
    expect(g.gold).toBe(150 - TOWER_COST);
    expect(g.placeTower(0, 0)).toBe(false);
  });

  it('rejects placement without enough gold', () => {
    const g = new Game();
    g.gold = 0;
    expect(g.placeTower(0, 0)).toBe(false);
  });

  it('spawns enemies, kills them with towers and awards gold', () => {
    const g = new Game();
    g.placeTower(2, 3);
    g.placeTower(3, 3);
    for (let i = 0; i < 60 * 20; i++) g.update(1 / 60);
    expect(g.wave).toBeGreaterThan(0);
    expect(g.gold).toBeGreaterThan(150 - 2 * TOWER_COST);
  });

  it('loses lives when enemies leak and ends the game', () => {
    const g = new Game();
    for (let i = 0; i < 60 * 600 && !g.gameOver; i++) g.update(1 / 60);
    expect(g.gameOver).toBe(true);
  });
});
