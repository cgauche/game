// @vitest-environment jsdom
/**
 * CONSOLE DE COMBAT — contrats de GÉOMÉTRIE de l'arche (spec HUD combat §1c-bis) : la niche d'États
 * (rack d'alvéoles réservées) et les deux gouttières sont DESSINÉES quoi qu'il arrive. Montée pour de
 * vrai (`createRoot`/`act`) sur le VRAI store et de VRAIS héros (`createHero`) — aucun module mocké.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, movementRemaining, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant, ConditionInstance } from '../engine/types';
import { CombatConsole } from './CombatConsole';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hpColor } from '../gameIso/teamColors';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function hero(id: string, label: string): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, rng: makeRNG(7) });
  h.id = id;
  h.pos = { x: 5, y: 5 };
  return h;
}

function foe(id: string, x: number, y: number): Combatant {
  const e = hero(id, `Rat ${id}`);
  e.kind = 'enemy';
  e.pos = { x, y };
  return e;
}

let host: HTMLDivElement;
let root: Root;

/** Combat en cours : la console se monte sur le store réel. `turn` désigne l'acteur ACTIF dans
 *  l'ordre (`0` = le héros `h`, `1+` = les adversaires) — le tour adverse est un cas de contrat. */
function monter(h: Combatant, opts: { foes?: Combatant[]; runBudget?: number; turn?: number } = {}) {
  const foes = opts.foes ?? [];
  const order = [h.id, ...foes.map((f) => f.id)];
  // Le `setState` passe par `act` : une console déjà montée est abonnée au store, le changement de
  // tour est donc une mise à jour React comme une autre.
  act(() => {
    useGame.setState({
      party: [h],
      battle: {
        combatants: [h, ...foes], order, baseOrder: order, turn: opts.turn ?? 0, round: 1,
        action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
        acted: false, runBudget: opts.runBudget ?? 4, log: [], over: null,
      } as unknown as BattleState,
    });
  });
  act(() => { root.render(<CombatConsole />); });
  return host.innerHTML;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null });
});

/** Le rack d'États de l'arche seul (le bandeau/les tuiles ne sont pas montés ici). */
function niche() {
  return host.querySelector('.cc-arch .ptile-states[data-reserve]');
}

