import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou « un Test REMONTE à un humain vs se résout INLINE » — au CHOKE-POINT du prédicat de
 * contrôleur (`netOwnership`), pas par grep+whitelist. La décision de surfaçage suit QUI CONTRÔLE le
 * camp (`humanControlled`/`pilotedByHuman`/`aiDriven`), jamais le `kind`. Quatre volets :
 *  (a) STATIQUE minimal : le prédicat de cadence obsolète `roundTestInteractive` est supprimé, et chaque
 *      site de surfaçage connu référence le prédicat de contrôleur ;
 *  (b) BEHAVIORAL : un Test de combattant piloté-humain par contexte (défense, manœuvre, upkeep, psy,
 *      maladie/exposition, corruption, test déclenché) OUVRE un `pending*` influençable ;
 *  (c) FLIP LOCAL : poser le rôle MJ (`net.gmSeat`) fait REMONTER le Test déclenché d'un ennemi conduit
 *      (`actorId===enemyId`) ; le retirer (ou un héros `aiControlled`) le résout inline ;
 *  (d) GARDE-DU-GARDE : sous un stub qui re-silencie (`humanControlled → false`), le volet (b) DOIT échouer.
 */

// Ré-silençage RÉEL (volet d) : quand `silence` est vrai, on marque le combattant testé `aiControlled` —
// `pilotedByHuman`/`humanControlled` renvoient alors false PAR LE PRÉDICAT (pas un mock qui fuit sous
// `isolate:false`). Prouve que le plancher behavioral (b) DÉPEND du prédicat de contrôleur.
let silence = false;

import { useGame } from './store';
import './combatFlow'; // effet de bord : installe appliers de cascade + routeur de Test + hook onGainCondition
import { openRoundEndCascade, openCombatEndCascade, aiCreatureFreeAttacks, maybeOpenDefense, resolveAttack, attackerFumbled } from './combatFlow';
import { gainCorruption } from './corruptionFlow';
import { createHero } from '../engine/character';
import { buildWeapon } from '../engine/items';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import { addCondition, COND } from '../engine/conditions';

import { testScene } from '../scenes/test-fixture';
import { resetCadence } from '../engine/cadence';

const get = useGame.getState;
const set = useGame.setState;

// ── Volet (a) — statique minimal ────────────────────────────────────────────────────────────────
const here = (f: string) => fileURLToPath(new URL(f, import.meta.url));
const SRC: Record<string, string> = {
  combatFlow: readFileSync(here('./combatFlow.ts'), 'utf8'),
  combatManeuvers: readFileSync(here('./combatManeuvers.ts'), 'utf8'),
  corruptionFlow: readFileSync(here('./corruptionFlow.ts'), 'utf8'),
  roundHooks: readFileSync(here('./combat/roundHooks.ts'), 'utf8'),
  turnHooks: readFileSync(here('./combat/turnHooks.ts'), 'utf8'),
  triggeredTest: readFileSync(here('./combat/triggeredTest.ts'), 'utf8'),
  triggeredEffects: readFileSync(here('./triggeredEffects.ts'), 'utf8'),
};

/** Corps `{ … }` équilibré d'une fonction nommée (déclaration `function`/`export function`). */
function bodyOf(src: string, name: string): string {
  const re = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) throw new Error(`fonction ${name} introuvable`);
  let pd = 0, i = m.index + m[0].length - 1; // au '(' des paramètres
  for (; i < src.length; i++) { if (src[i] === '(') pd++; else if (src[i] === ')') { if (--pd === 0) { i++; break; } } }
  const open = src.indexOf('{', i);
  let depth = 1, j = open + 1;
  while (j < src.length && depth > 0) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
  return src.slice(open + 1, j);
}

