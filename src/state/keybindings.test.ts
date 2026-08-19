/**
 * CONTEXTE des raccourcis pendant un CIBLAGE PAR LA CARTE (désignation des cibles d'un sort) : la
 * souris cible, donc le curseur clavier/manette doit cibler aussi. Le registre distingue deux
 * gardes : la CARTE (verdict de l'arbitre `modalBlocksMapHover` — une modale pilotée par la carte
 * laisse la scène vivante) et le PILOTAGE hors-carte (fin de tour, barre d'action, menu système),
 * qui exige qu'aucune modale ne soit ouverte. Sans cette distinction, `pickActiveModalKey != null`
 * rendait TOUT le clavier muet pendant que la souris continuait de cibler.
 */
import { describe, it, expect, vi } from 'vitest';
import { KEYBINDINGS } from './keybindings';
import type { GameState } from './store';

const binding = (id: string) => KEYBINDINGS.find((k) => k.id === id)!;

/** État minimal : combat en cours, écran de jeu, aucun pending — les cas posent le leur. */
const fake = (over: Partial<GameState> = {}): GameState =>
  ({
    mode: 'battle', screen: 'campaign', gameMenuOpen: false,
    battle: { over: null, order: [], turn: 0, combatants: [] },
    net: { mode: 'local', mySeat: 0, gmSeat: null, ownership: {} },
    ...over,
  }) as never;

/** Cascade d'incantation dont l'étape courante DÉSIGNE ses cibles sur la carte (`pickingTargets`). */
const cartePilote = (over: Partial<GameState> = {}) =>
  fake({
    pendingCascade: { participants: [{ actorId: 'h1' }], cursor: 0 } as never,
    pendingCast: { casterId: 'h1', pickingTargets: true } as never,
    ...over,
  });

/** Cascade ORDINAIRE (révélation) : elle bloque la carte — clavier ET souris se taisent. */
const cascadeBloquante = (over: Partial<GameState> = {}) =>
  fake({ pendingCascade: { participants: [{ actorId: 'h1' }], cursor: 0 } as never, ...over });

const CURSEUR = ['cursor-up', 'cursor-down', 'cursor-left', 'cursor-right'];

describe('raccourcis — le CURSEUR vit tant que la carte cible', () => {
  it('hors modale : le curseur répond (référence)', () => {
    for (const id of CURSEUR) expect(binding(id).when(fake()), id).toBe(true);
  });

  it('ciblage de sort PAR LA CARTE : le curseur clavier/manette RESTE vivant, comme la souris', () => {
    for (const id of CURSEUR) expect(binding(id).when(cartePilote()), id).toBe(true);
  });

  it('ciblage de sort PAR LA CARTE : Entrée commet le ciblage sous le curseur', () => {
    expect(binding('cursor-commit').when(cartePilote({ combatCursor: { tile: { x: 1, y: 1 } } as never }))).toBe(true);
  });

  it('cascade ORDINAIRE (carte inerte) : le curseur est MORT', () => {
    for (const id of CURSEUR) expect(binding(id).when(cascadeBloquante()), id).toBe(false);
    expect(binding('cursor-commit').when(cascadeBloquante({ combatCursor: { tile: { x: 1, y: 1 } } as never }))).toBe(false);
  });
});

describe('raccourcis — les gestes qui ENGAGENT ou QUITTENT restent gardés par la modale', () => {
  it('pendant le ciblage par la carte : ni fin de tour, ni barre d’action, ni menu système', () => {
    const s = cartePilote();
    expect(binding('end-turn').when(s), 'Espace finirait le tour au milieu d’une désignation de cibles').toBe(false);
    expect(binding('hotbar-1').when(s), 'une capacité de la barre ouvrirait un 2ᵉ flux par-dessus le sort').toBe(false);
    expect(binding('toggle-menu').when(s), 'Échap doit annuler le ciblage, pas ouvrir le menu système').toBe(false);
  });

  it('hors modale, ces mêmes gestes répondent (la garde n’est pas devenue muette)', () => {
    const s = fake();
    expect(binding('end-turn').when(s)).toBe(true);
    expect(binding('hotbar-1').when(s)).toBe(true);
    expect(binding('toggle-menu').when(s)).toBe(true);
  });
});

/**
 * COLLISIONS DE TOUCHES sur le registre ENTIER. Deux raccourcis peuvent légitimement partager un
 * `code` quand leurs `when` s'excluent (POV ⇄ vue iso, pause de Round ⇄ fin de tour ⇄ curseur, les
 * trois portes d'Échap) — mais le partage doit alors être DÉCLARÉ des deux côtés (`sharedBy`). Sans
 * cette garde, ajouter un raccourci sur une touche déjà prise est silencieux : l'ordre du tableau
 * décide, et le nouveau geste n'agit jamais (ou vole celui d'un autre).
 */