describe('CombatConsole — arche', () => {
  it('dessine la niche d’États même quand le héros n’en porte AUCUN : 4 alvéoles réservées', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const rack = niche();
    expect(rack).not.toBeNull();
    expect(rack!.querySelectorAll('.pt-state, .pt-void').length).toBe(4);
    expect(rack!.querySelectorAll('.pt-state').length).toBe(0);
  });

  it('peuple la niche d’icônes + INDICE chiffré par État, sans changer le compte d’alvéoles', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [
      { id: 'hemorragique', value: 3 },
      { id: 'assourdi', value: 2 },
      { id: 'empetre', value: 1 },
    ] as ConditionInstance[];
    monter(h);
    const rack = niche()!;
    expect(rack.querySelectorAll('.pt-state, .pt-void').length).toBe(4);
    expect(rack.querySelectorAll('.pt-state').length).toBe(3);
    // Le rang des alvéoles suit la sévérité (`summarizeEffects`) — c'est le CHIFFRE de chacune qui
    // est le contrat ici, pas son rang : la comparaison est triée.
    expect([...rack.querySelectorAll('.pt-n')].map((n) => n.textContent).sort()).toEqual(['1', '2', '3']);
  });

  // Chrome d'état de l'arche (spec §1c) : Assailli ×N est un ÉTAT du porteur — il vit dans la MÊME
  // niche, pas dans une rangée de chips à part.
  it('fait entrer les États de SITUATION (Assailli ×N) dans le même rack', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 5, 6), foe('e2', 6, 5)] });
    const rack = niche()!;
    expect(rack.querySelectorAll('.pt-state').length).toBe(1);
    expect(rack.querySelector('.pt-n')!.textContent).toBe('2');
    expect(rack.querySelectorAll('.pt-state, .pt-void').length).toBe(4);
  });

  // Géométrie IMMUABLE : une ressource à zéro ne supprime pas sa gouttière (héros Empêtré = Mouvement 0).
  it('garde les DEUX gouttières dessinées à 0 Mouvement, socle lisible', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [{ id: 'empetre', value: 1 }] as ConditionInstance[];
    monter(h, { runBudget: 0 });
    expect(host.querySelectorAll('.cc-gutter-action').length).toBe(1);
    const move = host.querySelector('.cc-gutter-move');
    expect(move).not.toBeNull();
    expect(move!.querySelector('.cc-socle')!.textContent).toBe('0MOUV.');
    expect(move!.querySelectorAll('.cc-gutter-rail > i').length).toBe(0);
  });

  // Planche USER 2026-08-17 : le socle porte la VALEUR COURANTE et, dessous, le LIBELLÉ de sa
  // ressource (« 3 / MOUV. », « 1 / ACTION ») — le maximum se lit aux crans du rail, jamais deux fois.
  it('socle = valeur courante + libellé de la ressource, sans « N/M »', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const battle = useGame.getState().battle!;
    // Le Mouvement restant vient du moteur (`movementRemaining`), il n'est pas forcé par le test.
    const reste = movementRemaining(battle, h);
    expect(reste).toBeGreaterThan(0);
    const move = host.querySelector('.cc-gutter-move')!;
    const action = host.querySelector('.cc-gutter-action')!;
    const socleMove = move.querySelector('.cc-socle')!;
    const socleAction = action.querySelector('.cc-socle')!;
    expect(socleMove.querySelector('i')!.textContent).toBe('MOUV.');
    expect(socleAction.querySelector('i')!.textContent).toBe('ACTION');
    // La valeur est le TEXTE du badge, libellé retiré : aucun « / » (le max vit aux crans).
    expect(socleMove.textContent!.replace('MOUV.', '')).toBe(String(reste));
    expect(socleAction.textContent!.replace('ACTION', '')).toBe('1');
    expect(socleMove.textContent).not.toContain('/');
    expect(socleAction.textContent).not.toContain('/');
    // … et les crans, eux, disent bien le maximum (aucun Mouvement dépensé ici).
    expect(move.querySelectorAll('.cc-gutter-rail > i').length).toBe(reste);
    expect(action.querySelectorAll('.cc-gutter-rail > i').length).toBe(1);
  });

  // Planche USER 2026-08-17 : MOUVEMENT à GAUCHE du portrait, ACTION à DROITE, niche d'États au
  // flanc droit — l'ordre de lecture de l'arche est un contrat, pas un hasard de composition.
  it('place la gouttière Mouvement à GAUCHE du portrait et l’Action à DROITE, États au flanc droit', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const body = host.querySelector('.cc-arch-body')!;
    const rangs = [...body.children].map((el) =>
      el.classList.contains('cc-gutter-move') ? 'move'
      : el.classList.contains('cc-gutter-action') ? 'action'
      : el.classList.contains('ptile-states') ? 'etats'
      : el.querySelector('.ptile') ? 'portrait'
      : 'autre',
    );
    expect(rangs).toEqual(['move', 'portrait', 'action', 'etats']);
  });

  // Planche USER 2026-08-17 : Blessures en BARRE PLEINE LARGEUR sous le corps de l'arche, valeur
  // NOMMÉE (« 9 / 9 BLESSURES ») — et une seule écriture de la donnée (le portrait n'en porte plus).
  it('rend les Blessures en barre nommée sous le corps, une seule fois', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    h.wounds = { current: 9, max: 9 };
    monter(h);
    const arch = host.querySelector('.cc-arch')!;
    const barres = arch.querySelectorAll('.life-bar');
    expect(barres.length).toBe(1);
    expect(barres[0].parentElement).toBe(arch);
    expect(barres[0].querySelector('.life-bar__value')!.textContent).toBe('9 / 9 BLESSURES');
    expect(barres[0].querySelector('[role="meter"]')!.getAttribute('aria-valuenow')).toBe('9');
    // La barre se pose APRÈS le corps (portrait + gouttières) et AVANT le nom gravé.
    const ordre = [...arch.children];
    expect(ordre.indexOf(arch.querySelector('.cc-arch-body')!)).toBeLessThan(ordre.indexOf(barres[0]));
    expect(ordre.indexOf(barres[0])).toBeLessThan(ordre.indexOf(arch.querySelector('.cc-arch-name')!));
  });

  // Spec zone 7 : « tour adverse/autre joueur/auto-combat = console en LECTURE (mêmes cases,
  // inertes) » + §1c-bis (géométrie de l'arche immuable). L'arche de l'ennemi actif porte donc la
  // MÊME structure que celle du héros — et les valeurs viennent du moteur, pas d'un masquage.
  it('rend la MÊME arche au tour d’un ENNEMI : 2 gouttières, 2 socles, 4 alvéoles, barre et nom', () => {
    const structure = () => {
      const arch = host.querySelector('.cc-arch')!;
      return {
        gutters: arch.querySelectorAll('.cc-gutter').length,
        move: arch.querySelectorAll('.cc-gutter-move').length,
        action: arch.querySelectorAll('.cc-gutter-action').length,
        socles: arch.querySelectorAll('.cc-socle').length,
        alveoles: arch.querySelectorAll('.ptile-states[data-reserve] > *').length,
        barres: arch.querySelectorAll('.life-bar').length,
        noms: arch.querySelectorAll('.cc-arch-name').length,
      };
    };
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    const e = foe('e1', 9, 9);
    e.conditions = [{ id: 'hemorragique', value: 2 }] as ConditionInstance[];
    e.wounds = { current: 7, max: 12 };

    monter(h, { foes: [e] });
    const auHeros = structure();
    expect(auHeros).toEqual({ gutters: 2, move: 1, action: 1, socles: 2, alveoles: 4, barres: 1, noms: 1 });

    monter(h, { foes: [e], turn: 1 });
    expect(structure()).toEqual(auHeros);

    // … et l'arche parle bien de l'ENNEMI : son nom, ses Blessures, ses États.
    const arch = host.querySelector('.cc-arch')!;
    expect(arch.querySelector('.cc-arch-name')!.textContent).toBe('Rat e1');
    expect(arch.querySelector('.life-bar__value')!.textContent).toBe('7 / 12 BLESSURES');
    const rack = niche()!;
    expect(rack.querySelectorAll('.pt-state').length).toBe(1);
    expect(rack.querySelector('.pt-n')!.textContent).toBe('2');

    // Les socles disent la valeur RÉELLE du moteur pour cet acteur (aucun 0 de masquage).
    const battle = useGame.getState().battle!;
    const reste = movementRemaining(battle, e);
    expect(reste).toBeGreaterThan(0);
    expect(arch.querySelector('.cc-gutter-move .cc-socle')!.textContent).toBe(`${reste}MOUV.`);
    expect(arch.querySelector('.cc-gutter-action .cc-socle')!.textContent).toBe('1ACTION');
  });
});

