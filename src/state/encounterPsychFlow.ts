/**
 * Flux de Psychologie À LA RENCONTRE, hors combat (couture C — câblage de `engine/encounterPsych`).
 *
 * À l'entrée d'une scène, chaque héros du groupe évalue s'il doit faire un Test de Psychologie face aux
 * PNJ présents (Peur/Terreur de Taille ou de statbloc, ou Trait ciblé Animosité/Haine/Préjugé/Phobie).
 * Le Test du héros passe par une modale (`pendingEncounterPsych`) — invariante « un jet = une modale ».
 * Hors combat, la Peur est résolue par un Test de Calme SIMPLE (pas le Test étendu du combat) ; la Terreur
 * garde sa résolution canonique (Brisé puis devient Peur). Auto-chaîné héros par héros.
 *
 * Self-contained : ne touche NI `combatFlow` (modale combat) NI les actions psy de combat — il réutilise
 * seulement les résolveurs PURS (`resolveTerreurTest`/`resolveCalmeSimple`) et `encounterPsych`.
 */
import type { GameState } from './store';
import { Combatant } from '../engine/types';
import { Scene } from './scene';
import { spawnEnemy } from './spawn';
import { encounterPsych } from '../engine/encounterPsych';
import { calmeValue, resolveTerreurTest, resolveCalmeSimple, CIBLE_TYPES, PsychType } from '../engine/psychology';
import { canReroll } from '../engine/fortune';
import { hasActiveFlag, consumeActiveFlag } from '../engine/activeFlags';
import { battleRng } from './battleRng';
import { addCondition } from '../engine/conditions';

export interface PendingEncounterPsych {
  heroId: string;
  kind: PsychType;
  sourceId: string;
  sourceName: string;
  indice: number;
  cible?: string;
  result: { roll: number; success: boolean; brise?: number; target?: number; sl?: number } | null;
  rerolled?: boolean;
}

/** PNJ « personnage » présents dans la scène, dérivés en Combatant (groups/causesPeur/Terreur/size). */
export function sceneFearSources(scene: Scene): Combatant[] {
  return (scene.entities ?? [])
    .filter((e) => e.kind === 'personnage')
    .map((e) => spawnEnemy(e.ref, e.statblock, e.id, e.pos));
}

/** Ouvre le 1er Test de Psychologie de rencontre dû (hors combat). No-op en combat, si une modale est déjà
 *  ouverte, ou sans scène/PNJ. Auto-appelé à l'entrée de scène et après chaque résolution (chaînage). */
export function openEncounterPsych(get: () => GameState, set: (s: Partial<GameState>) => void): void {
  const s = get();
  if (s.battle || s.pendingEncounterPsych || !s.scene) return;
  const npcs = sceneFearSources(s.scene);
  if (!npcs.length) return;
  for (const hero of s.party) {
    if (hero.dead) continue;
    const t = encounterPsych(hero, npcs);
    if (!t) continue;
    const src = npcs.find((n) => n.id === t.sourceId);
    set({ pendingEncounterPsych: { heroId: hero.id, kind: t.kind, sourceId: t.sourceId, sourceName: src?.name ?? '?', indice: t.indice, cible: t.cible, result: null } });
    return;
  }
}

function rollFor(pe: PendingEncounterPsych, hero: Combatant): PendingEncounterPsych['result'] {
  const calme = calmeValue(hero);
  if (pe.kind === 'terreur') {
    const r = resolveTerreurTest(calme, pe.indice, battleRng());
    return { roll: r.roll, success: r.success, brise: r.brise, target: r.target, sl: r.sl };
  }
  const r = resolveCalmeSimple(calme, battleRng()); // Peur (simple hors combat) ou trait ciblé : binaire
  return { roll: r.roll, success: r.success, target: r.target, sl: r.sl };
}

export function encounterPsychRoll(get: () => GameState, set: (s: Partial<GameState>) => void): void {
  const { pendingEncounterPsych: pe, party } = get();
  if (!pe || pe.result) return;
  const hero = party.find((h) => h.id === pe.heroId);
  if (!hero) return;
  set({ pendingEncounterPsych: { ...pe, result: rollFor(pe, hero) } });
}