describe('raccourcis — aucune collision de touche NON DÉCLARÉE', () => {
  it('toute paire d’entrées partageant un code se nomme mutuellement dans `sharedBy`', () => {
    const parCode = new Map<string, string[]>();
    for (const b of KEYBINDINGS) for (const c of b.codes) parCode.set(c, [...(parCode.get(c) ?? []), b.id]);
    const byId = new Map(KEYBINDINGS.map((b) => [b.id, b]));
    const fautes: string[] = [];
    for (const [code, ids] of parCode) {
      for (const a of ids) for (const b of ids) {
        if (a === b) continue;
        if (!byId.get(a)?.sharedBy?.includes(b)) fautes.push(`${code} : « ${a} » ne déclare pas partager avec « ${b} »`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('`sharedBy` ne nomme que des ids EXISTANTS qui partagent réellement un code (pas une déclaration morte)', () => {
    const byId = new Map(KEYBINDINGS.map((b) => [b.id, b]));
    const fautes: string[] = [];
    for (const b of KEYBINDINGS) {
      for (const other of b.sharedBy ?? []) {
        const o = byId.get(other);
        if (!o) { fautes.push(`« ${b.id} » nomme « ${other} », absent du registre`); continue; }
        if (!o.codes.some((c) => b.codes.includes(c))) fautes.push(`« ${b.id} » et « ${other} » ne partagent aucun code`);
      }
    }
    expect(fautes).toEqual([]);
  });
});

/**
 * LA CAMÉRA SE PILOTE AU CLAVIER (et au geste) : la plaque de boutons a quitté l'écran de jeu
 * (spec `docs/plans/2026-08-16-spec-hud-combat.md`, zone 6). Les trois commandes
 * qu'elle portait encore seule — bascule de vue, inspection, recentrage — sont donc des raccourcis
 * du registre, et le recentrage remet AUSSI le zoom (la molette avance par incréments continus :
 * aucune suite de crans ne retombe sur 1, et plus aucun afficheur de zoom n'existe à l'écran).
 */
describe('raccourcis — les commandes de vue de l’ancienne plaque', () => {
  it('V bascule la vue sur l’écran de jeu, et se TAIT en vue subjective (le POV a sa propre bascule)', () => {
    const b = binding('toggle-view');
    expect(b.codes).toEqual(['KeyV']);
    expect(b.when(fake({ mode: 'exploration' }))).toBe(true);
    expect(b.when(fake())).toBe(true); // en combat aussi : la vue du dessus est tactique
    expect(b.when(fake({ povActive: true }))).toBe(false);
    expect(b.when(fake({ screen: 'party' }))).toBe(false);
    const toggleViewMode = vi.fn();
    b.run(() => ({ toggleViewMode }) as never);
    expect(toggleViewMode).toHaveBeenCalledOnce();
  });

  it('I commute l’inspection des combattants, en COMBAT seulement', () => {
    const b = binding('toggle-inspect');
    expect(b.codes).toEqual(['KeyI']);
    expect(b.when(fake())).toBe(true);
    expect(b.when(fake({ mode: 'exploration' }))).toBe(false);
    const toggleInspectEnabled = vi.fn();
    b.run(() => ({ toggleInspectEnabled }) as never);
    expect(toggleInspectEnabled).toHaveBeenCalledOnce();
  });

  it('C recentre HORS combat aussi, et remet le zoom à 100 %', () => {
    const b = binding('cam-recenter');
    expect(b.when(fake({ mode: 'exploration', battle: null }))).toBe(true);
    expect(b.when(fake({ screen: 'party' }))).toBe(false);
    const resetCamPan = vi.fn();
    const setZoom = vi.fn();
    b.run(() => ({ resetCamPan, setZoom }) as never);
    expect(resetCamPan).toHaveBeenCalledOnce();
    expect(setZoom).toHaveBeenCalledWith(1);
  });
});

/**
 * X FAIT TOURNER LES SETS (planche USER 2026-08-17, travée gauche de la console) : la colonne de sets
 * a absorbé le commutateur, et sa touche passe au set SUIVANT dans l'ordre où ils y sont dessinés.
 * Le plafond 1×/tour et les gates de contrôle restent au store (`battleSwitchLoadout`).
 */
describe('raccourcis — X commute le set d’armes', () => {
  /** Combat dont l'acteur ACTIF porte `sets` sets, celui d'`actif` au poing. */
  const avecSets = (sets: string[], actif: string, over: Partial<GameState> = {}) =>
    fake({
      battle: {
        over: null, turn: 0, order: ['h1'],
        combatants: [{ id: 'h1', kind: 'hero', label: 'Gunnar', loadouts: sets.map((id) => ({ id })), activeLoadoutId: actif }],
      } as never,
      ...over,
    });

  it('la touche est KeyX, muette sous DEUX sets, et fait tourner en boucle', () => {
    const b = binding('switch-loadout');
    expect(b.codes).toEqual(['KeyX']);
    // Un seul set (ou aucun) : rien à commuter — la touche ne s'applique pas.
    expect(b.when(avecSets(['lo-a'], 'lo-a'))).toBe(false);
    expect(b.when(fake())).toBe(false);
    expect(b.when(avecSets(['lo-a', 'lo-b'], 'lo-a'))).toBe(true);

    // Set SUIVANT dans l'ordre de la colonne…
    const s1 = avecSets(['lo-a', 'lo-b', 'lo-c'], 'lo-a');
    const switch1 = vi.fn();
    b.run(() => ({ ...s1, battleSwitchLoadout: switch1 }) as never);
    expect(switch1).toHaveBeenCalledWith('lo-b');
    // … et retour au PREMIER depuis le dernier (rotation, pas une file).
    const s2 = avecSets(['lo-a', 'lo-b', 'lo-c'], 'lo-c');
    const switch2 = vi.fn();
    b.run(() => ({ ...s2, battleSwitchLoadout: switch2 }) as never);
    expect(switch2).toHaveBeenCalledWith('lo-a');
  });

  it('se tait pendant un ciblage par la carte, comme les autres gestes qui ENGAGENT', () => {
    const s = avecSets(['lo-a', 'lo-b'], 'lo-a', {
      pendingCascade: { participants: [{ actorId: 'h1' }], cursor: 0 } as never,
      pendingCast: { casterId: 'h1', pickingTargets: true } as never,
    });
    expect(binding('switch-loadout').when(s)).toBe(false);
  });
});
