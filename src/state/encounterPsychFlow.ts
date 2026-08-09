/**
 * Psychologie À LA RENCONTRE, hors combat (couture C, LDB 21). À l'entrée d'une scène, chaque héros
 * face à un PNJ inspirant Peur/Terreur (Taille/statbloc) ou un Trait ciblé (Animosité/Haine/Phobie…)
 * fait un Test de Calme.
 *
 * « Une situation = une modale » (#1117 L1) : une BANDE par entrée de règle mise en jeu — une fenêtre
 * « Animosité (Elfes) », une « Terreur »… — dont la DÉCLARATION (type psy, source, cible, Indice) vit
 * sur l'ÉTAPE et dont les héros concernés sont les RANGÉES (`BatchParticipant`, jets INDÉPENDANTS
 * `aggregate:'none'`). Le jet est le Test de Calme GÉNÉRIQUE de la bande (`FLOWS.cascadeBatch` →
 * `rollTest(Calme)`, kind-agnostique) ; la CONSÉQUENCE (psychState, Brisé de Terreur dérivé du DR)
 * vit dans l'applier `'encounterPsych'`, appliquée RANGÉE PAR RANGÉE. La Détermination (immunité,
 * LDB 17 l.62) est offerte par la coquille via `cascadeBatchDetermine` sur la rangée.
 */
import type { Get, Set } from './flowTypes';
import { Combatant } from '../engine/types';
import { Scene } from './scene';
import type { CascadeStep, BatchParticipant, CascadeRoll } from './pendings';
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
import { freeCons, resultLines, type Consequence } from './rollSeam';
import { actorIn } from './combatants';

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

/** DÉCLARATION COMMUNE d'une bande — telle qu'elle vit sur l'ÉTAPE (`CascadeStep.encounterPsych`). */
type PsychBandDecl = NonNullable<CascadeStep['encounterPsych']>;

/** Un Test DÛ par un héros, avant regroupement : le héros, la déclaration de règle qui l'appelle, et
 *  la présentation qui en découle (icône/libellé — communes à toute la bande). */
interface PsychDue { hero: Combatant; decl: PsychBandDecl; icon: string; label: string }

/** RANGÉE d'une bande : le Test de CE héros. Paramètres EN DONNÉES (`psychology.json` `test`) —
 *  compétence (défaut Calme) + difficulté (défaut Intermédiaire), mêmes données que le combat
 *  (`psychStepFor`). */
function psychRow(hero: Combatant, kind: PsychType): BatchParticipant {
  const td = findPsychologyById(kind)?.test;
  const skill = td?.skill ?? 'calme';
  const difficulty = td?.difficulty ?? 'intermediaire';
  const base = skillBaseValue(hero, skill);
  return {
    id: hero.id, interactive: true, result: null,
    label: refLabel('skills', { id: skill }), skillId: skill,
    base, difficulty, target: base + DIFFICULTY_MODIFIERS[difficulty],
  };
}

/**
 * BANDES de Psychologie de rencontre (#1117 L1) — la CLÉ d'une bande EST l'entrée de règle mise en
 * jeu : type psy + source + cible + Indice font UNE fenêtre, dont la déclaration vit sur l'ÉTAPE et
 * dont les héros appelés sont les RANGÉES (jets INDÉPENDANTS, `aggregate:'none'`). L'ordre des bandes
 * est celui de leur première rencontre en parcourant le groupe.
 */
function psychBands(dues: PsychDue[]): CascadeStep[] {
  const bands = new Map<string, CascadeStep>();
  for (const due of dues) {
    const d = due.decl;
    const key = `${d.kind}|${d.sourceId}|${d.cible ?? ''}|${d.indice}`;
    const band = bands.get(key);
    if (band) { band.participants!.push(psychRow(due.hero, d.kind)); continue; }
    bands.set(key, {
      id: `psych-${d.kind}-${bands.size}`, kind: 'encounterPsych', icon: due.icon, label: due.label,
      interactive: true, aggregate: 'none', participants: [psychRow(due.hero, d.kind)],
      encounterPsych: d,
      stake: combatStakeRef('encounterPsych', { entryId: d.kind, values: { indice: d.indice } }),
    });
  }
  return [...bands.values()];
}

