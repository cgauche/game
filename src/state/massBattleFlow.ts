/**
 * Combat de masse / Puissance de Bataille — orchestration (ADE II ch.8, l.13-321).
 *
 * Couche STATE au-dessus du moteur PUR `engine/massBattle` : conduit la boucle de bataille (Discours
 * inspirant pré-bataille → Rounds de bataille [configuration du terrain → Scène cinématique choisie par
 * les PJ → Test spectaculaire de Puissance] → répétition → issue). Les jets des PJ (Discours, Scènes de
 * Compétence) passent par une modale de jet différée (`pendingBattleTest`, même fabrique `makeRollFlow`
 * que tous les autres flux). Le Test spectaculaire NON opposé (l.120) est un jet d'ARMÉE (sans Chance/
 * Résilience personnelles) résolu directement et montré dans la vue. Une Scène `combat` réutilise le
 * combat tactique existant (`startCombat`) ; sa victoire nourrit la réduction de Puissance ennemie.
 */
import type { GameState } from './store';
import type { Get, Set } from './flowTypes';
import type { PendingBase } from './rollFlow';
import type { Combatant, CharKey, Difficulty } from '../engine/types';
import { battleRng } from './battleRng';
import { d10 } from '../engine/dice';
import { partyBest } from '../engine/skills';
import { refLabel } from '../data';
import { CHAR_LABELS, DIFFICULTY_MODIFIERS } from '../engine/types';
import {
  battleSceneById, inspireDifficulty, INSPIRE_BONUS, resolveClash, sceneMightDelta,
  applyMightDelta, battleOutcome, isDestroyed, battleHazard, clampMight,
  type BattleSceneDef, type BattleSceneEffect, type ClashResult, type BattleOutcome,
} from '../engine/massBattle';

/** Une armée engagée dans la Puissance de Bataille. */
export interface MassBattleArmy {
  name: string;
  /** Puissance courante (0-100), recalculée à la fin de chaque Round (l.19). */
  might: number;
  /** Puissance de DÉPART — plafond des gains d'une Scène (l.135). */
  startMight: number;
}

/** Delta de Puissance d'une Scène résolue (affichage). */
export interface SceneDelta { side: 'ally' | 'enemy'; amount: number; label: string }

/** État runtime d'une bataille de masse. */
export interface MassBattleState {
  ally: MassBattleArmy;
  enemy: MassBattleArmy;
  /** Rounds de bataille prévus (escarmouche = 1, siège ≥ 5, l.124). */
  plannedRounds: number;
  /** Round de bataille courant (1-based). */
  round: number;
  /** 'inspire' = pré-bataille (Discours + Planification) ; 'round' = Round actif ; 'over' = terminée. */
  phase: 'inspire' | 'round' | 'over';
  /** Description narrative de la configuration du terrain du Round (l.126). */
  terrain?: string;
  /** Modificateur PERMANENT au Test de Puissance allié (Planification +10/+20, l.81). */
  allyMod: number;
  /** Bonus au Test de Puissance allié du PREMIER Round seul (Discours inspirant réussi, l.71). */
  firstRoundBonus: number;
  /** Discours inspirant déjà tenté (une fois avant la bataille). */
  inspired?: boolean;
  /** Facteur environnemental du Round (l.309) — narratif (le MJ/joueur l'applique en Scène). */
  hazard?: { label: string; text: string };
  /** Scène cinématique déjà résolue ce Round (une par Round dans ce flux). */
  sceneResolved?: boolean;
  sceneDelta?: SceneDelta;
  /** Ids des Scènes proposées (catalogue `mass-battle.json`). */
  scenes: string[];
  /** Rencontre de la scène courante à démarrer pour une Scène de COMBAT (par id de Scène) — l'id
   *  d'encounter est propre à la scène tactique, pas au catalogue global. */
  sceneEncounters?: Record<string, string>;
  /** Résultat du dernier Test spectaculaire (affichage). */
  lastClash?: ClashResult;
  /** Issue finale (phase 'over'). */
  outcome?: BattleOutcome;
  /** Scène de combat tactique en attente de reprise (startCombat). */
  combatScene?: { sceneId: string; effect: BattleSceneEffect };
  /** Journal de bataille (une ligne par événement marquant). */
  log: string[];
}

/** Spec d'amorçage d'une bataille (scénario de test / recette `__wfrp`). */
export interface MassBattleSpec {
  allyName?: string;
  enemyName?: string;
  allyMight: number;
  enemyMight: number;
  /** Rounds prévus (défaut 1 = escarmouche). */
  plannedRounds?: number;
  terrain?: string;
  /** Ids de Scènes proposées (défaut : tout le catalogue). */
  scenes?: string[];
  /** Rencontres à démarrer pour les Scènes de COMBAT (par id de Scène → id d'encounter de la scène). */
  sceneEncounters?: Record<string, string>;
  /** Modificateur de Planification permanent (l.81). */
  allyMod?: number;
}

