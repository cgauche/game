/**
 * Scène Phaser unique — rend l'exploration ET le combat tactique à partir du
 * store. Gère les clics (déplacement, interaction, ciblage) et les animations
 * (déplacement de token, frappe, dégâts flottants).
 */
import Phaser from 'phaser';
import { useGame } from '../state/store';
import { Scene as GameScene, tileAt } from '../state/scene';
import { pathTo } from '../state/path';
import { bus, EVT } from '../state/bus';
import { TILE, TERRAIN_COLORS, TERRAIN_ACCENT, HERO_COLORS, ENEMY_COLOR, PNJ_COLOR, OBJET_COLOR, PROP_COLOR } from './palette';
import { isOutOfAction } from '../engine/conditions';

export class WorldScene extends Phaser.Scene {
  private tileGfx!: Phaser.GameObjects.Graphics;
  private highlightGfx!: Phaser.GameObjects.Graphics;
  private tokenLayer!: Phaser.GameObjects.Container;
  private tokens = new Map<string, Phaser.GameObjects.Container>();
  private unsub: Array<() => void> = [];
  private lastSceneId: string | null = null;
  private moving = false;

  constructor() {
    super('world');
  }

  create() {
    this.tileGfx = this.add.graphics();
    this.highlightGfx = this.add.graphics();
    this.tokenLayer = this.add.container(0, 0);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));

    this.unsub.push(useGame.subscribe(() => this.render()));
    this.unsub.push(bus.on(EVT.SCENE_DIRTY, () => this.render()));
    this.unsub.push(bus.on(EVT.ANIM_ATTACK, (d) => this.animateAttack(d)));
    this.events.once('shutdown', () => this.unsub.forEach((u) => u()));

    this.render(true);
  }

  private onClick(p: Phaser.Input.Pointer) {
    const st = useGame.getState();
    const sc = st.scene;
    if (!sc || st.dialogue) return;
    const x = Math.floor((p.x - this.cam().x) / TILE);
    const y = Math.floor((p.y - this.cam().y) / TILE);
    if (x < 0 || y < 0 || x >= sc.dimensions.w || y >= sc.dimensions.h) return;

    if (st.mode === 'battle') {
      const occupant = st.battle?.combatants.find((c) => c.pos && c.pos.x === x && c.pos.y === y && !isOutOfAction(c));
      if (occupant && occupant.kind === 'enemy') st.battleClickEntity(occupant.id);
      else st.battleClickTile({ x, y });
      return;
    }

    // Exploration : entité cliquée ? sinon déplacement.
    const ent = sc.entities.find((e) => e.pos.x === x && e.pos.y === y);
    if (ent && (ent.dialogueId || ent.kind === 'objet')) {
      st.interactEntity(ent.id);
      return;
    }
    this.moveAlong(sc, st.partyPos, { x, y });
  }

  /** Déplace le groupe case par case (évalue les triggers à chaque pas). */
  private moveAlong(sc: GameScene, from: { x: number; y: number }, to: { x: number; y: number }) {
    if (this.moving) return;
    const path = pathTo(sc, from, to, new Set());
    if (!path || path.length < 2) return;
    this.moving = true;
    let i = 1;
    const stepFn = () => {
      const st = useGame.getState();
      if (st.mode !== 'exploration' || st.dialogue || i >= path.length) {
        this.moving = false;
        return;
      }
      st.moveParty(path[i]);
      i++;
      this.time.delayedCall(95, stepFn);
    };
    stepFn();
  }

  private cam() {
    return { x: 8, y: 8 };
  }

  private render(force = false) {
    // Garde-fou : ne jamais rendre sur une scène inactive/détruite (sinon
    // this.add est null et une exception casse la boucle de combat).
    if (!this.add || !this.sys || !this.sys.isActive()) return;
    const st = useGame.getState();
    const sc = st.scene;
    if (!sc) {
      this.tileGfx.clear();
      this.highlightGfx.clear();
      this.tokenLayer.removeAll(true);
      this.tokens.clear();
      return;
    }
    if (force || sc.id !== this.lastSceneId) {
      this.drawTiles(sc);
      this.lastSceneId = sc.id;
    }
    this.drawHighlights(st);
    this.drawTokens(st);
  }

  private drawTiles(sc: GameScene) {
    const g = this.tileGfx;
    g.clear();
    const ox = this.cam().x;
    const oy = this.cam().y;
    for (let y = 0; y < sc.dimensions.h; y++) {
      for (let x = 0; x < sc.dimensions.w; x++) {
        const t = tileAt(sc, x, y);
        g.fillStyle(TERRAIN_COLORS[t], 1);
        g.fillRect(ox + x * TILE, oy + y * TILE, TILE, TILE);
        // Motif simple (procédural) pour donner de la texture.
        g.fillStyle(TERRAIN_ACCENT[t], 0.6);
        const seed = (x * 928371 + y * 1237) % 4;
        if (t === 'bois') g.fillCircle(ox + x * TILE + TILE / 2, oy + y * TILE + TILE / 2, TILE / 3);
        else if (t === 'mur') g.fillRect(ox + x * TILE + 2, oy + y * TILE + 2, TILE - 4, TILE / 2 - 2);
        else g.fillRect(ox + x * TILE + 4 + seed * 4, oy + y * TILE + 6 + seed * 3, 4, 4);
        g.lineStyle(1, 0x000000, 0.12);
        g.strokeRect(ox + x * TILE, oy + y * TILE, TILE, TILE);
      }
    }
  }

  private drawHighlights(st: ReturnType<typeof useGame.getState>) {
    const g = this.highlightGfx;
    g.clear();
    const ox = this.cam().x;
    const oy = this.cam().y;
    if (st.mode === 'battle' && st.battle) {
      // Cases atteignables
      for (const k of st.battle.reachable.keys()) {
        const [x, y] = k.split(',').map(Number);
        g.fillStyle(0x3b7dd8, 0.28);
        g.fillRect(ox + x * TILE, oy + y * TILE, TILE, TILE);
      }
      // Combattant actif
      const active = st.battle.combatants.find((c) => c.id === st.battle!.order[st.battle!.turn]);
      if (active?.pos) {
        g.lineStyle(3, 0xffe066, 1);
        g.strokeRect(ox + active.pos.x * TILE + 1, oy + active.pos.y * TILE + 1, TILE - 2, TILE - 2);
      }
    }
  }

  private drawTokens(st: ReturnType<typeof useGame.getState>) {
    const ox = this.cam().x;
    const oy = this.cam().y;
    const seen = new Set<string>();

    const place = (id: string, color: number, label: string, pos: { x: number; y: number }, hp?: { c: number; m: number }, dim = false) => {
      seen.add(id);
      let c = this.tokens.get(id);
      if (!c) {
        c = this.add.container(0, 0);
        const body = this.add.graphics();
        body.fillStyle(0x000000, 0.25);
        body.fillEllipse(TILE / 2, TILE - 6, TILE - 10, 8);
        body.fillStyle(color, 1);
        body.fillCircle(TILE / 2, TILE / 2 - 2, TILE / 2 - 6);
        body.lineStyle(2, 0x1a1a1a, 1);
        body.strokeCircle(TILE / 2, TILE / 2 - 2, TILE / 2 - 6);
        const txt = this.add.text(TILE / 2, TILE / 2 - 4, label, { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        const hpbar = this.add.graphics();
        c.add([body, txt, hpbar]);
        // Référence directe (recherche par getData peu fiable selon les enfants).
        (c as any).hpbar = hpbar;
        this.tokenLayer.add(c);
        this.tokens.set(id, c);
      }
      c.setPosition(ox + pos.x * TILE, oy + pos.y * TILE);
      c.setAlpha(dim ? 0.35 : 1);
      // Barre de vie
      const hpbar = (c as any).hpbar as Phaser.GameObjects.Graphics;
      hpbar.clear();
      if (hp && hp.m > 0) {
        const w = TILE - 10;
        const ratio = Math.max(0, hp.c / hp.m);
        hpbar.fillStyle(0x000000, 0.6);
        hpbar.fillRect(5, 2, w, 4);
        hpbar.fillStyle(ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xf1c40f : 0xe74c3c, 1);
        hpbar.fillRect(5, 2, w * ratio, 4);
      }
    };

    if (st.mode === 'battle' && st.battle) {
      let hi = 0;
      for (const c of st.battle.combatants) {
        if (!c.pos) continue;
        const color = c.kind === 'hero' ? HERO_COLORS[hi++ % HERO_COLORS.length] : ENEMY_COLOR;
        place(c.id, color, initial(c.name), c.pos, { c: c.wounds.current, m: c.wounds.max }, isOutOfAction(c));
      }
    } else if (st.scene) {
      // Entités de la scène
      for (const e of st.scene.entities) {
        if (e.kind === 'heroStart') continue;
        const color =
          e.kind === 'ennemi' ? ENEMY_COLOR : e.kind === 'pnj' ? PNJ_COLOR : e.kind === 'objet' ? OBJET_COLOR : PROP_COLOR;
        place(e.id, color, initial(e.label ?? e.ref ?? '?'), e.pos);
      }
      // Token du groupe
      place('__party', HERO_COLORS[0], '♥', st.partyPos, undefined);
    }

    // Nettoyer les tokens disparus
    for (const [id, c] of this.tokens) {
      if (!seen.has(id)) {
        c.destroy();
        this.tokens.delete(id);
      }
    }
  }

  private animateAttack(d: { from: string; to: string; result: any }) {
    const from = this.tokens.get(d.from);
    const to = this.tokens.get(d.to);
    if (from) {
      const ox = from.x;
      const oy = from.y;
      const tx = to ? to.x : ox;
      const ty = to ? to.y : oy;
      this.tweens.add({
        targets: from,
        x: ox + (tx - ox) * 0.4,
        y: oy + (ty - oy) * 0.4,
        duration: 110,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
    if (to && d.result?.hit) {
      const dmg = this.add
        .text(to.x + TILE / 2, to.y, `-${d.result.woundsLost}`, {
          fontSize: '16px',
          color: d.result.critical ? '#ffd166' : '#ff5252',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.tweens.add({ targets: dmg, y: to.y - 24, alpha: 0, duration: 700, onComplete: () => dmg.destroy() });
    }
  }
}

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}