// ── SONDES PIXEL du juge vision (2026-08-17) promues en contrats ────────────────────────────────
// Aucune sonde DOM ne voyait ces défauts : ils vivent dans les COULEURS et les BOÎTES déclarées.
// On les juge donc là où ils sont décidés — le CSS — en recomposant les couleurs comme le fait le
// moteur de rendu (résolution des tokens `:root`, alpha composité sur son fond) et en mesurant le
// contraste WCAG 2.x. Seuil 3:1 pour un ÉLÉMENT graphique (frontière de cran), 4,5:1 pour un TEXTE.
// ANGLE MORT DÉCLARÉ : ces contrats jugent les couleurs DÉCLARÉES, pas les pixels d'un rendu — un
// défaut né d'une superposition non déclarée ici (ombre portée, filtre) leur échappe ; la capture
// reste le juge de dernier ressort.
// L'environnement jsdom ne fournit pas d'`import.meta.url` de schéma `file:` : les modules CSS se
// lisent depuis la racine du projet (racine de la suite Vitest).
const STYLES = join(process.cwd(), 'src', 'ui', 'styles');
const readCss = (f: string) => readFileSync(join(STYLES, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const CC_CSS = readCss('combat-console.css');
const HUD_CSS = readCss('hud.css');
const BASE_CSS = readCss('base.css');
const CC_BASE = baseSection(CC_CSS);
const HUD_BASE = baseSection(HUD_CSS);
const MODALS_BASE = baseSection(readCss('combat-modals.css'));

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Bloc `@media` COMPLET (accolades équilibrées), sans son accolade fermante. */
function mediaBlock(css: string, query: string): string {
  const i = css.indexOf(query);
  expect(i, `tranche ${query} absente`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let j = css.indexOf('{', i); j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') {
      depth--;
      if (depth === 0) return css.slice(i, j);
    }
  }
  return css.slice(i);
}

/** Section de BASE d'un module : toutes les tranches `@media` retirées. Une règle de base est la
 *  loi à TOUTE largeur — c'est là que se jugent les couleurs (les tranches ne règlent que la
 *  densité). */
function baseSection(css: string): string {
  let out = css;
  for (;;) {
    const i = out.indexOf('@media');
    if (i < 0) return out;
    let depth = 0;
    let end = out.length;
    for (let j = out.indexOf('{', i); j < out.length; j++) {
      if (out[j] === '{') depth++;
      else if (out[j] === '}') {
        depth--;
        if (depth === 0) { end = j + 1; break; }
      }
    }
    out = out.slice(0, i) + out.slice(end);
  }
}

/** Déclarations de LA règle au sélecteur exact (normalisé) — une seule, sinon la sonde ment. */
function ruleOf(css: string, selector: string): string {
  const hits = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((b) => norm(b[1]) === norm(selector));
  expect(hits.length, `règle « ${selector} » : ${hits.length} occurrence(s), attendu 1`).toBe(1);
  return hits[0][2];
}

/** Valeur déclarée d'une propriété (la DERNIÈRE gagne, comme en cascade). */
function decl(block: string, prop: string): string | null {
  const all = [...block.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'gi'))];
  return all.length ? norm(all[all.length - 1][1]) : null;
}

function token(name: string): string {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(BASE_CSS);
  expect(m, `token ${name} absent de base.css`).not.toBeNull();
  return m![1].trim();
}

type RGBA = [number, number, number, number];