export function encounterPsychReroll(get: () => GameState, set: (s: Partial<GameState>) => void): void {
  const { pendingEncounterPsych: pe, party } = get();
  if (!pe || !pe.result) return;
  if (!canReroll(!pe.result.success, !!pe.rerolled)) return;
  const hero = party.find((h) => h.id === pe.heroId);
  // Bénédiction de Chance (LDB 41) : relance gratuite consommée à la place du Point de Chance.
  const free = !!hero && hasActiveFlag(hero, 'freeReroll');
  if (!hero || (!free && (hero.fortune ?? 0) <= 0)) return;
  if (free) consumeActiveFlag(hero, 'freeReroll');
  else hero.fortune = (hero.fortune ?? 0) - 1;
  set({ pendingEncounterPsych: { ...pe, result: rollFor(pe, hero), rerolled: true }, party: [...party] });
}

export function encounterPsychForceSuccess(get: () => GameState, set: (s: Partial<GameState>) => void): void {
  const { pendingEncounterPsych: pe, party } = get();
  if (!pe || pe.result?.success) return;
  const hero = party.find((h) => h.id === pe.heroId);
  if (!hero || (hero.resilience ?? 0) <= 0) return;
  hero.resilience = (hero.resilience ?? 0) - 1;
  // RAW LDB 17 l.73 : avant le jet (result==null → base 01) OU après un échec.
  const base = pe.result ?? { roll: 1, success: false };
  set({ pendingEncounterPsych: { ...pe, result: { ...base, success: true, brise: 0 } }, party: [...party] });
}

/** Détermination (LDB 17 l.62) : dépense 1 point de Détermination → immunité à la Psychologie, la
 *  rencontre est surmontée d'office (retour playtest #6 : pouvoir se protéger des effets psy d'un clic). */
export function encounterPsychResolve(get: () => GameState, set: (s: Partial<GameState>) => void): void {
  const { pendingEncounterPsych: pe, party } = get();
  if (!pe) return;
  const hero = party.find((h) => h.id === pe.heroId);
  if (!hero || (hero.resolve ?? 0) <= 0) return;
  hero.resolve = (hero.resolve ?? 0) - 1;
  const base = pe.result ?? { roll: 1, success: false };
  set({ pendingEncounterPsych: { ...pe, result: { ...base, success: true, brise: 0 } }, party: [...party] });
}

export function encounterPsychConfirm(get: () => GameState, set: (s: Partial<GameState>) => void): void {
  const { pendingEncounterPsych: pe, party } = get();
  if (!pe || !pe.result) return;
  const hero = party.find((h) => h.id === pe.heroId);
  set({ pendingEncounterPsych: null });
  if (hero) {
    hero.psychState ??= [];
    const r = pe.result;
    const log: string[] = [];
    if (pe.kind === 'terreur') {
      if (!r.success && (r.brise ?? 0) > 0) { addCondition(hero, 'Brisé', r.brise!); log.push(`${hero.name} est terrifié par ${pe.sourceName} : ${r.brise} État(s) Brisé.`); }
      hero.psychState.push({ type: 'peur', sourceId: pe.sourceId, indice: r.success ? 0 : pe.indice, calmeDR: 0 }); // la Terreur devient une Peur (LDB 21 l.57)
    } else if (CIBLE_TYPES.has(pe.kind)) {
      hero.psychState.push({ type: pe.kind, cible: pe.cible, sourceId: pe.sourceId, active: !r.success });
      log.push(r.success ? `${hero.name} maîtrise son ${pe.kind}.` : `${hero.name} est en proie à son ${pe.kind}${pe.cible ? ` (${pe.cible})` : ''}.`);
    } else {
      hero.psychState.push({ type: 'peur', sourceId: pe.sourceId, indice: pe.indice, calmeDR: r.success ? pe.indice : 0 });
      log.push(r.success ? `${hero.name} surmonte sa peur de ${pe.sourceName}.` : `${hero.name} a peur de ${pe.sourceName}.`);
    }
    set({ party: [...party], journal: log.length ? [...get().journal.slice(-40), ...log] : get().journal });
  }
  openEncounterPsych(get, set); // enchaîne le héros suivant
}
