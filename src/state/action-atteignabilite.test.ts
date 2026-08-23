/**
 * LES DEUX GARDES DU REGISTRE DES ACTIONS (spec HUD « Zone 12 », sondes du juge promues).
 *
 *  (a) ATTEIGNABILITÉ — toute action déclarée dans `actions.json` a une SURFACE VIVANTE : une case
 *      de la console (par son id, ou par une clé de surface encore forkée), ou une touche du
 *      registre clavier. Ce qui n'en a pas est nommé dans `SANS_SURFACE`.
 *  (b) RÉCIPROQUE, FAIL-CLOSED — tout id de case d'action rendu par `CombatConsole.tsx` est DÉCLARÉ
 *      au registre. ZÉRO exemption : sans elle, la classe « action perdue » se reforme à la première
 *      case manuscrite.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * `SANS_SURFACE` EST UN ÉCHAFAUDAGE DE CHANTIER, PAS UNE ABSOLUTION (posé le 2026-08-17).
 *   • CIBLE : `{}` — zéro entrée.
 *   • ÉCHÉANCE : le LOT BRANCHEMENTS de ce même chantier (spec zone 12, ordre des lots (2)) —
 *     jamais « plus tard ». Chaque lot en retire des lignes.
 *   • CLIQUET STRICT DÉCROISSANT (patron `raw-blind-refs-baseline`) : une action nouvellement sans
 *     surface qui n'est pas listée = ROUGE ; une entrée listée qui a retrouvé sa surface = ROUGE
 *     « périmée » (elle se retire dans le MÊME commit que le branchement).
 *   • RÉGIME PERMANENT — le marqueur `CHANTIER_BRANCHEMENTS_OUVERT` ferme la boucle : la baseline
 *     ne peut porter des entrées QUE tant qu'il vaut `true`, et il DOIT passer à `false` dès
 *     qu'elle est vide. Baseline vidée + marqueur éteint = toute ré-addition future est ROUGE,
 *     par construction, sans relecture humaine.
 *   • FUSION : le portage de ce worktree vers `main` exige `SANS_SURFACE = {}` ET
 *     `CHANTIER_BRANCHEMENTS_OUVERT = false` — aucun stock gelé n'atteint le tronc.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from '../data/index';
import { ACTION_GATES, ACTION_CANDIDATES, ACTION_RUN, MODES_HORS_REGISTRE, BATTLE_ACTION_MODES, actionGate, runAction } from './actionRegistry';
import { TARGETING_MODES, targetingModeLabel } from './targetingModes';
import { KEYBINDINGS } from './keybindings';
import { useGame, type BattleState } from './store';
import { emptyScene } from './scene';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const CONSOLE_SRC = src('../ui/CombatConsole.tsx');
const TARGETING_SRC = src('./targetingModes.ts');

/** Le chantier des BRANCHEMENTS est-il ouvert ? Voir l'en-tête : `false` verrouille la baseline à vide. */
const CHANTIER_BRANCHEMENTS_OUVERT = true;

/** Actions SANS surface vivante — nominatif, DÉCROISSANT, cible `{}` (voir en-tête). */
const SANS_SURFACE: Record<string, string> = {
  cast: 'le mode disparaît comme slot : alvéoles de sorts + grimoire (spec §1d).',
  'focus-spell': 'affordance secondaire de l’alvéole du sort (spec §1d).',
  mount: 'pastille sur la MONTURE (zone 4, tranché 2026-08-16).',
  'man-poste': 'pastille sur la PIÈCE (zone 4).',
  'push-engine': 'pastille sur la PIÈCE (zone 4).',
  pickup: 'pastille ⓘ de l’objet au sol (zone 4).',
  'raise-hand': 'passe à la FRISE (spec §1d).',
};

/** Clés littérales d'un motif `key:`/`id:` — une clé TEMPLATE se réduit à son préfixe littéral. */
function keysFrom(source: string, re: RegExp): string[] {
  return [...source.matchAll(re)].map((m) => m[1] ?? m[2]).filter((k): k is string => !!k);
}

