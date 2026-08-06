/**
 * Psychologie À LA RENCONTRE, hors combat (couture C, LDB 21). À l'entrée d'une scène, chaque héros
 * face à un PNJ inspirant Peur/Terreur (Taille/statbloc) ou un Trait ciblé (Animosité/Haine/Phobie…)
 * fait un Test de Calme.
 *
 * « Une situation = une modale » : tous les héros concernés sont les ÉTAPES d'UNE cascade (rendue par
 * `CascadeModal`), au lieu de N modales enchaînées une par une. Le jet est le Test de Calme GÉNÉRIQUE
 * de la cascade (`FLOWS.cascade` → `rollTest(Calme)`, kind-agnostique) ; la CONSÉQUENCE (psychState,
 * Brisé de Terreur dérivé du DR) vit dans l'applier `'encounterPsych'`. La Détermination (immunité,
 * LDB 17 l.62) est offerte par la coquille via `cascadeDetermine` sur l'étape.
 */
import type { Get, Set } from './flowTypes';
import { Combatant } from '../engine/types';
import { Scene } from './scene';
import type { CascadeStep } from './pendings';
import { spawnEnemy } from './spawn';
import { encounterPsych } from '../engine/encounterPsych';
import { CIBLE_TYPES, CIBLE_LABEL, PsychType, failConditionAmount, psychResolution, suppressSupersededPsych, isPsychImmune } from '../engine/psychology';
import { skillBaseValue } from '../engine/skills';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import { psychologyLabel, refLabel, findPsychologyById, combatStakeRef } from '../data';
import { t } from '../i18n';
import { addCondition } from '../engine/conditions';
import { registerCascadeApplier, startCascade } from './cascade';
import { describeEncounterPsych } from './flowOutcomes';
import { freeCons } from './rollSeam';

/** Forme d'un Test de Psychologie de rencontre résolu — conservée pour `describeEncounterPsych`
 *  (l'applier en construit une à partir de l'étape de cascade). */
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

/** PNJ « personnage » présents dans la scène, dérivés en Combatant (groups/causesPeur/Terreur/size).
 *  Un embusqueur caché n'inspire pas la Peur avant le combat. */
export function sceneFearSources(scene: Scene): Combatant[] {
  return (scene.entities ?? [])
    .filter((e) => e.kind === 'personnage' && !e.combat?.hiddenUntilCombat)
    .map((e) => spawnEnemy(e.ref, e.statblock, e.id, e.pos));
}

/** Ouvre la CASCADE des Tests de Psychologie de rencontre dus (hors combat) — UNE étape par héros
 *  concerné. No-op en combat, si une cascade est déjà ouverte, ou sans scène/PNJ. Auto-appelé à
 *  l'entrée de scène. */
export function openEncounterPsych(get: Get, set: Set): void {
  const s = get();
  if (s.battle || s.pendingCascade || !s.scene) return;
  const npcs = sceneFearSources(s.scene);
  if (!npcs.length) return;
  const steps: CascadeStep[] = [];
  for (const hero of s.party) {
    if (hero.dead) continue;
    const t = encounterPsych(hero, npcs);
    if (!t) continue;
    const src = npcs.find((n) => n.id === t.sourceId);
    const cl = CIBLE_TYPES.has(t.kind) ? CIBLE_LABEL[t.kind] : null;
    // Paramètres du Test EN DONNÉES (psychology.json `test`) : compétence (défaut Calme) + difficulté
    // (défaut Intermédiaire). Mêmes données que le combat (`psychStepFor`), plus de Calme/+0 codé.
    const td = findPsychologyById(t.kind)?.test;
    const skill = td?.skill ?? 'calme';
    const base = skillBaseValue(hero, skill);
    const target = base + DIFFICULTY_MODIFIERS[td?.difficulty ?? 'intermediaire'];
    steps.push({
      id: `psych-${hero.id}`,
      kind: 'encounterPsych',
      actorId: hero.id,
      icon: cl?.icon ?? (t.kind === 'terreur' ? 'creature/scream' : 'flag/fear'),
      rollLabel: refLabel('skills', { id: skill }),
      base,
      target, // Test (Calme par défaut) à la difficulté déclarée (défaut Intermédiaire +0)
      label: cl ? `${cl.label}${t.cible ? ` (${t.cible})` : ''}` : `${t.kind === 'terreur' ? 'Terreur' : 'Peur'} ${t.indice} — ${src?.label ?? '?'}`,
      encounterPsych: { kind: t.kind, sourceId: t.sourceId, sourceName: src?.label ?? '?', indice: t.indice, cible: t.cible },
      stake: combatStakeRef('encounterPsych', { entryId: t.kind, values: { indice: t.indice } }),
    });
  }
  if (!steps.length) return;
  startCascade(get, set, { title: 'Sang-froid', icon: 'flag/fear', purpose: 'test', steps });
}