/** Ouvre la CASCADE des Tests de Psychologie de rencontre dus (hors combat) — une BANDE par entrée de
 *  règle, une RANGÉE par héros concerné. No-op en combat, si une cascade est déjà ouverte, ou sans
 *  scène/PNJ. Auto-appelé à l'entrée de scène. */
export function openEncounterPsych(get: Get, set: Set): void {
  const s = get();
  if (s.battle || s.pendingCascade || !s.scene) return;
  const npcs = sceneFearSources(s.scene);
  if (!npcs.length) return;
  const dues: PsychDue[] = [];
  for (const hero of s.party) {
    if (hero.dead) continue;
    const trig = encounterPsych(hero, npcs);
    if (!trig) continue;
    const src = npcs.find((n) => n.id === trig.sourceId);
    const cl = CIBLE_TYPES.has(trig.kind) ? CIBLE_LABEL[trig.kind] : null;
    dues.push({
      hero,
      decl: { kind: trig.kind, sourceId: trig.sourceId, sourceName: src?.label ?? '?', indice: trig.indice, cible: trig.cible },
      icon: cl?.icon ?? (trig.kind === 'terreur' ? 'creature/scream' : 'flag/fear'),
      label: cl ? `${cl.label}${trig.cible ? ` (${trig.cible})` : ''}` : `${trig.kind === 'terreur' ? 'Terreur' : 'Peur'} ${trig.indice} — ${src?.label ?? '?'}`,
    });
  }
  const steps = psychBands(dues);
  if (!steps.length) return;
  startCascade(get, set, { title: 'Sang-froid', icon: 'flag/fear', purpose: 'test', steps });
}

/** Ouvre la bande des Tests de Calme pour une source de PEUR/TERREUR SCÉNIQUE (Effet d'auteur
 *  `inflictPsychology` — apparition, présage, vision d'horreur), sur la MÊME machinerie que
 *  `openEncounterPsych` (applier `'encounterPsych'` partagé) — `sceneFearSources`/`encounterPsych` restent
 *  réservés aux PNJ de la scène (Peur/Terreur EXCLUES hors combat par design, cf. `engine/encounterPsych` :
 *  cet Effet est le seul déclencheur volontaire de l'auteur, pas une ré-activation automatique). No-op en
 *  combat ou si une cascade est déjà ouverte. */
export function openScriptedPsych(get: Get, set: Set, kind: 'peur' | 'terreur', indice: number, label: string, heroes: Combatant[]): void {
  const s = get();
  if (s.battle || s.pendingCascade) return;
  const sourceId = `scripted:${label}`;
  const decl: PsychBandDecl = { kind, sourceId, sourceName: label, indice };
  const dues: PsychDue[] = [];
  for (const hero of heroes) {
    if (hero.dead || isPsychImmune(hero)) continue;
    dues.push({
      hero, decl,
      icon: kind === 'terreur' ? 'creature/scream' : 'flag/fear',
      label: `${kind === 'terreur' ? 'Terreur' : 'Peur'} ${indice} — ${label}`,
    });
  }
  const steps = psychBands(dues);
  if (!steps.length) return;
  startCascade(get, set, { title: 'Sang-froid', icon: 'flag/fear', purpose: 'test', steps });
}

/**
 * Conséquence d'un Test de Calme de rencontre POUR UNE RANGÉE : pose le `psychState` (Brisé de Terreur
 * dérivé du DR). La résolution kind-agnostique (`rollTest(Calme)`) est faite par `FLOWS.cascadeBatch` ;
 * ici on interprète le résultat par `kind`. SOURCE UNIQUE de la résolution par héros — l'applier de
 * bande l'appelle pour CHACUNE de ses rangées. Issue de modale = `describeEncounterPsych`. PUR vis-à-vis
 * du store (mute le héros, ne lit rien d'autre) : la rangée porte tout son contexte.
 */