/** Sites de surfaçage connus (B1/B2 + Famille A) → prédicat de contrôleur qu'ils DOIVENT référencer. */
const SURFACING: { file: keyof typeof SRC; fn: string; pred: RegExp }[] = [
  { file: 'combatFlow', fn: 'maybeOpenDefense', pred: /aiDriven|pilotedByHuman/ },
  { file: 'combatFlow', fn: 'autoCleave', pred: /aiDriven/ },
  { file: 'combatFlow', fn: 'maybeHeroCleave', pred: /pilotedByHuman/ },
  { file: 'combatFlow', fn: 'resolveEnemyFumble', pred: /aiDriven/ },
  { file: 'combatFlow', fn: 'openRoundEndCascade', pred: /humanControlled/ },
  { file: 'combatFlow', fn: 'openCombatEndCascade', pred: /humanControlled/ },
  { file: 'combatFlow', fn: 'openCombatPsychCascade', pred: /humanControlled/ },
  { file: 'roundHooks', fn: 'collectHeroRoundEndUpkeep', pred: /humanControlled/ },
  { file: 'turnHooks', fn: 'resolveActGates', pred: /humanControlled/ },
  { file: 'turnHooks', fn: 'resolvePsychAI', pred: /aiDriven/ },
  { file: 'triggeredTest', fn: 'resolveFlowTest', pred: /humanControlled/ },
  { file: 'triggeredTest', fn: 'resolveFlowChoice', pred: /humanControlled/ },
  { file: 'triggeredEffects', fn: 'applyTriggeredEffects', pred: /humanControlled/ },
  { file: 'corruptionFlow', fn: 'gainCorruption', pred: /pilotedByHuman/ },
];

describe('Surfaçage « remonte-à-un-humain » — statique au choke-point (a)', () => {
  it('le prédicat de cadence `roundTestInteractive` est SUPPRIMÉ (symbole + module `cadenceGate`)', () => {
    expect(existsSync(here('./combat/cadenceGate.ts'))).toBe(false);
    for (const [name, src] of Object.entries(SRC))
      expect(src.includes('roundTestInteractive'), `${name} référence encore roundTestInteractive`).toBe(false);
  });

  it('chaque site de surfaçage connu route vers le prédicat de contrôleur', () => {
    for (const { file, fn, pred } of SURFACING)
      expect(pred.test(bodyOf(SRC[file], fn)), `${file}.${fn} doit référencer ${pred}`).toBe(true);
    // La défense de manœuvre de zone (split défenseurs humains/IA) vit dans un gros résolveur — on
    // vérifie que le module la route par le prédicat plutôt que par le `kind`.
    expect(SRC.combatManeuvers).toMatch(/pilotedByHuman/);
  });
});

// ── Harness de combat (calqué sur round-upkeep-cascade / maneuver-defense-cascade) ───────────────
function freshCombat() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
  set({ party: [hero] });
  get().startScene(testScene);
  get().startCombat('enc-mutants');
  get().confirmRoundStart();
  vi.clearAllTimers();
  const b = get().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  H.aiControlled = silence; // volet (d) : ré-silençage réel (contrôleur ≠ humain → pas de remontée)
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  const E = enemies[0];
  enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source ennemie
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 20, y: 20 };
  set({ battle: { ...b }, pendingCascade: null, pendingReveals: [], pendingCorruption: null, pendingDefense: null, pendingLogQueue: [], net: { ...get().net, gmSeat: undefined } });
  return { H, E };
}

/**
 * BEHAVIORAL FLOOR (partagé par b/d) : chaque contexte fait un Test d'un combattant piloté-humain et
 * DOIT ouvrir un `pending*`. `assert` = un `expect` qui LÈVE en cas de silence → le volet (d) l'attend.
 * L'ordre commence par un contexte gaté `humanControlled` (poison) : sous le stub, il échoue d'emblée.
 */