/** Actions RENDUES par la console : elle ne déclare plus de cases à la main, elle CONSOMME le
 *  registre — une case naît d'un appel `cellFor('<id d'action>', …)`. On lit donc les ids d'action au
 *  site d'appel (+ le `data-cell="…"` littéral du coin de fin de tour, qui n'est pas une alvéole). */
const CONSOLE_KEYS = [
  ...keysFrom(CONSOLE_SRC, /cellFor\(\s*'([^']+)'()/g),
  ...keysFrom(CONSOLE_SRC, /data-action="([^"]+)"()/g),
];
const KEYBINDING_IDS = KEYBINDINGS.map((b) => b.id);

/** Le bandeau de phase de la console consomme-t-il les actions d'INTERLUDE ? Elles n'ont pas de case
 *  nommée (le bandeau les rend depuis le registre, par le mode de ciblage courant) : leur surface est
 *  donc CE branchement. Il est lu sur la SOURCE, faute d'ancrage structurel ici — ce fichier tourne en
 *  environnement `node` (aucun DOM), et la seule preuve structurelle possible est de MONTER la console,
 *  ce que fait déjà `CombatConsole.test.tsx` (bandeau d'interlude : `.cc-phase [data-action=…]` rendu,
 *  cliqué, effet mesuré). Débrancher le bandeau y vire donc rouge ; ici, la lecture ne sert qu'à
 *  n'attribuer une surface aux interludes que tant que le pont existe. */
const INTERLUDE_BRANCHE = /currentInterludeAction/.test(CONSOLE_SRC);
const INTERLUDE_KEYS = INTERLUDE_BRANCHE ? ACTIONS.filter((a) => a.surface === 'interlude').map((a) => a.id) : [];

/** Surfaces VIVANTES : la console, le bandeau d'interlude qu'elle rend, et le registre clavier. */
const SURFACES_VIVANTES = new Set([...CONSOLE_KEYS, ...INTERLUDE_KEYS, ...KEYBINDING_IDS]);

/** Les clés qu'une action revendique : son id + ses clés de surface encore forkées. */
const claimedKeys = (a: (typeof ACTIONS)[number]) => [a.id, ...(a.keys ?? [])];