/** Jet de PJ d'une bataille de masse (Discours inspirant / Scène de Compétence) — modale différée. */
export interface PendingBattleTest extends PendingBase {
  actorId: string;
  actorName: string;
  /** Intitulé de la situation (titre de la modale). */
  label: string;
  /** Libellé de la Compétence/Caractéristique testée (cadre de jet). */
  skill: string;
  skillId?: string;
  spec?: string;
  char?: CharKey;
  skillValue: number;
  difficulty: Difficulty;
  /** But du jet : Discours inspirant (bonus au 1er Round) ou Scène cinématique (delta de Puissance). */
  purpose: 'inspire' | 'scene';
  /** Scène concernée (`purpose:'scene'`). */
  sceneId?: string;
  roll: number | null;
  target: number;
  sl: number;
  success: boolean;
  forced?: boolean;
  rerolled?: boolean;
}

const DEFAULT_SCENES = ['motivation', 'ligne-de-mire', 'charge', 'tuez-la-bete', 'duel'];

/** Ouvre une bataille de masse et bascule sur sa vue. */
export function startMassBattle(get: Get, set: Set, spec: MassBattleSpec): void {
  if (get().battle) { get().log('Impossible d\'ouvrir une bataille de masse en plein combat tactique.'); return; }
  const allyMight = clampMight(spec.allyMight);
  const enemyMight = clampMight(spec.enemyMight);
  const mb: MassBattleState = {
    ally: { name: spec.allyName ?? 'Armée des Personnages', might: allyMight, startMight: allyMight },
    enemy: { name: spec.enemyName ?? 'Armée ennemie', might: enemyMight, startMight: enemyMight },
    plannedRounds: Math.max(1, Math.floor(spec.plannedRounds ?? 1)),
    round: 1,
    phase: 'inspire',
    terrain: spec.terrain,
    allyMod: spec.allyMod ?? 0,
    firstRoundBonus: 0,
    scenes: (spec.scenes && spec.scenes.length ? spec.scenes : DEFAULT_SCENES).filter((id) => !!battleSceneById(id)),
    sceneEncounters: spec.sceneEncounters,
    log: [`Bataille engagée : ${spec.allyName ?? 'les Personnages'} (Puissance ${allyMight}) contre ${spec.enemyName ?? 'l\'ennemi'} (Puissance ${enemyMight}).`],
  };
  set({ massBattle: mb, screen: 'massBattle' });
}

/** Passe de la phase pré-bataille aux Rounds (Discours résolu ou ignoré). */
export function massBattleBegin(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'inspire') return;
  set({ massBattle: { ...mb, phase: 'round' } });
}

/** Ouvre le Test de Commandement du Discours inspirant (l.71). Difficulté = écart de Puissance
 *  arrondi à la dizaine ; en cas de succès → +10 au Test de Puissance du premier Round. */
export function openMassBattleInspire(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'inspire' || mb.inspired) return;
  const best = partyBest(get().party.filter((h) => !h.dead), 'commandement');
  if (!best) return;
  const difficulty = inspireDifficulty(mb.ally.might, mb.enemy.might);
  openBattleTest(get, set, {
    actor: best.actor, skillValue: best.value, skillId: 'commandement', difficulty,
    label: 'Discours inspirant', purpose: 'inspire',
  });
}

/** Choisit une Scène cinématique du Round : 'test' → modale de jet ; 'combat' → combat tactique. */
export function openMassBattleScene(get: Get, set: Set, sceneId: string): void {
  const mb = get().massBattle;
  const scene = battleSceneById(sceneId);
  if (!mb || mb.phase !== 'round' || mb.sceneResolved || !scene) return;
  if (scene.kind === 'combat') { startBattleCombat(get, set, scene); return; }
  // Scène 'test' : compétences AU CHOIX (l.151) → le meilleur lanceur du groupe, toutes compétences
  // listées confondues (celle qui donne la plus haute valeur décide).
  const party = get().party.filter((h) => !h.dead);
  const choices = scene.skills?.length ? scene.skills : [{ skillId: undefined as string | undefined, spec: undefined as string | undefined }];
  let picked: { actor: Combatant; value: number; skillId?: string; spec?: string } | null = null;
  for (const sk of choices) {
    const b = partyBest(party, sk.skillId, scene.char, undefined, sk.spec);
    if (b && (!picked || b.value > picked.value)) picked = { actor: b.actor, value: b.value, skillId: sk.skillId, spec: sk.spec };
  }
  if (!picked) return;
  openBattleTest(get, set, {
    actor: picked.actor, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: scene.char,
    difficulty: scene.difficulty ?? 'intermediaire', label: scene.label, purpose: 'scene', sceneId: scene.id,
  });
}