function behavioralFloor(): void {
  // 1) Upkeep de fin de Round (Empoisonné, RAW LDB 16) — gaté `humanControlled`.
  {
    seedBattleRng(3);
    const { H } = freshCombat();
    addCondition(H, COND.empoisonne, 2);
    openRoundEndCascade(get, set);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'triggeredTest' && s.actorId === H.id), 'upkeep Empoisonné doit REMONTER').toBeTruthy();
  }
  // 2) Psychologie de fin de Round (Peur en Ligne de Vue, LDB 21) — gaté `humanControlled`.
  {
    seedBattleRng(2);
    const { H, E } = freshCombat();
    E.pos = { x: 11, y: 10 };
    E.causesPeur = 2; // H craint E (adjacent, LdV dégagée)
    openRoundEndCascade(get, set);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'combatPsych' && s.actorId === H.id), 'Peur de fin de Round doit REMONTER').toBeTruthy();
  }
  // 3) Exposition à la Corruption de fin de combat (LDB 19) — gaté `humanControlled`.
  {
    seedBattleRng(4);
    const { H, E } = freshCombat();
    E.traits = [{ id: 'corruption', arg: 'mineure' }];
    openCombatEndCascade(get, set);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'combatEndCorruption' && s.actorId === H.id), 'exposition Corruption doit REMONTER').toBeTruthy();
  }
  // 4) Test déclenché (Mâchoires d'acier onGainCondition, LDB 10) — gaté `humanControlled`.
  {
    seedBattleRng(7);
    const { H } = freshCombat();
    H.talents = [...(H.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    addCondition(H, COND.sonne, 2);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'triggeredTest' && s.actorId === H.id), 'Test déclenché (Mâchoires) doit REMONTER').toBeTruthy();
  }
  // 5) Défense réactive de mêlée (LDB 13) — gaté `pilotedByHuman` (cadence-agnostique).
  {
    seedBattleRng(1);
    const { H, E } = freshCombat();
    E.pos = { x: 11, y: 10 };
    E.weapons = [buildWeapon({ label: 'Épée', attackKind: 'arme', damage: { plusBF: true, flat: 4 } })];
    H.conditions = []; // pas Surpris → peut se défendre
    expect(maybeOpenDefense(get, set, E, H), 'attaque IA sur héros doit OUVRIR la défense').toBe(true);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'defenseJet' && s.actorId === H.id), 'défense réactive doit REMONTER').toBeTruthy();
  }
  // 6) Défense d'une manœuvre de ZONE (Souffle, LDB 85) — gaté `pilotedByHuman` (cadence-agnostique).
  {
    seedBattleRng(2);
    const { H, E } = freshCombat();
    E.traits = [{ id: 'souffle', value: 14, arg: 'Feu' }];
    E.advantage = 2; E.characteristics['capacite-de-tir'] = 85; E.characteristics.endurance = 40; E.pos = { x: 5, y: 5 };
    H.pos = { x: 5, y: 8 };
    H.characteristics.agilite = 1; H.skills = H.skills.filter((s) => s.skillId !== 'esquive'); H.conditions = [];
    set({ battle: { ...get().battle!, acted: true } });
    aiCreatureFreeAttacks(get, set, E);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'maneuverDefense' && s.actorId === H.id), 'défense de manœuvre doit REMONTER').toBeTruthy();
  }
  // 7) Corruption au seuil (LDB 19 l.80) — gaté `pilotedByHuman` (cadence-agnostique, modale).
  {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'C', rng: makeRNG(1) });
    hero.aiControlled = silence; // volet (d) : ré-silençage réel
    hero.characteristics.endurance = 1; hero.characteristics['force-mentale'] = 1; hero.corruption = 5; // seuil 0 → dépassé
    set({ party: [hero], battle: null, pendingCorruption: null, net: { ...get().net, gmSeat: undefined } });
    gainCorruption(get, set, hero, 1);
    expect(get().pendingCorruption, 'seuil de Corruption doit REMONTER').toBeTruthy();
  }
}

describe('Surfaçage « remonte-à-un-humain » — behavioral (b) + garde-du-garde (d)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); silence = false; set({ battle: null, pendingCascade: null, pendingCorruption: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); silence = false; });

  it('(b) chaque contexte d’un combattant piloté-humain OUVRE un pending influençable', () => {
    behavioralFloor();
  });

  it('(d) combattant ré-silencié (contrôleur ≠ humain) → le plancher behavioral ÉCHOUE', () => {
    silence = true;
    try {
      expect(() => behavioralFloor()).toThrow();
    } finally {
      silence = false;
    }
  });
});