/** Ouvre la cascade des Tests de Calme pour une source de PEUR/TERREUR SCÉNIQUE (Effet d'auteur
 *  `inflictPsychology` — apparition, présage, vision d'horreur), sur la MÊME machinerie que
 *  `openEncounterPsych` (applier `'encounterPsych'` partagé) — `sceneFearSources`/`encounterPsych` restent
 *  réservés aux PNJ de la scène (Peur/Terreur EXCLUES hors combat par design, cf. `engine/encounterPsych` :
 *  cet Effet est le seul déclencheur volontaire de l'auteur, pas une ré-activation automatique). No-op en
 *  combat ou si une cascade est déjà ouverte. */
export function openScriptedPsych(get: Get, set: Set, kind: 'peur' | 'terreur', indice: number, label: string, heroes: Combatant[]): void {
  const s = get();
  if (s.battle || s.pendingCascade) return;
  const sourceId = `scripted:${label}`;
  const steps: CascadeStep[] = [];
  for (const hero of heroes) {
    if (hero.dead || isPsychImmune(hero)) continue;
    const td = findPsychologyById(kind)?.test;
    const skill = td?.skill ?? 'calme';
    const base = skillBaseValue(hero, skill);
    const target = base + DIFFICULTY_MODIFIERS[td?.difficulty ?? 'intermediaire'];
    steps.push({
      id: `psych-${hero.id}`,
      kind: 'encounterPsych',
      actorId: hero.id,
      icon: kind === 'terreur' ? 'creature/scream' : 'flag/fear',
      rollLabel: refLabel('skills', { id: skill }),
      base,
      target,
      label: `${kind === 'terreur' ? 'Terreur' : 'Peur'} ${indice} — ${label}`,
      encounterPsych: { kind, sourceId, sourceName: label, indice },
      stake: combatStakeRef('encounterPsych', { entryId: kind, values: { indice } }),
    });
  }
  if (!steps.length) return;
  startCascade(get, set, { title: 'Sang-froid', icon: 'flag/fear', purpose: 'test', steps });
}

/** Conséquence d'un Test de Calme de rencontre : pose le `psychState` (Brisé de Terreur dérivé du DR).
 *  La résolution kind-agnostique (`rollTest(Calme)`) est faite par `FLOWS.cascade` ; ici on interprète
 *  le résultat par `kind`. Issue de modale = source UNIQUE (`describeEncounterPsych`). */
registerCascadeApplier(
  'encounterPsych',
  (get, set, step, hero) => {
    const ep = step.encounterPsych;
    if (!hero || !step.result || !ep) return;
    const r = step.result;
    hero.psychState ??= [];
    // DÉTERMINATION (LDB 17 l.62) : immunité TEMPORAIRE. Pour un Test de rencontre ONE-SHOT (pas de Test
    // étendu), « immune » ≈ « inerte » = même état final qu'un succès (la source ne se re-déclenche pas) :
    // on pose le marqueur INERTE (comme un succès) — pas de Brisé de Terreur, trait ciblé non actif — mais
    // avec une issue distincte au journal (« temporairement insensible »). Cohérent avec l'applier combat.
    const res = psychResolution(ep.kind); // mode + conséquences en DONNÉES (psychology.json)
    if (step.immune) {
      if (res.mode === 'terreur') hero.psychState.push({ type: res.becomes ?? 'peur', sourceId: ep.sourceId, indice: 0, calmeDR: 0 });
      else if (CIBLE_TYPES.has(ep.kind)) hero.psychState.push({ type: ep.kind, cible: ep.cible, sourceId: ep.sourceId, active: false });
      else hero.psychState.push({ type: 'peur', sourceId: ep.sourceId, indice: ep.indice, calmeDR: ep.indice });
      set({ party: [...get().party] });
      return { consequences: freeCons([`${hero.label} est temporairement insensible à la Psychologie (Détermination).`]) };
    }
    const brise = r.success ? 0 : failConditionAmount(res.failAmount, ep.indice, r.sl);
    if (res.mode === 'terreur') {
      if (brise > 0 && res.failCondition) addCondition(hero, res.failCondition, brise);
      if (res.becomes) hero.psychState.push({ type: res.becomes, sourceId: ep.sourceId, indice: r.success ? 0 : ep.indice, calmeDR: 0 }); // la Terreur devient une Peur (LDB 21 l.57)
    } else if (CIBLE_TYPES.has(ep.kind)) {
      hero.psychState.push({ type: ep.kind, cible: ep.cible, sourceId: ep.sourceId, active: !r.success });
    } else {
      hero.psychState.push({ type: 'peur', sourceId: ep.sourceId, indice: ep.indice, calmeDR: r.success ? ep.indice : 0 });
    }
    // Immunités croisées (LDB 21) : un effet psy dominant (Peur/Terreur) annule l'Animosité/Préjugé.
    const superseded = suppressSupersededPsych(hero);
    set({ party: [...get().party] });
    const pe: PendingEncounterPsych = {
      heroId: hero.id, kind: ep.kind, sourceId: ep.sourceId, sourceName: ep.sourceName, indice: ep.indice, cible: ep.cible,
      result: { roll: r.roll, success: r.success, brise, target: r.target, sl: r.sl },
    };
    return { consequences: freeCons([describeEncounterPsych(pe, hero.label), ...superseded.map((tp) => t('turn.psychSuperseded', { name: hero.label, psych: psychologyLabel(tp) }))]) };
  },
);