describe('registre des actions — cohérence interne (ids de code résolus)', () => {
  it('chaque `gate` déclaré existe dans ACTION_GATES (un id, ou chacun des ids composés)', () => {
    const bad = ACTIONS.filter((a) => [a.gate].flat().some((g) => !(g in ACTION_GATES))).map((a) => `${a.id} → ${a.gate}`);
    expect(bad, `gate(s) inconnu(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('chaque `candidates` déclaré existe dans ACTION_CANDIDATES', () => {
    const bad = ACTIONS.filter((a) => a.candidates && !(a.candidates in ACTION_CANDIDATES)).map((a) => `${a.id} → ${a.candidates}`);
    expect(bad, `sélecteur(s) inconnu(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('chaque `run` déclaré existe dans ACTION_RUN', () => {
    const bad = ACTIONS.filter((a) => a.run && !(a.run in ACTION_RUN)).map((a) => `${a.id} → ${a.run}`);
    expect(bad, `dispatcher(s) inconnu(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('chaque `mode` déclaré est un TargetingMode existant (`targetingModes.ts`)', () => {
    const bad = ACTIONS.filter((a) => a.mode && !TARGETING_SRC.includes(`id: '${a.mode}'`)).map((a) => `${a.id} → ${a.mode}`);
    expect(bad, `mode(s) de ciblage inexistant(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('PARITÉ INVERSE — tout mode de ciblage a une action PORTEUSE au registre (aucun mode sans surface)', () => {
    // Méta d'abord : le catalogue énumérable doit couvrir les modes DÉCLARÉS dans la source (un mode
    // oublié au catalogue rendrait la parité verte à tort).
    const idsSource = [...new Set([...TARGETING_SRC.matchAll(/^\s*id: '([a-z-]+)'/gm)].map((m) => m[1]))];
    const horsCatalogue = idsSource.filter((id) => !TARGETING_MODES.some((m) => m.id === id));
    expect(horsCatalogue, `mode(s) déclaré(s) mais absent(s) de TARGETING_MODES :\n  ${horsCatalogue.join('\n  ')}`).toEqual([]);
    // Parité : un mode que le joueur peut atteindre sans action porteuse est un ciblage SANS SORTIE.
    const orphelins = TARGETING_MODES.filter((m) => !ACTIONS.some((a) => a.mode === m.id)).map((m) => m.id);
    expect(
      orphelins,
      `mode(s) de ciblage qu'aucune action ne porte (armer/sortir ce mode n'a aucune surface) :\n  ${orphelins.join('\n  ')}`,
    ).toEqual([]);
  });
  it('un mode d’INTERLUDE porte son nom de phase, et sa sortie dit si Échap peut la prendre', () => {
    const interludes = ACTIONS.filter((a) => a.surface === 'interlude');
    expect(interludes.length, 'aucune action d’interlude : le bandeau n’aurait rien à rendre').toBeGreaterThan(0);
    const muets = interludes.filter((a) => !a.mode || !targetingModeLabel(a.mode)).map((a) => a.id);
    expect(muets, `interlude(s) dont le mode n'a pas de libellé de phase :\n  ${muets.join('\n  ')}`).toEqual([]);
    const sansVerdict = interludes.filter((a) => typeof a.exitSafe !== 'boolean').map((a) => a.id);
    expect(sansVerdict, `interlude(s) sans verdict exitSafe :\n  ${sansVerdict.join('\n  ')}`).toEqual([]);
  });
  it('chaque action rend un VERDICT sur un état réel (aucun gate ne jette, aucune raison muette)', () => {
    const active = {
      id: 'H', kind: 'hero', advantage: 0, conditions: [], wounds: { current: 10, max: 10 },
      weapons: [], items: [], skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 },
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    } as unknown as Parameters<typeof actionGate>[1]['active'];
    const battle = {
      combatants: [active], order: ['H'], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as Parameters<typeof actionGate>[1]['battle'];
    const muets = ACTIONS.filter((a) => {
      const v = actionGate(a.id, { active, battle });
      return typeof v.ok !== 'boolean' || (!v.ok && !v.reason);
    }).map((a) => a.id);
    expect(muets, `Action(s) dont le gate ne rend pas un verdict motivé :\n  ${muets.join('\n  ')}`).toEqual([]);
    // Fail-closed : un id inconnu ne « passe » jamais.
    expect(actionGate('id-inexistant', { active, battle }).ok).toBe(false);
  });
  it('`BattleState.action` se type DEPUIS le registre : `armed` + MODES_HORS_REGISTRE = BATTLE_ACTION_MODES', () => {
    const derives = new Set([
      ...ACTIONS.flatMap((a) => (a.armed ? [a.armed] : [])),
      ...Object.keys(MODES_HORS_REGISTRE),
    ]);
    expect([...derives].sort()).toEqual([...BATTLE_ACTION_MODES].sort());
  });
});

describe('(a) atteignabilité — toute action du registre a une surface vivante', () => {
  const sansSurface = ACTIONS.filter((a) => !claimedKeys(a).some((k) => SURFACES_VIVANTES.has(k))).map((a) => a.id);

  it('aucune action NOUVELLEMENT sans surface (cliquet : la liste ne remonte jamais)', () => {
    const nouvelles = sansSurface.filter((id) => !(id in SANS_SURFACE));
    expect(
      nouvelles,
      `Action(s) sans case, sans pastille et sans touche — brancher une surface, ou (si c'est un lot ultérieur) l'inscrire nominativement dans SANS_SURFACE :\n  ${nouvelles.join('\n  ')}`,
    ).toEqual([]);
  });

  it('aucune entrée PÉRIMÉE : une action qui a retrouvé sa surface quitte la baseline', () => {
    const perimees = Object.keys(SANS_SURFACE).filter((id) => !sansSurface.includes(id));
    expect(
      perimees,
      `Entrée(s) de SANS_SURFACE devenue(s) fausse(s) (action branchée, ou id disparu du registre) — les retirer :\n  ${perimees.join('\n  ')}`,
    ).toEqual([]);
  });

  it('chaque entrée de la baseline porte SA raison et SON adresse de destination', () => {
    const muettes = Object.entries(SANS_SURFACE).filter(([, r]) => !r || r.trim().length < 15).map(([id]) => id);
    expect(muettes, `Entrée(s) sans adresse de destination :\n  ${muettes.join('\n  ')}`).toEqual([]);
  });

  it('RÉGIME PERMANENT : la baseline n’a d’entrées que chantier OUVERT, et s’éteint avec lui', () => {
    const n = Object.keys(SANS_SURFACE).length;
    if (n > 0) {
      expect(
        CHANTIER_BRANCHEMENTS_OUVERT,
        `${n} action(s) sans surface alors que le chantier des branchements est déclaré CLOS : plus aucun stock gelé n'est recevable — brancher, ou rouvrir le chantier explicitement.`,
      ).toBe(true);
    } else {
      expect(
        CHANTIER_BRANCHEMENTS_OUVERT,
        'baseline VIDE : éteindre `CHANTIER_BRANCHEMENTS_OUVERT` (le verrou passe en régime permanent — toute ré-addition devient rouge).',
      ).toBe(false);
    }
  });
});

describe('(b) réciproque fail-closed — aucune case d’action hors registre', () => {
  const declared = new Set(ACTIONS.flatMap(claimedKeys));

  it('toute case d’action de CombatConsole est déclarée au registre', () => {
    const orphelines = [...new Set(CONSOLE_KEYS)].filter((k) => !declared.has(k));
    expect(
      orphelines,
      `Case(s) de console inconnue(s) du registre (déclarer l'action dans src/data/actions.json — aucune exemption) :\n  ${orphelines.join('\n  ')}`,
    ).toEqual([]);
  });

  it('méta — l’extracteur voit bien des clés (une regex muette rendrait la garde verte à tort)', () => {
    expect(CONSOLE_KEYS.length).toBeGreaterThan(10);
  });
});

/**
 * POURQUOI CHAQUE INTERLUDE PORTE SON PROPRE DISPATCHER (#1411 P0-B) — les sorties ne sont pas
 * interchangeables : `battleSelectAction` (sortie de la bordée) est AVALÉ sous un flux différé
 * (`combatBusy`, `combatSlice.ts:2875`), là où `cleaveEnd`/`dualStrikeSkip` sont justement les verbes
 * DE ces flux. Un dispatcher mutualisé rendrait la sortie muette dès qu'un flux se superpose. Le
 * témoin POSITIF (sans flux, la sortie mord) borne la mesure.
 */
describe('sorties d’interlude — le dispatcher mutualisé est inexprimable (témoin mesuré)', () => {
  /** Combat minimal réel : un héros ACTIF, une scène, le mode de bordée armé. */
  function combatArme(over: Partial<BattleState> = {}) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', rng: makeRNG(7) });
    h.id = 'h1';
    h.pos = { x: 5, y: 5 };
    useGame.setState({
      party: [h], scene: emptyScene(), pendingCleave: null, pendingDualStrike: null, pendingCast: null,
      battle: {
        combatants: [h], order: [h.id], baseOrder: [h.id], turn: 0, round: 1, action: 'battery',
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false,
        log: [], over: null, ...over,
      } as unknown as BattleState,
    });
    return h;
  }

  afterEach(() => { useGame.setState({ battle: null, pendingCleave: null }); });

  it('TÉMOIN — sans flux différé, la sortie de bordée désarme bien le mode', () => {
    combatArme();
    runAction('battery-cancel', useGame.getState);
    expect(useGame.getState().battle!.action).toBeNull();
  });

  it('MESURE — sous un flux différé, la MÊME sortie est avalée (donc jamais partagée avec cleave/dual)', () => {
    const h = combatArme();
    useGame.setState({ pendingCleave: { attackerId: h.id, hitIds: [], count: 0 } as never });
    runAction('battery-cancel', useGame.getState);
    expect(
      useGame.getState().battle!.action,
      'la sortie de bordée est avalée sous `combatBusy` — c’est pourquoi cleave/dual portent leurs propres verbes',
    ).toBe('battery');
    // … et le verbe DE ce flux, lui, passe : chaque interlude sort par SON dispatcher.
    runAction('cleave-end', useGame.getState);
    expect(useGame.getState().pendingCleave).toBeNull();
  });
});