/** Fabrique commune d'une modale de jet de bataille (Discours ou Scène). */
function openBattleTest(get: Get, set: Set, o: {
  actor: Combatant; skillValue: number; skillId?: string; spec?: string; char?: CharKey;
  difficulty: Difficulty; label: string; purpose: 'inspire' | 'scene'; sceneId?: string; skillLabel?: string;
}): void {
  const skill = o.skillLabel ?? (o.skillId ? refLabel('skills', { id: o.skillId, spec: o.spec }) : o.char ? CHAR_LABELS[o.char] : 'Test');
  // Cible EFFECTIVE précalculée (base + Difficulté), même convention que le Test de scène.
  const target = Math.max(1, Math.min(99, o.skillValue + DIFFICULTY_MODIFIERS[o.difficulty]));
  set({
    pendingBattleTest: {
      actorId: o.actor.id, actorName: o.actor.name, label: o.label, skill,
      skillId: o.skillId, spec: o.spec, char: o.char, skillValue: o.skillValue, difficulty: o.difficulty,
      purpose: o.purpose, sceneId: o.sceneId, roll: null, target, sl: 0, success: false,
    },
  });
}

/** Applique un delta de Puissance à un camp (plafonné à la Puissance de départ pour un gain, l.135). */
function applyDelta(mb: MassBattleState, side: 'ally' | 'enemy', delta: number): MassBattleState {
  const army = mb[side];
  const might = applyMightDelta(army.might, army.startMight, delta);
  return { ...mb, [side]: { ...army, might } };
}

/** « Appliquer » d'un jet de bataille (Discours/Scène) : consomme le résultat et met à jour la Puissance. */
export function battleTestConfirm(get: Get, set: Set): void {
  const pt = get().pendingBattleTest;
  const mb = get().massBattle;
  set({ pendingBattleTest: null });
  if (!pt || pt.roll == null || !mb) return;
  const lines: string[] = [];
  let next = mb;
  if (pt.purpose === 'inspire') {
    if (pt.success) {
      next = { ...next, firstRoundBonus: next.firstRoundBonus + INSPIRE_BONUS };
      lines.push(`${pt.actorName} galvanise les troupes (Discours inspirant réussi) : +${INSPIRE_BONUS} au Test de Puissance du premier Round.`);
    } else {
      lines.push(`${pt.actorName} ne parvient pas à galvaniser les troupes (Discours inspirant raté).`);
    }
    next = { ...next, inspired: true };
  } else if (pt.sceneId) {
    const scene = battleSceneById(pt.sceneId);
    if (scene) {
      if (pt.success) {
        const delta = sceneMightDelta(scene.effect, pt.sl);
        next = applyDelta(next, scene.effect.side, delta);
        next = { ...next, sceneDelta: { side: scene.effect.side, amount: delta, label: scene.label } };
        lines.push(sceneOutcomeLine(pt.actorName, scene, delta));
      } else {
        lines.push(`${pt.actorName} échoue à la Scène « ${scene.label} » — aucun effet sur la Puissance.`);
      }
      next = { ...next, sceneResolved: true };
    }
  }
  set({ massBattle: { ...next, log: [...next.log, ...lines] } });
  for (const l of lines) get().log(l);
}

function sceneOutcomeLine(actor: string, scene: BattleSceneDef, delta: number): string {
  const target = scene.effect.side === 'ally' ? 'votre armée' : 'l\'armée ennemie';
  const sign = delta >= 0 ? `+${delta}` : `${delta}`;
  return `${actor} réussit la Scène « ${scene.label} » : Puissance de ${target} ${sign}.`;
}

/** Scène de COMBAT tactique (l.137-145/211-213) : réutilise le combat existant. La victoire nourrit la
 *  réduction de Puissance ennemie (`perKill` × ennemis neutralisés — l.139 ; ou montant plat — l.213). */
function startBattleCombat(get: Get, set: Set, scene: BattleSceneDef): void {
  const mb = get().massBattle;
  if (!mb) return;
  const encId = mb.sceneEncounters?.[scene.id] ?? scene.encounter;
  const enc = encId && get().scene?.encounters.find((e) => e.id === encId);
  if (!enc) {
    get().log(`Scène « ${scene.label} » : aucune rencontre « ${encId ?? '?'} » dans la scène courante.`);
    return;
  }
  set({ massBattle: { ...mb, combatScene: { sceneId: scene.id, effect: scene.effect } }, screen: 'campaign' });
  get().log(`Scène « ${scene.label} » : les Personnages s'engagent dans la mêlée.`);
  get().startCombat(encId);
}