// ── Volet (c) — preuve par FLIP LOCAL (le surfaçage suit le CONTRÔLEUR, jamais le kind) ───────────
describe('Surfaçage « remonte-à-un-humain » — flip local (c)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); set({ battle: null, pendingCascade: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); });

  it('un ENNEMI assigné à un siège humain fait REMONTER son Test déclenché (actorId===enemyId)', () => {
    seedBattleRng(7);
    const { E } = freshCombat();
    E.talents = [...(E.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    set({ net: { ...get().net, gmSeat: 0 } }); // rôle MJ posé sur le siège 0 (bac-à-sable) → conduit les ennemis
    addCondition(E, COND.sonne, 2); // onGainCondition → testRouter → resolveFlowTest → humanControlled(E)=true
    const c = get().pendingCascade;
    expect(c, 'l’ennemi assigné doit ouvrir une cascade').toBeTruthy();
    expect(c!.participants.some((s) => s.kind === 'triggeredTest' && s.actorId === E.id), 'le Test REMONTE au nom de l’ennemi assigné').toBe(true);
  });

  it('le même ennemi NON assigné → Test déclenché résolu INLINE (aucune cascade)', () => {
    seedBattleRng(5);
    const { E } = freshCombat();
    E.characteristics.endurance = 90; // Résistance réussie → retrait inline
    E.talents = [...(E.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    set({ net: { ...get().net, gmSeat: undefined } });
    addCondition(E, COND.sonne, 2);
    expect(get().pendingCascade, 'ennemi IA → jamais de cascade').toBeNull();
  });

  it('la Maladresse d’un ENNEMI conduit (MJ) REMONTE en cascade via attackConfirm (pas perdue — risque #2 du plan)', () => {
    const { H, E } = freshCombat();
    E.pos = { x: 10, y: 10 }; H.pos = { x: 11, y: 10 }; // adjacents (mêlée)
    E.weapons = [buildWeapon({ label: 'Épée', attackKind: 'arme', damage: { plusBF: true, flat: 4 } })];
    E.characteristics['capacite-de-combat'] = 20; // CC basse → un double ≥ 22 rate = Maladresse (LDB 14 l.48)
    set({ net: { ...get().net, gmSeat: 0 }, pendingCascade: null }); // rôle MJ → E est CONDUIT (controlsCombatant(E)=vrai)
    // Graine DÉTERMINISTE produisant une Maladresse de E (double raté) — via le VRAI résolveur d'attaque.
    let seed = 0;
    for (let sd = 1; sd <= 500 && !seed; sd++) {
      seedBattleRng(sd);
      const r = resolveAttack(get, E, H);
      if (r && attackerFumbled(r.res, r.weapon)) seed = sd;
    }
    expect(seed, 'une graine de Maladresse existe').toBeGreaterThan(0);
    seedBattleRng(seed);
    const r = resolveAttack(get, E, H)!; // résultat de Maladresse RÉEL (pas fabriqué)
    set({ pendingAttack: { attackerId: E.id, targetId: H.id, location: r.res.location ?? null, result: r.res, victimId: r.victim?.id, weaponUid: E.weapons[0].uid } });
    get().attackConfirm();
    const c = get().pendingCascade;
    expect(c?.participants.some((s) => s.jet === 'fumble' && s.actorId === E.id), 'la Maladresse de l’ennemi conduit REMONTE au nom de l’ennemi').toBe(true);
  });

  it('un HÉROS `aiControlled` → Test déclenché résolu INLINE (contrôleur ≠ humain)', () => {
    seedBattleRng(5);
    const { H } = freshCombat();
    H.aiControlled = true; H.characteristics.endurance = 90;
    H.talents = [...(H.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    set({ net: { ...get().net, gmSeat: undefined } });
    addCondition(H, COND.sonne, 2);
    expect(get().pendingCascade, 'héros piloté-IA → pas de cascade').toBeNull();
  });
});