function resolvePsychRow(hero: Combatant, ep: PsychBandDecl, r: CascadeRoll, immune: boolean): Consequence[] {
  hero.psychState ??= [];
  // DÉTERMINATION (LDB 17 l.59) : immunité TEMPORAIRE (« Demeurer immunisé à Psychologie jusqu'à la fin
  // du prochain Round »). Pour un Test de rencontre ONE-SHOT (pas de Test étendu), « immune » ≈ « inerte »
  // = même état final qu'un succès (la source ne se re-déclenche pas) : on pose le marqueur INERTE — pas
  // de Brisé de Terreur, trait ciblé non actif — avec une issue distincte au journal. Ce qui protège le
  // porteur pendant la durée est le marqueur d'immunité lui-même, jamais un Indice à 0 : la Peur héritée
  // d'une Terreur se pose à PLEIN Indice ici aussi (LDB 21 l.56, cf. plus bas), sans quoi l'immunité du
  // Round vaudrait une Peur vaincue à jamais.
  const res = psychResolution(ep.kind); // mode + conséquences en DONNÉES (psychology.json)
  if (immune) {
    if (res.mode === 'terreur') hero.psychState.push({ type: res.becomes ?? 'peur', sourceId: ep.sourceId, indice: ep.indice, calmeDR: 0 });
    else if (CIBLE_TYPES.has(ep.kind)) hero.psychState.push({ type: ep.kind, cible: ep.cible, sourceId: ep.sourceId, active: false });
    else hero.psychState.push({ type: 'peur', sourceId: ep.sourceId, indice: ep.indice, calmeDR: ep.indice });
    return freeCons([`${hero.label} est temporairement insensible à la Psychologie (Détermination).`]);
  }
  const brise = r.success ? 0 : failConditionAmount(res.failAmount, ep.indice, r.sl);
  if (res.mode === 'terreur') {
    if (brise > 0 && res.failCondition) addCondition(hero, res.failCondition, brise);
    // « Une fois ce Test de Psychologie effectué, la créature cause la Peur » (LDB 21 l.56) : phrase
    // INCONDITIONNELLE — l'exemption du succès (l.54) est scopée à la Terreur SEULE. Plein Indice, jamais
    // 0 : la Peur qui suit s'affronte selon SES règles (son Test étendu, ses malus, l'approche). #1190
    if (res.becomes) hero.psychState.push({ type: res.becomes, sourceId: ep.sourceId, indice: ep.indice, calmeDR: 0 });
  } else if (CIBLE_TYPES.has(ep.kind)) {
    hero.psychState.push({ type: ep.kind, cible: ep.cible, sourceId: ep.sourceId, active: !r.success });
  } else {
    hero.psychState.push({ type: 'peur', sourceId: ep.sourceId, indice: ep.indice, calmeDR: r.success ? ep.indice : 0 });
  }
  // Immunités croisées (LDB 21) : un effet psy dominant (Peur/Terreur) annule l'Animosité/Préjugé.
  const superseded = suppressSupersededPsych(hero);
  const pe: PendingEncounterPsych = {
    heroId: hero.id, kind: ep.kind, sourceId: ep.sourceId, sourceName: ep.sourceName, indice: ep.indice, cible: ep.cible,
    result: { roll: r.roll, success: r.success, brise, target: r.target, sl: r.sl },
  };
  return freeCons([describeEncounterPsych(pe, hero.label), ...superseded.map((tp) => t('turn.psychSuperseded', { name: hero.label, psych: psychologyLabel(tp) }))]);
}

/** Applier de BANDE : la déclaration de règle est celle de l'ÉTAPE, la conséquence se joue RANGÉE PAR
 *  RANGÉE (résultat + Détermination du porteur), et chaque verdict reste SUR SA rangée (le portrait
 *  attribue) — jamais un agrégat (`aggregate:'none'`). */
registerCascadeApplier('encounterPsych', (get, set, step) => {
  const ep = step.encounterPsych;
  if (!ep || !step.participants) return;
  for (const part of step.participants) {
    const hero = actorIn(get(), part.id);
    if (!hero || !part.result) { part.outcome = []; continue; }
    const lines = resultLines(resolvePsychRow(hero, ep, part.result, !!part.immune));
    part.outcome = lines;
    for (const l of lines) get().log(l.text);
  }
  set({ party: [...get().party] });
  return { consequences: [] };
});