function parseColor(v: string): RGBA {
  const t = v.trim();
  if (t.startsWith('var(')) return parseColor(token(t.slice(4, t.indexOf(')')).trim()));
  if (t.startsWith('#')) {
    const h = t.slice(1);
    const w = h.length <= 4 ? 1 : 2;
    const at = (i: number) => parseInt(w === 1 ? h[i] + h[i] : h.slice(i * 2, i * 2 + 2), 16);
    return [at(0), at(1), at(2), h.length === 4 || h.length === 8 ? at(3) / 255 : 1];
  }
  const m = /rgba?\(([^)]*)\)/.exec(t);
  expect(m, `couleur non reconnue : ${v}`).not.toBeNull();
  const parts = m![1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

/** Toutes les couleurs d'une valeur (un dégradé en porte plusieurs — chaque arrêt est un fond réel). */
function colorsIn(value: string): RGBA[] {
  return [...value.matchAll(/var\(--[\w-]+\)|#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((m) => parseColor(m[0]));
}

/** Couleur d'un raccourci `border` (`1px solid <couleur>`). */
const borderColorOf = (block: string, prop = 'border') => colorsIn(decl(block, prop)!).slice(-1)[0];

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (c: RGBA) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
/** Composition alpha (le moteur peint le premier SUR le second). */
const over = (fg: RGBA, bg: RGBA): RGBA => [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3]), 1];
function contrast(fg: RGBA, bg: RGBA): number {
  const a = lum(over(fg, bg));
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/** Contraste le PIRE d'une encre contre tous les fonds possibles (arrêts de dégradé compris). */
const worst = (fg: RGBA, bgs: RGBA[]) => Math.min(...bgs.map((bg) => contrast(fg, bg)));

describe('CombatConsole — micro-rendu (sondes pixel du juge vision, 2026-08-17)', () => {
  // A-1 / C-3 : « le max se lit aux crans » du socle SUPPOSE des crans visibles. Filet blanc à 0,14
  // d'alpha sur un rail presque noir = ΔL 1 mesuré sur 70px : à 0/N, un tube lisse.
  it('A-1 — le filet d’un cran de gouttière se lit sur le fond du rail, à vide comme plein', () => {
    const rail = ruleOf(CC_BASE, '.cc-gutter-rail');
    const fonds = colorsIn(decl(rail, 'background')!);
    expect(fonds.length).toBeGreaterThanOrEqual(2);
    const cran = ruleOf(CC_BASE, '.cc-gutter-rail > i');
    const bordVide = borderColorOf(cran);
    const fondVide = parseColor(decl(cran, 'background')!);
    // Le filet contre le CREUX du rail (chacun de ses arrêts) et contre le fond du cran lui-même.
    expect(worst(bordVide, [...fonds, fondVide])).toBeGreaterThanOrEqual(3);

    // Cran PLEIN : son filet sépare deux crans voisins (sinon la colonne se fond en tube).
    const plein = ruleOf(CC_BASE, '.cc-gutter-rail > i.on');
    const bordPlein = parseColor(decl(plein, 'border-color')!);
    for (const jauge of ['--gauge-action', '--gauge-move']) {
      expect(contrast(bordPlein, parseColor(token(jauge)))).toBeGreaterThanOrEqual(3);
    }
    // … et aucun halo EXTERNE ne comble l'écart entre deux crans (c'est ce qui les fondait).
    expect(decl(plein, 'box-shadow') ?? 'none').toMatch(/^(inset|none)/);
  });

  // A-4 : « MOUV. »/« ACTION » à 7px — 4,14:1 mesuré au pic, sous le seuil de texte.
  it('A-4 — l’encre des socles tient 4,5:1 sur la plaque du socle, valeur comme libellé', () => {
    const socle = ruleOf(CC_BASE, '.cc-socle');
    const arche = parseColor(token('--cc-arch-mid'));
    const plaque = colorsIn(decl(socle, 'background')!).map((c) => over(c, arche));
    const libelle = parseColor(decl(ruleOf(CC_BASE, '.cc-socle > i'), 'color')!);
    expect(worst(libelle, plaque)).toBeGreaterThanOrEqual(4.5);
    for (const jauge of ['--gauge-action', '--gauge-move']) {
      expect(worst(parseColor(token(jauge)), plaque)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // B-4 : chiffre blanc sur le vert de `hpColor` — 1,88:1 mesuré. La valeur prend sa PLAQUE, et son
  // corps passe en monospace (« BLESSURES » en fonte display rendait « BŁESSURES »).
  it('B-4 — la valeur de la barre de Blessures tient 4,5:1 sur TOUTES les teintes de hpColor, en mono', () => {
    const val = ruleOf(CC_BASE, '.combat-console .cc-arch > [data-overlay] > span');
    expect(decl(val, 'font')).toMatch(/monospace/);
    expect(val).not.toContain('--font-display');
    // La carte du BANDEAU porte la même donnée sur la même primitive : même traitement, même seuil.
    const tuile = ruleOf(HUD_BASE, '.party-dock .ptile [data-overlay] > span');
    for (const bloc of [val, tuile]) {
      const fond = decl(bloc, 'background');
      const ink = parseColor(decl(bloc, 'color')!);
      const bgs = [1, 0.7, 0.5, 0.2, 0].map((r) => {
        const piste = parseColor(hpColor(r));
        return fond ? over(parseColor(fond), piste) : piste;
      });
      expect(worst(ink, bgs)).toBeGreaterThanOrEqual(4.5);
    }
    // Sans plaque déclarée, l'encre se juge À MÊME le remplissage de la piste — c'est le défaut
    // mesuré (blanc sur le vert de `hpColor`, 1,88:1) ; avec plaque, elle se juge sur la plaque
    // composée sur ce même remplissage.
    const fondVal = decl(val, 'background');
    const plaque = fondVal ? parseColor(fondVal) : null;
    const encre = parseColor(decl(val, 'color')!);
    // Les teintes RÉELLES de la barre viennent du moteur (`hpColor`), aucune valeur recopiée ici.
    const fonds = [1, 0.7, 0.5, 0.2, 0].map((r) => {
      const piste = parseColor(hpColor(r));
      return plaque ? over(plaque, piste) : piste;
    });
    expect(worst(encre, fonds)).toBeGreaterThanOrEqual(4.5);
  });

  // A-2 : la plaque de l'indice mangeait le filet de son alvéole (8/16 rangées du bord droit).
  it('A-2 — l’indice d’État se loge DANS l’alvéole, sans mordre son cadre', () => {
    const n = ruleOf(HUD_BASE, '.ptile-states[data-reserve] .pt-n');
    expect(decl(n, 'position')).toBe('absolute');
    for (const cote of ['top', 'right', 'bottom', 'left']) {
      const v = decl(n, cote);
      if (v) expect(parseFloat(v), `.pt-n ${cote}: ${v} déborde la boîte`).toBeGreaterThanOrEqual(0);
    }
  });

  it('A-3 — le glyphe occupe son alvéole et l’indice porte sa propre pastille', () => {
    const svg = ruleOf(HUD_BASE, '.ptile-states[data-reserve] .pt-state svg');
    // Le glyphe laisse le filet de l'alvéole, pas davantage (à −4px il tombait à 11px dans 15).
    for (const p of ['width', 'height']) expect(decl(svg, p)).toBe('calc(var(--alv) - 2px)');
    const n = ruleOf(HUD_BASE, '.ptile-states[data-reserve] .pt-n');
    const pastille = parseColor(decl(n, 'background')!);
    expect(pastille[3]).toBe(1);
    expect(contrast(parseColor(decl(n, 'color')!), pastille)).toBeGreaterThanOrEqual(4.5);
    // … et la pastille se DÉTACHE du fond de l'alvéole (sinon elle se lit comme un trait du glyphe).
    const alv = ruleOf(HUD_BASE, '.ptile-states[data-reserve] .pt-state, .ptile-states[data-reserve] .pt-void');
    const fondAlv = colorsIn(decl(alv, 'background')!).map((c) => over(c, parseColor(token('--cc-brass-cell-hi'))));
    expect(worst(pastille, fondAlv)).toBeGreaterThanOrEqual(3);
  });

  it('B-6 — l’alvéole VIDE est opaque et cerclée, d’un cran SOUS l’alvéole portée', () => {
    const alv = ruleOf(HUD_BASE, '.ptile-states[data-reserve] .pt-state, .ptile-states[data-reserve] .pt-void');
    const vide = ruleOf(HUD_BASE, '.ptile-states[data-reserve] .pt-void');
    // La HACHURE de la carte du bandeau : c'est elle qui passait au travers d'une alvéole translucide.
    const hachure = colorsIn(decl(ruleOf(HUD_BASE, '.party-dock .ptile-wrap'), 'background')!);
    const fondVide = colorsIn(decl(vide, 'background')!);
    for (const c of fondVide) expect(c[3]).toBe(1);
    const ratioVide = worst(parseColor(decl(vide, 'border-color')!), fondVide);
    expect(ratioVide).toBeGreaterThanOrEqual(3);
    // Alvéole PORTÉE : filet plus présent que celui du vide (hiérarchie vide < plein).
    const fondPlein = colorsIn(decl(alv, 'background')!).flatMap((c) => hachure.map((h) => over(c, h)));
    const ratioPlein = worst(borderColorOf(alv), fondPlein);
    expect(ratioPlein).toBeGreaterThanOrEqual(3);
    expect(ratioPlein).toBeGreaterThan(ratioVide);
  });

  // C-1 : à 360 le portrait de l'arche n'avait PAS DE VISAGE — la BOÎTE rétrécit (style inline de la
  // primitive repris à la main), le DESSIN restait à 72px et se cadrait « slice » sur son coin.
  it('C-1 — toute boîte de portrait redimensionnée remet son dessin à l’échelle', () => {
    const at560 = mediaBlock(CC_CSS, '@media (max-width: 560px)');
    expect(at560).toMatch(/\.cc-arch \.rig-portrait\s*\{[^}]*width:\s*30px/);
    const svg = ruleOf(CC_BASE, '.cc-arch .rig-portrait > svg');
    expect(decl(svg, 'width')).toBe('100%');
    expect(decl(svg, 'height')).toBe('100%');
  });

  // C-2 : anneau de camp + contour d'équipe concentriques = « cadre dans un cadre » (doctrine FigTile).
  it('C-2 — UN SEUL anneau de camp sur le portrait de l’arche', () => {
    const dessin = ruleOf(CC_BASE, '.cc-arch .ptile-face .rig-portrait');
    expect(decl(dessin, 'border-width')).toBe('0');
    expect(CC_CSS).not.toMatch(/\.cc-arch \.rig-portrait\s*\{[^}]*border-style/);
    // … et c'est bien la tuile qui porte le camp, une seule fois, dans le DOM monté.
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h, { foes: [foe('e1', 9, 9)] });
    const arch = host.querySelector('.cc-arch')!;
    expect(arch.querySelectorAll('.team-ally, .team-enemy').length).toBe(1);
    expect(arch.querySelector('.ptile')!.classList.contains('team-ally')).toBe(true);
    monter(h, { foes: [foe('e1', 9, 9)], turn: 1 });
    expect(host.querySelector('.cc-arch .ptile')!.classList.contains('team-enemy')).toBe(true);
  });

  // C-4 (R-M2) : « Mouve… », « Déter… » + « 3 » orphelin à 360 — la boîte à deux lignes ne pose son
  // ellipse que sur la DERNIÈRE ; un mot plus large que l'alvéole était tranché EN PLEIN GLYPHE.
  it('C-4 — le libellé d’alvéole s’ellipse, jamais coupé dans un mot', () => {
    const at560 = mediaBlock(CC_CSS, '@media (max-width: 560px)');
    const lbl = ruleOf(at560, '.cc-lbl');
    expect(decl(lbl, 'white-space')).toBe('nowrap');
    expect(decl(lbl, 'text-overflow')).toBe('ellipsis');
    // Une seule ligne : le moteur pose alors l'ellipse à la frontière d'un glyphe, jamais dedans.
    expect(decl(lbl, 'max-height')).toBe('1.1em');
    // … et JAMAIS par la casse d'un mot (R-M2), sur aucun libellé de la console.
    expect(CC_CSS).not.toMatch(/overflow-wrap:\s*(anywhere|break-word)/);
    expect(CC_CSS).not.toMatch(/word-break:\s*break-all/);
    // Le libellé complet reste au `title` de l'alvéole : c'est la console qui le pose.
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const cases = [...host.querySelectorAll('.cc-grid-right .cc-cell')].filter((c) => c.querySelector('.cc-lbl'));
    expect(cases.length).toBeGreaterThan(0);
    for (const cell of cases) expect(cell.getAttribute('title')).toBeTruthy();
  });
});

// ── ASSEMBLAGE : LA CONSOLE EST UN OBJET (spec §1c-ter) ─────────────────────────────────────────
// Arbitrage user 2026-08-17 (verbatim) : « Tu garde le même défaut remonte que la maquette était
// sensé mettre en évidence: tes blocs sont tous déconnecté ». Le défaut ne vit pas DANS les zones,
// il vit ENTRE elles — d'où trois contrats de STRUCTURE, jugés sur le DOM monté et sur les boîtes
// déclarées (la sonde pixel « aucun terrain sous le bord haut du pont » reste au juge de recette).
describe('CombatConsole — assemblage : UN PONT, pas des blocs', () => {
  it('P-1 — UN élément-pont unique, de bord à bord, porte les QUATRE régions de console', () => {
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const ponts = host.querySelectorAll('.combat-console');
    expect(ponts.length).toBe(1);
    const pont = ponts[0];
    // La console n'a plus rien à côté d'elle : les quatre régions sont DEDANS.
    expect([...host.children]).toEqual([pont]);
    for (const zone of ['.cc-bay-left', '.cc-arch', '.cc-bay-right', '.cc-corner']) {
      const el = host.querySelector(zone);
      expect(el, `région ${zone} absente`).not.toBeNull();
      expect(pont.contains(el!) && el !== pont, `région ${zone} hors du pont`).toBe(true);
    }
    // … et la bande va d'un bord à l'autre, opaque : entre deux régions il y a du PONT, jamais du
    // terrain (c'est ce que la sonde pixel de recette mesure à l'écran).
    const bande = ruleOf(CC_BASE, '.combat-console');
    for (const cote of ['left', 'right', 'bottom']) expect(parseFloat(decl(bande, cote)!), cote).toBe(0);
    expect(decl(bande, 'background-image')).toMatch(/linear-gradient/);
    expect(parseColor(decl(bande, 'background-color')!)[3]).toBe(1);
    // LISERÉ HAUT continu (planche : `[0,873,1920,8]`) — porté par la bande elle-même, donc entier.
    expect(decl(bande, 'border-top')).toBeTruthy();
  });

  it('P-2 — le bandeau de phase est SUPERPOSÉ : le pont a le même flux avec et sans lui', () => {
    // #1349 : en flux, `.cc-phase` comprimait la console de 17px au tour de l'ennemi.
    const phase = ruleOf(CC_BASE, '.cc-phase');
    expect(decl(phase, 'position')).toBe('absolute');
    expect(decl(phase, 'bottom')).toBeTruthy();
    // Ce que le pont MESURE, ce sont ses enfants EN FLUX : un enfant déclaré absolu n'en est pas.
    const enFlux = () =>
      [...host.querySelector('.combat-console')!.children]
        .filter((el) => !(el.classList.contains('cc-phase') && decl(phase, 'position') === 'absolute'))
        .map((el) => el.className);

    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    const e = foe('e1', 9, 9);
    monter(h, { foes: [e] });
    expect(host.querySelectorAll('.cc-phase').length).toBe(0);
    const auHeros = enFlux();
    const casesHeros = host.querySelectorAll('.cc-cell').length;

    monter(h, { foes: [e], turn: 1 });
    expect(host.querySelectorAll('.cc-phase').length).toBe(1);
    expect(enFlux()).toEqual(auHeros);
    // … et la géométrie ne perd pas une case au passage (loi 1).
    expect(host.querySelectorAll('.cc-cell').length).toBe(casesHeros);
    // La hauteur du pont ne dépend pas non plus de l'ACTEUR : la rangée du matériel n'est montée
    // que si l'acteur a de quoi commuter (mesuré à l'écran : 219,3 → 202,3px de pont quand le Loup
    // prenait la main), d'où un PLANCHER déclaré sur la travée, keyé sur le côté d'alvéole.
    const plancher = decl(ruleOf(CC_BASE, '.cc-bay-left'), 'min-height');
    expect(plancher, 'la travée gauche ne déclare AUCUN plancher de hauteur').toBeTruthy();
    expect(plancher!).toMatch(/var\(--cc-cell\)/);
    expect(host.querySelectorAll('.cc-loadouts').length).toBeLessThanOrEqual(1);
  });

  it('P-3 — l’arche est le FRONTON du pont : même matière, aucune couture, DANS le pont', () => {
    const bande = ruleOf(CC_BASE, '.combat-console');
    const arche = ruleOf(CC_BASE, '.cc-arch');
    // Même nappe, ancrée au BAS des deux boîtes : de part et d'autre de la jonction, le bois a la
    // même teinte — il n'y a donc aucune couture à voir.
    for (const p of ['background-image', 'background-size', 'background-position', 'background-color']) {
      expect(decl(arche, p), p).toBe(decl(bande, p));
    }
    expect(decl(bande, 'background-position')).toBe('bottom');
    // Aucun filet à la jonction : ni bordure basse, ni bordure de flanc (seul le liseré haut reste).
    expect(decl(arche, 'border')).toBe('0');
    expect(decl(arche, 'border-top')).toBe(decl(bande, 'border-top'));
    // Elle S'ÉLÈVE au-dessus du liseré au lieu d'être posée devant (planche : 811 vs 863).
    expect(decl(arche, 'margin-top')).toBe('calc(-1 * var(--cc-fronton))');
    expect(parseFloat(decl(bande, '--cc-fronton')!)).toBeGreaterThan(0);
    // … et structurellement, elle est DANS le pont, jamais une soeur flottante.
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    const pont = host.querySelector('.combat-console')!;
    const a = host.querySelector('.cc-arch')!;
    expect(pont.contains(a)).toBe(true);
    expect(a.parentElement!.closest('.combat-console')).toBe(pont);
  });

  // ── P-4 : LE FRONTON EST CENTRÉ SUR LE VIEWPORT (planche 2026-08-17 : arche `[781,811,357,269]`,
  //    centre x = 959,5 pour 1920 — centré au pixel MALGRÉ des travées de largeurs inégales).
  //    Mesuré avant cette passe : −79px à 1280, −87px à 1920.
  //    ALGÈBRE du modèle déclaré (c'est elle que ce contrat verrouille) : le pont pose quatre
  //    colonnes — voie gauche (1fr) · fronton (auto) · voie droite (1fr) · coin (auto) — séparées de
  //    trois écarts `g`, avec un rembourrage gauche `p`. Les deux voies valent `t` (mêmes `1fr`),
  //    d'où largeur = p + t + g + A + g + t + g + coin, et centre du fronton = p + t + g + A/2.
  //    Ce centre vaut la moitié de la largeur SI ET SEULEMENT SI p = coin + g — quelle que soit la
  //    largeur d'écran, la taille d'alvéole ou celle de l'arche. Le contrat est donc cette identité,
  //    exprimée dans les MÊMES tokens (un littéral recopié dériverait au premier réglage du coin).
  it('P-4 — le fronton est centré : deux voies `1fr` égales + réserve MIROIR du coin', () => {
    const dock = ruleOf(CC_BASE, '.cc-dock');
    const cols = decl(dock, 'grid-template-columns')!;
    // Deux voies `1fr` (donc de MÊME largeur) qui encadrent le fronton, et le coin en 4ᵉ colonne.
    expect(cols.match(/1fr/g)?.length, `voies du pont : « ${cols} »`).toBe(2);
    expect(cols.split(/\s+(?![^(]*\))/).length).toBe(4);
    // La réserve miroir vaut EXACTEMENT le coin + un écart de région — l'identité p = coin + g.
    expect(norm(decl(dock, 'padding-left')!)).toBe('calc(var(--cc-corner) + var(--cc-bay-gap))');
    // … et le coin tire sa largeur du MÊME token : la réserve ne peut pas se désynchroniser de lui.
    expect(decl(ruleOf(CC_BASE, '.cc-end'), 'width')).toBe('var(--cc-corner)');
    expect(parseFloat(decl(ruleOf(CC_BASE, ':root'), '--cc-corner')!)).toBeGreaterThan(0);
    // Chaque travée se range CONTRE le fronton (le surplus de sa voie va au bord, pas au milieu).
    expect(decl(ruleOf(CC_BASE, '.cc-bay-left'), 'justify-self')).toBe('end');
    expect(decl(ruleOf(CC_BASE, '.cc-bay-right'), 'justify-self')).toBe('start');
    // … et les quatre régions sont bien les quatre colonnes, dans cet ordre, dans le DOM monté.
    const h = hero('h1', 'Gunnar');
    h.conditions = [];
    monter(h);
    expect([...host.querySelector('.cc-dock')!.children].map((el) => el.className.split(' ').pop())).toEqual([
      'cc-bay-left', 'cc-arch', 'cc-bay-right', 'cc-corner',
    ]);
  });

  // ── P-5 : LE FIL DE COMBAT descend BAS-GAUCHE, en texte NU sur le terrain, juste au-dessus du
  //    pont (planche 2026-08-17 : journal `[170,779,330,57]`, aucun cadre, aligné à gauche). Il
  //    était en haut-centre, en pastilles cadrées (`top: 136px; left: 50%`).
  it('P-5 — le fil de combat est ancré bas-gauche sur la réserve du pont, en lignes NUES', () => {
    const feed = ruleOf(MODALS_BASE, '.combat-feed');
    expect(decl(feed, 'top')).toBe('auto');
    expect(decl(feed, 'transform')).toBe('none');
    // Ancré au BAS, et sa réserve est la hauteur du pont elle-même (jamais un nombre recopié).
    expect(decl(feed, 'bottom')).toMatch(/var\(--cc-deck-h\)/);
    // … à GAUCHE : une valeur en px depuis le bord, jamais un centrage.
    expect(decl(feed, 'left')).toMatch(/^\d+(\.\d+)?px$/);
    expect(decl(feed, 'align-items')).toBe('flex-start');
    // Lignes NUES : plus de carte (fond, filet, arrondi, rembourrage) — la lisibilité tient à l'ombre.
    const ev = ruleOf(MODALS_BASE, '.cb-ev');
    expect(decl(ev, 'background')).toBe('none');
    expect(parseFloat(decl(ev, 'border')!)).toBe(0);
    expect(decl(ev, 'text-shadow')).toBeTruthy();
    // Le ton se porte à l'ENCRE (plus de liseré ni de fond à teinter).
    for (const ton of ['.cb-tone-strong', '.cb-tone-grave']) {
      const bloc = ruleOf(MODALS_BASE, ton);
      expect(decl(bloc, 'color'), ton).toBeTruthy();
      expect(decl(bloc, 'background'), ton).toBeNull();
    }
  });

  // ── P-6 : LA FRISE ne déborde pas sur le pont (planche 2026-08-17 : plaque `[0,132,133,472]`,
  //    terminée nettement au-dessus du pont à y=863). Mesuré avant cette passe : 103,6 × 97,3px de
  //    recouvrement à 1280, points de frise par-dessus le pont au hit-test.
  it('P-6 — la frise borne sa hauteur à l’espace AU-DESSUS du pont, à la source', () => {
    // La hauteur du pont est une grandeur PUBLIÉE au `:root`, dérivée du seul côté d'alvéole.
    const racine = ruleOf(CC_BASE, ':root');
    expect(decl(racine, '--cc-deck-h')).toMatch(/var\(--cc-cell\)/);
    // La colonne vit dans la BANDE DE TERRAIN : ancrée sous le coin du menu, elle S'ARRÊTE sur la
    // réserve du pont — c'est son bord BAS qui est borné, pas seulement sa hauteur.
    const strip = ruleOf(HUD_BASE, '.initiative-strip');
    expect(decl(strip, 'bottom')).toMatch(/var\(--cc-deck-h\)/);
    expect(parseFloat(decl(strip, 'top')!)).toBeGreaterThanOrEqual(44);
    // La PISTE aussi : au-delà elle défile (aucune entrée ne disparaît, rien ne dépasse sur le pont).
    const tiles = ruleOf(HUD_BASE, '.is-tiles');
    expect(decl(tiles, '--is-avail')).toMatch(/var\(--cc-deck-h\)/);
    expect(decl(tiles, 'max-height')).toMatch(/--is-avail/);
    expect(decl(tiles, 'overflow-y')).toBe('auto');
  });
});
