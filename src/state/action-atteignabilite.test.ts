/**
 * LES DEUX GARDES DU REGISTRE DES ACTIONS (spec HUD « Zone 12 », sondes du juge promues).
 *
 *  (a) ATTEIGNABILITÉ — toute action déclarée dans `actions.json` a une SURFACE VIVANTE : une case
 *      de la console (par son id, ou par une clé de surface encore forkée), ou une touche du
 *      registre clavier. Ce qui n'en a pas est nommé dans `SANS_SURFACE`.
 *  (b) RÉCIPROQUE, FAIL-CLOSED — tout id de slot/case d'action rendu par `CombatConsole.tsx` (et
 *      `ActionBar.tsx` tant qu'elle vit) est DÉCLARÉ au registre. ZÉRO exemption : sans elle, la
 *      classe « action perdue » se reforme au premier slot manuscrit.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * `SANS_SURFACE` EST UN ÉCHAFAUDAGE DE CHANTIER, PAS UNE ABSOLUTION (posé le 2026-08-17).
 *   • CIBLE : `{}` — zéro entrée.
 *   • ÉCHÉANCE : le LOT BRANCHEMENTS de ce même chantier (spec zone 12, ordre des lots (2)) —
 *     jamais « plus tard ». Chaque lot en retire des lignes ; la purge d'`ActionBar` (lot 3) est
 *     conditionnée à `SANS_SURFACE` vide.
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
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from '../data/index';
import { ACTION_GATES, ACTION_CANDIDATES, ACTION_RUN, MODES_HORS_REGISTRE, BATTLE_ACTION_MODES, actionGate } from './actionRegistry';
import { KEYBINDINGS } from './keybindings';

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const CONSOLE_SRC = src('../ui/CombatConsole.tsx');
const ACTIONBAR_SRC = src('../ui/ActionBar.tsx');
const TARGETING_SRC = src('./targetingModes.ts');

/** Le chantier des BRANCHEMENTS est-il ouvert ? Voir l'en-tête : `false` verrouille la baseline à vide. */
const CHANTIER_BRANCHEMENTS_OUVERT = true;

/** Actions SANS surface vivante — nominatif, DÉCROISSANT, cible `{}` (voir en-tête). */
const SANS_SURFACE: Record<string, string> = {
  ammo: 'tiroir munitions de la barre morte ; la console la rendra à l’en-tête de travée (spec §1a).',
  'select-ammo': 'choix de munition — même adresse que `ammo`.',
  cast: 'le mode disparaît comme slot : alvéoles de sorts + grimoire (spec §1d).',
  'focus-spell': 'affordance secondaire de l’alvéole du sort (spec §1d).',
  'dispel-spell': 'alvéole Dissiper + panneau-paramètre du porteur (spec §1d).',
  advantage: 'alvéoles par Compétence (spec §1d) — la case `advantage-<skill>` existe déjà, pas l’ouvreur.',
  attacks: 'tiroir d’attaques : il disparaît au profit de G1/G2 + grille (spec §1d).',
  'resolve-psych-immune': 'alvéole Détermination + pastilles (spec §1d).',
  'resolve-ignore-crit': 'alvéole Détermination + pastilles (spec §1d).',
  'resolve-remove-condition': 'remède porté par la pastille d’État (zone 3).',
  mount: 'pastille sur la MONTURE (zone 4, tranché 2026-08-16).',
  'man-poste': 'pastille sur la PIÈCE (zone 4).',
  'push-engine': 'pastille sur la PIÈCE (zone 4).',
  pickup: 'pastille ⓘ de l’objet au sol (zone 4).',
  battery: 'contenu NAVIRE de la console (zone 7) — reste un interlude.',
  'crew-test-rude-epreuve': 'contenu NAVIRE de la console (zone 7).',
  'sing-shanty': 'contenu NAVIRE de la console (zone 7).',
  'ship-reload': 'contenu NAVIRE de la console (zone 7).',
  'undo-move': 'adossée à la jauge de Mouvement de l’arche (spec §1c).',
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
/** Slots de la barre historique : `slots.push({ id: '…' })` (ou son template). */
const ACTIONBAR_KEYS = keysFrom(ACTIONBAR_SRC, /slots\.push\(\{\s*id:\s*(?:'([^']+)'|`([^`$]*)\$\{)/g);
const KEYBINDING_IDS = KEYBINDINGS.map((b) => b.id);

/** Surfaces VIVANTES (l'`ActionBar` n'en est PAS une : elle n'est plus montée, seuls ses tests tournent). */
const SURFACES_VIVANTES = new Set([...CONSOLE_KEYS, ...KEYBINDING_IDS]);

/** Les clés qu'une action revendique : son id + ses clés de surface encore forkées. */
const claimedKeys = (a: (typeof ACTIONS)[number]) => [a.id, ...(a.keys ?? [])];

describe('registre des actions — cohérence interne (ids de code résolus)', () => {
  it('chaque `gate` déclaré existe dans ACTION_GATES', () => {
    const bad = ACTIONS.filter((a) => !(a.gate in ACTION_GATES)).map((a) => `${a.id} → ${a.gate}`);
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

describe('(b) réciproque fail-closed — aucun slot/case d’action hors registre', () => {
  const declared = new Set(ACTIONS.flatMap(claimedKeys));

  it('toute case d’action de CombatConsole est déclarée au registre', () => {
    const orphelines = [...new Set(CONSOLE_KEYS)].filter((k) => !declared.has(k));
    expect(
      orphelines,
      `Case(s) de console inconnue(s) du registre (déclarer l'action dans src/data/actions.json — aucune exemption) :\n  ${orphelines.join('\n  ')}`,
    ).toEqual([]);
  });

  it('tout slot d’ActionBar est déclaré au registre (tant que la barre vit)', () => {
    const orphelins = [...new Set(ACTIONBAR_KEYS)].filter((k) => !declared.has(k));
    expect(
      orphelins,
      `Slot(s) de barre inconnu(s) du registre (déclarer l'action dans src/data/actions.json — aucune exemption) :\n  ${orphelins.join('\n  ')}`,
    ).toEqual([]);
  });

  it('méta — les deux extracteurs voient bien des clés (une regex muette rendrait la garde verte à tort)', () => {
    expect(CONSOLE_KEYS.length).toBeGreaterThan(10);
    expect(ACTIONBAR_KEYS.length).toBeGreaterThan(20);
  });
});