/** Reprise après une Scène de COMBAT gagnée (appelée par `dismissVictory`) : applique la réduction de
 *  Puissance et revient à la vue de bataille. `kills` = ennemis neutralisés/tués (l.139). */
export function massBattleResumeCombat(get: Get, set: Set, kills: number): void {
  const mb = get().massBattle;
  if (!mb?.combatScene) return;
  const scene = battleSceneById(mb.combatScene.sceneId);
  const effect = mb.combatScene.effect;
  const counter = effect.scale === 'perKill' ? kills : 0;
  const delta = sceneMightDelta(effect, counter);
  let next = applyDelta(mb, effect.side, delta);
  next = { ...next, sceneResolved: true, sceneDelta: { side: effect.side, amount: delta, label: scene?.label ?? 'Combat' }, combatScene: undefined };
  const line = scene ? sceneOutcomeLine('Les Personnages', scene, delta) : `Scène de combat résolue : Puissance ${delta >= 0 ? '+' : ''}${delta}.`;
  set({ massBattle: { ...next, log: [...next.log, line] }, screen: 'massBattle' });
  get().log(line);
}

/** Tire (ou choisit) le facteur environnemental du Round (l.309, 1d10). */
export function massBattleSetHazard(get: Get, set: Set, roll?: number): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round') return;
  const h = battleHazard(roll ?? d10(battleRng()));
  set({ massBattle: { ...mb, hazard: { label: h.label, text: h.text }, log: [...mb.log, `Facteur environnemental : ${h.label}.`] } });
  get().log(`Facteur environnemental (aléa de bataille) : ${h.label}.`);
}

/** Résout le Test spectaculaire de Puissance du Round (l.120) puis fait avancer la bataille (l.124). */
export function massBattleClash(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round') return;
  const allyMod = mb.allyMod + (mb.round === 1 ? mb.firstRoundBonus : 0);
  const clash = resolveClash(mb.ally.might, mb.enemy.might, { allyMod, enemyMod: 0, rng: battleRng() });
  const lines: string[] = [
    `Round ${mb.round}/${mb.plannedRounds} — Test spectaculaire de Puissance : les Personnages réduisent l'ennemi de ${clash.enemyLoss}, l'ennemi réduit les Personnages de ${clash.allyLoss}.`,
    `Puissance : ${mb.ally.name} ${clash.allyMight} · ${mb.enemy.name} ${clash.enemyMight}.`,
  ];
  let next: MassBattleState = {
    ...mb,
    ally: { ...mb.ally, might: clash.allyMight },
    enemy: { ...mb.enemy, might: clash.enemyMight },
    lastClash: clash,
  };
  // Fin par destruction (l.19/124) ou à l'épuisement des Rounds prévus (l.124).
  const destroyed = isDestroyed(clash.allyMight) || isDestroyed(clash.enemyMight);
  if (destroyed || mb.round >= mb.plannedRounds) {
    const outcome = battleOutcome(clash.allyMight, clash.enemyMight);
    next = { ...next, phase: 'over', outcome };
    lines.push(outcomeLine(next, outcome, destroyed));
  } else {
    next = {
      ...next, round: mb.round + 1,
      sceneResolved: false, sceneDelta: undefined, hazard: undefined, terrain: undefined,
    };
  }
  set({ massBattle: { ...next, log: [...next.log, ...lines] } });
  for (const l of lines) get().log(l);
}

function outcomeLine(mb: MassBattleState, outcome: BattleOutcome, destroyed: boolean): string {
  if (outcome === 'draw') return 'La bataille s\'achève sans vainqueur clair — les deux armées se retirent.';
  const winner = outcome === 'ally' ? mb.ally.name : mb.enemy.name;
  const loser = outcome === 'ally' ? mb.enemy.name : mb.ally.name;
  return destroyed
    ? `${loser} est anéantie ! ${winner} l'emporte.`
    : `${winner} l'emporte (Puissance supérieure). ${loser} doit fuir sous peine d'être détruite.`;
}

/** Ferme la bataille et revient au jeu. */
export function endMassBattle(get: Get, set: Set): void {
  if (!get().massBattle) return;
  set({ massBattle: null, screen: get().scene ? 'campaign' : 'menu' });
}

/** Sélecteur des Scènes proposées ce Round (défs complètes). */
export function massBattleScenes(mb: MassBattleState): BattleSceneDef[] {
  return mb.scenes.map((id) => battleSceneById(id)).filter((s): s is BattleSceneDef => !!s);
}
