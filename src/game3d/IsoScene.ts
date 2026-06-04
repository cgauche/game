/**
 * Rendu 3D isométrique (Three.js) — caméra orthographique 3/4 à la Baldur's
 * Gate, éclairage directionnel + ombres + brouillard. Réutilise le store, le
 * schéma de Scène, le pathfinding et toute la logique existante (le rendu
 * Phaser est remplacé, le moteur de règles est inchangé).
 */
import * as THREE from 'three';
import { useGame } from '../state/store';
import { Scene as GameScene, tileAt, isWalkable } from '../state/scene';
import { pathTo } from '../state/path';
import { bus, EVT } from '../state/bus';
import { isOutOfAction } from '../engine/conditions';
import { terrainTexture } from './textures';

const HERO_COLORS = [0x4f8fe0, 0x37c07a, 0xe0b13f, 0xc06fd8];
const ENEMY_COLOR = 0xc0392b;
const PNJ_COLOR = 0x4aa3df;
const OBJET_COLOR = 0xf1c40f;
const PROP_COLOR = 0x8a8f95;

interface Token {
  group: THREE.Group;
  target: THREE.Vector3;
}

export class IsoScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private worldGroup = new THREE.Group();
  private tokenGroup = new THREE.Group();
  private highlightGroup = new THREE.Group();
  private tileMeshes: THREE.Mesh[] = [];
  private tokens = new Map<string, Token>();
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private unsub: Array<() => void> = [];
  private lastSceneId: string | null = null;
  private moving = false;
  private raf = 0;
  private dims = { w: 20, h: 15 };

  constructor(private container: HTMLElement) {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0e0b14);
    this.scene.fog = new THREE.Fog(0x0e0b14, 28, 60);

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);

    this.setupLights();
    this.scene.add(this.worldGroup, this.tokenGroup, this.highlightGroup);

    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('resize', this.onResize);

    this.unsub.push(useGame.subscribe(() => this.syncFromStore()));
    this.unsub.push(bus.on(EVT.ANIM_ATTACK, (d) => this.animateAttack(d)));

    this.syncFromStore(true);
    this.loop();
  }

  private setupLights() {
    const hemi = new THREE.HemisphereLight(0x9fb4d8, 0x2a2418, 0.65);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe6c0, 1.25);
    sun.position.set(12, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 30;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    // Lueur chaude d'appoint (ambiance taverne).
    const warm = new THREE.PointLight(0xff9a4a, 0.6, 22, 2);
    warm.position.set(6, 4, 5);
    this.scene.add(warm);
  }

  // --- Construction du monde ------------------------------------------------

  private buildWorld(gs: GameScene) {
    this.disposeGroup(this.worldGroup);
    this.tileMeshes = [];
    this.dims = gs.dimensions;
    const { w, h } = gs.dimensions;

    const tileGeo = new THREE.BoxGeometry(1, 0.4, 1);
    const wallGeo = new THREE.BoxGeometry(1, 2.2, 1);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = tileAt(gs, x, y);
        const tex = terrainTexture(t);
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
        const isWall = t === 'mur';
        const mesh = new THREE.Mesh(isWall ? wallGeo : tileGeo, mat);
        mesh.position.set(x + 0.5, isWall ? 1.1 : 0, y + 0.5);
        mesh.receiveShadow = true;
        mesh.castShadow = isWall;
        mesh.userData = { tx: x, ty: y };
        this.worldGroup.add(mesh);
        this.tileMeshes.push(mesh);
        if (t === 'eau') mesh.position.y = -0.18;
        if (t === 'bois') this.worldGroup.add(this.makeTree(x, y));
      }
    }
    this.frameCamera(w, h);
  }

  private makeTree(x: number, y: number): THREE.Group {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 }),
    );
    trunk.position.y = 0.4;
    trunk.castShadow = true;
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.5, 7),
      new THREE.MeshStandardMaterial({ color: 0x1f4a1c, roughness: 1 }),
    );
    foliage.position.y = 1.35;
    foliage.castShadow = true;
    g.add(trunk, foliage);
    g.position.set(x + 0.5, 0.2, y + 0.5);
    return g;
  }

  /** Personnage low-poly (corps + tête) avec couleur d'équipe. */
  private makeCharacter(color: number): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 0.85, 10),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    );
    body.position.y = 0.62;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xe2b48c, roughness: 0.8 }),
    );
    head.position.y = 1.18;
    head.castShadow = true;
    // Base/jeton au sol pour lisibilité iso.
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.15 }),
    );
    ring.position.y = 0.22;
    g.add(ring, body, head);
    return g;
  }

  private makeProp(kind: string, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    if (kind === 'objet') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), m);
      box.position.y = 0.4;
      box.castShadow = true;
      g.add(box);
    } else {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 8), m);
      b.position.y = 0.55;
      b.castShadow = true;
      g.add(b);
    }
    return g;
  }

  private frameCamera(w: number, h: number) {
    const cx = w / 2;
    const cz = h / 2;
    const span = Math.max(w, h) * 0.62;
    const aspect = (this.container.clientWidth || 1) / (this.container.clientHeight || 1);
    this.camera.left = -span * aspect;
    this.camera.right = span * aspect;
    this.camera.top = span;
    this.camera.bottom = -span;
    this.camera.near = 0.1;
    this.camera.far = 200;
    // Angle isométrique (vue 3/4).
    this.camera.position.set(cx + Math.max(w, h) * 0.7, Math.max(w, h) * 0.85, cz + Math.max(w, h) * 0.7);
    this.camera.lookAt(cx, 0, cz);
    this.camera.updateProjectionMatrix();
  }

  // --- Synchronisation avec le store ---------------------------------------

  private syncFromStore(force = false) {
    const st = useGame.getState();
    const gs = st.scene;
    if (!gs) return;
    if (force || gs.id !== this.lastSceneId) {
      this.buildWorld(gs);
      this.disposeGroup(this.tokenGroup);
      this.tokens.clear();
      this.lastSceneId = gs.id;
    }
    this.updateTokens(st);
    this.updateHighlights(st);
  }

  private ensureToken(id: string, make: () => THREE.Group): Token {
    let tk = this.tokens.get(id);
    if (!tk) {
      const group = make();
      this.tokenGroup.add(group);
      tk = { group, target: new THREE.Vector3() };
      this.tokens.set(id, tk);
    }
    return tk;
  }

  private updateTokens(st: ReturnType<typeof useGame.getState>) {
    const seen = new Set<string>();
    const setPos = (tk: Token, x: number, y: number, snap: boolean) => {
      tk.target.set(x + 0.5, 0, y + 0.5);
      if (snap) tk.group.position.copy(tk.target);
    };

    if (st.mode === 'battle' && st.battle) {
      let hi = 0;
      for (const c of st.battle.combatants) {
        if (!c.pos) continue;
        seen.add(c.id);
        const color = c.kind === 'hero' ? HERO_COLORS[hi++ % HERO_COLORS.length] : ENEMY_COLOR;
        const tk = this.ensureToken(c.id, () => this.makeCharacter(color));
        const snap = !this.tokens.has(c.id);
        setPos(tk, c.pos.x, c.pos.y, snap);
        tk.group.visible = !isOutOfAction(c);
        (tk.group as any).__out = isOutOfAction(c);
      }
    } else if (st.scene) {
      for (const e of st.scene.entities) {
        if (e.kind === 'heroStart') continue;
        seen.add(e.id);
        const color =
          e.kind === 'personnage' ? PNJ_COLOR : e.kind === 'objet' ? OBJET_COLOR : PROP_COLOR;
        const tk = this.ensureToken(e.id, () =>
          e.kind === 'personnage' ? this.makeCharacter(color) : this.makeProp(e.kind, color),
        );
        setPos(tk, e.pos.x, e.pos.y, true);
      }
      // Token du groupe (exploration).
      seen.add('__party');
      const tk = this.ensureToken('__party', () => this.makeCharacter(HERO_COLORS[0]));
      setPos(tk, st.partyPos.x, st.partyPos.y, false);
    }

    for (const [id, tk] of this.tokens) {
      if (!seen.has(id)) {
        this.tokenGroup.remove(tk.group);
        this.tokens.delete(id);
      }
    }
  }

  private updateHighlights(st: ReturnType<typeof useGame.getState>) {
    this.disposeGroup(this.highlightGroup);
    if (st.mode !== 'battle' || !st.battle) return;
    const plate = new THREE.PlaneGeometry(0.92, 0.92);
    const matMove = new THREE.MeshBasicMaterial({ color: 0x4f8fe0, transparent: true, opacity: 0.32 });
    for (const k of st.battle.reachable.keys()) {
      const [x, y] = k.split(',').map(Number);
      const p = new THREE.Mesh(plate, matMove);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x + 0.5, 0.22, y + 0.5);
      this.highlightGroup.add(p);
    }
    const active = st.battle.combatants.find((c) => c.id === st.battle!.order[st.battle!.turn]);
    if (active?.pos) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.5, 24),
        new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(active.pos.x + 0.5, 0.24, active.pos.y + 0.5);
      this.highlightGroup.add(ring);
    }
  }

  // --- Entrées (raycast) ----------------------------------------------------

  private onPointerDown(e: PointerEvent) {
    const st = useGame.getState();
    const gs = st.scene;
    if (!gs || st.dialogue) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.tileMeshes, false)[0];
    if (!hit) return;
    const { tx, ty } = hit.object.userData as { tx: number; ty: number };

    if (st.mode === 'battle') {
      const occ = st.battle?.combatants.find((c) => c.pos && c.pos.x === tx && c.pos.y === ty && !isOutOfAction(c));
      if (occ && occ.kind === 'enemy') st.battleClickEntity(occ.id);
      else st.battleClickTile({ x: tx, y: ty });
      return;
    }
    const ent = gs.entities.find((en) => en.pos.x === tx && en.pos.y === ty);
    if (ent && (ent.dialogueId || ent.kind === 'objet')) {
      st.interactEntity(ent.id);
      return;
    }
    this.moveAlong(gs, st.partyPos, { x: tx, y: ty });
  }

  private moveAlong(gs: GameScene, from: { x: number; y: number }, to: { x: number; y: number }) {
    if (this.moving) return;
    if (!isWalkable(gs, to.x, to.y)) return;
    const path = pathTo(gs, from, to, new Set());
    if (!path || path.length < 2) return;
    this.moving = true;
    let i = 1;
    const step = () => {
      const st = useGame.getState();
      if (st.mode !== 'exploration' || st.dialogue || i >= path.length) {
        this.moving = false;
        return;
      }
      st.moveParty(path[i]);
      i++;
      setTimeout(step, 140);
    };
    step();
  }

  private animateAttack(d: { from: string; to: string }) {
    const from = this.tokens.get(d.from);
    const to = this.tokens.get(d.to);
    if (!from || !to) return;
    const start = from.group.position.clone();
    const dir = to.group.position.clone().sub(start).normalize().multiplyScalar(0.35);
    from.group.position.add(dir);
    setTimeout(() => from.group.position.copy(start), 130);
  }

  // --- Boucle / cycle de vie ------------------------------------------------

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    for (const tk of this.tokens.values()) {
      tk.group.position.lerp(tk.target, Math.min(1, dt * 12));
    }
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.frameCamera(this.dims.w, this.dims.h);
  };

  private disposeGroup(g: THREE.Group) {
    for (let i = g.children.length - 1; i >= 0; i--) {
      const c = g.children[i] as any;
      g.remove(c);
      c.traverse?.((o: any) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose());
        else o.material?.dispose?.();
      });
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.unsub.forEach((u) => u());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
