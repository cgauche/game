/**
 * Évaluation d'un `FlowTest`/`Condition` EN COMBAT — briques PURES partagées par les trois voies de
 * résolution d'un Test déclenché (étape de cascade héros `triggeredTest`, jet inline ennemi/auto
 * `resolveFlowTest`, jet inline hors-cascade `resolveInlineFlowTest`). SOURCE UNIQUE : la vue d'acteur,
 * le `ConditionCtx` de combat et le calcul de gate vivent ICI (aucune copie par site).
 *
 * Module FEUILLE : n'importe RIEN de combatFlow/combatEffects (que des briques engine + le modèle `flow`)
 * → aucun cycle. Réutilisé par `combatEffects` (runPureFlowLines), `triggeredEffects` (resolveInlineFlowTest)
 * et `combat/triggeredTest` (resolveFlowTest / simpleTriggeredTestStep).
 */
import { type Combatant, type CharKey, CHAR_KEYS } from '../../engine/types';
import { effectiveChar } from '../../engine/characteristics';
import { SIZE_ORDER, effectiveSize } from '../../engine/size';
import { campOf } from '../../engine/relations';
import { aggregateCapabilities, chaosDomainOf } from '../../engine/combatFeatures/dispatch';
import { immunityTypes } from '../../engine/traits/dispatch';
import { groupMatch } from '../../engine/groups';
import type { GameOp, OpsCtx } from '../../engine/ops';
import { certainFlowOps, evalCondition } from '../../engine/flowCore';
import { type ActorView, type Condition, type ConditionCtx, type Flow, type FlowTest, flowTestGateOpen, flowHasTest } from '../flow';

/** Vue d'un combattant pour les Conditions d'acteur (`compare`/`relation`/`has`/`capability`) : PB +
 *  Taille/Avantage + camp + appartenances (Groupes/Talents/Traits) + valeur d'États par nom + niveau des
 *  Capacités de combat agrégées. SOURCE UNIQUE (combat) — remplace les copies de combatEffects/triggeredTest. */
export function buildActorView(c: Combatant | undefined): ActorView | undefined {
  return c ? {
    id: c.id, woundsCurrent: c.wounds.current, woundsMax: c.wounds.max, size: SIZE_ORDER[effectiveSize(c.size)],
    advantage: c.advantage ?? 0, camp: campOf(c),
    groups: c.groups ?? [], talents: (c.talents ?? []).map((t) => ({ id: t.talentId, spec: t.spec })), traits: (c.traits ?? []).map((t) => t.id),
    conditions: Object.fromEntries(c.conditions.map((x) => [x.id, x.value ?? 1])), capabilities: aggregateCapabilities(c),
    ...(chaosDomainOf(c) ? { chaosDomain: chaosDomainOf(c) } : {}),
    // États psy ACTIFS (un trait ciblé RÉSISTÉ — `active:false` — ne compte pas comme « possédé »).
    psych: (c.psychState ?? []).filter((p) => p.active !== false).map((p) => p.type),
    chars: Object.fromEntries(CHAR_KEYS.map((k) => [k, effectiveChar(c, k)])) as Record<CharKey, number>,
  } : undefined;
}

/** `ConditionCtx` de combat construit d'un combattant + de l'`OpsCtx` de la touche/du Round (géométrie
 *  d'arène, sl/location/woundsDealt…). Pour les résolveurs INLINE sans `ExecCtx` (resolveInlineFlowTest /
 *  l'évaluation d'un `gate`). `target` = le combattant qui jette ; `caster` = le porteur (ctx.caster). */
export function combatConditionCtx(c: Combatant, ctx: OpsCtx): ConditionCtx {
  return {
    flags: {}, gameTime: ctx.now ?? 0, party: [c], sl: ctx.sl,
    location: ctx.location, woundsDealt: ctx.woundsDealt, engagedAdvantageGap: ctx.engagedAdvantageGap, engagedAdvantageLead: ctx.engagedAdvantageLead,
    attackKind: ctx.attackKind, startleCause: ctx.startleCause,
    foeInLoS: ctx.foeInLoS, hiddenFromFoes: ctx.hiddenFromFoes, engaged: ctx.engaged, nearestFoeDist: ctx.nearestFoeDist,
    target: buildActorView(c), caster: buildActorView(ctx.caster),
  };
}

/**
 * ALLOWLIST des familles de Condition tranchables HORS EXÉCUTION, sur le seul instantané d'ACTEUR :
 * appartenances (`has` group/talent/trait), camp/relation, niveau de Capacité de combat. Elles ont
 * trois propriétés que les autres n'ont pas : elles ne lisent QUE la vue d'acteur (`buildActorView`),
 * elles ne dépendent d'aucun contexte de résolution (DR du jet, localisation touchée, Blessures
 * infligées, géométrie d'arène, drapeaux/horloge/bourse de scène), et aucune op AMONT du même `seq`
 * ne les retourne.
 *
 * TOUT le reste est INCONNAISSABLE à l'affichage et doit le DIRE (`undefined`) :
 *  · `slThreshold` — le DR du jet n'existe qu'À LA résolution (Cautériser : « −6 DR ⇒ Inconscient », LDB 48 l.219) ;
 *  · `compare` — son sujet est mutable par une op amont du MÊME `seq` (récupération d'États : « une
 *    fois débarrassé de TOUT État Sonné » se lit APRÈS le retrait, LDB 16 l.129) ;
 *  · `engaged`/`nearestFoe`/`foeInLoS`/`hiddenFromFoes`/`location`/`attackKind`/`woundsDealt`/
 *    `startleCause`/`engagedAdvantage*` — contexte de la touche ou de l'arène, absent ici ;
 *  · `flag`/`time`/`money`/`hasItem`/`skill`/`career`/`species`/`status`/`partyDead`/`crewTest`/
 *    `casterChaosDomain`/`has psych` — état de SCÈNE ou état psy actif, hors instantané d'acteur.
 * Un évaluateur TOTAL répondrait `false` sur tout ceci et ferait annoncer la branche `else` : c'est
 * l'encadré qui ENSEIGNE une règle amputée, l'anti-but de #1117.
 */
const STABLE_COND_KINDS = new Set<Condition['kind']>(['always', 'relation', 'capability']);

/** Verdict d'une Condition à l'AFFICHAGE : `true`/`false` seulement pour l'allowlist ci-dessus (dont
 *  les composés `all`/`any`/`not` dont TOUS les membres sont eux-mêmes tranchables) ; `undefined`
 *  sinon. La sémantique n'est jamais réécrite ici : elle reste celle d'`evalCondition` (source
 *  unique) — cette fonction ne décide QUE de ce qui est légitimement décidable. PURE. */
export function stableCondVerdict(cond: Condition, cc: ConditionCtx): boolean | undefined {
  if (cond.kind === 'all' || cond.kind === 'any') {
    const parts = cond.of.map((c) => stableCondVerdict(c, cc));
    if (parts.some((p) => p === undefined)) return undefined;
    return cond.kind === 'all' ? parts.every(Boolean) : parts.some(Boolean);
  }
  if (cond.kind === 'not') {
    const v = stableCondVerdict(cond.of, cc);
    return v === undefined ? undefined : !v;
  }
  // `has psych` EXCLU de la famille `has` : un trait psychologique s'active/se résout en cours de
  // séquence (`psychState.active`), il n'est pas une appartenance figée comme un Talent ou un Trait.
  const stable = STABLE_COND_KINDS.has(cond.kind) || (cond.kind === 'has' && cond.what !== 'psych');
  return stable ? evalCondition(cond, cc) : undefined;
}

/**
 * OPS CERTAINES d'une branche de Test EN COMBAT, repliée contre le combattant qui la SUBIRA (#1117) —
 * SOURCE UNIQUE du bloc « Réussite / Échec » d'une étape de combat : la surface d'AVANT le jet et le
 * verdict d'APRÈS lisent la MÊME dérivation, sur les MÊMES objets d'op.
 *
 * Le contexte d'évaluation n'est PAS celui d'un résolveur (aucun DR, aucune géométrie de touche : ils
 * n'existent pas avant le jet) — c'est un instantané d'ACTEUR. L'oracle est donc PARTIEL
 * (`stableCondVerdict`) : il ne tranche que les Conditions d'appartenance/camp/capacité, et déclare
 * ne pas savoir pour les autres. Ce qui reste incertain (un `if` non tranchable, un second jet, un
 * choix) rend `undefined`, et la surface se TAIT plutôt que d'annoncer une issue par défaut.
 */
export function branchCertainOps(branch: Flow | undefined, target: Combatant | undefined, caster?: Combatant): GameOp[] | undefined {
  if (!branch) return undefined;
  if (!target) return certainFlowOps(branch);
  const cc = combatConditionCtx(target, { caster });
  return certainFlowOps(branch, (cond) => stableCondVerdict(cond, cc));
}

/** Catégorie Codex d'une appartenance `has` — l'entité de la Condition est une FICHE, et laquelle se
 *  déduit du `what` (aucun id d'entité en code). Les autres `what` (`group`, `psych`…) n'ont pas de
 *  fiche d'objet mécanique à ouvrir : ils restent hors de cette table, donc au silence. */
const HAS_CATEGORY: Partial<Record<string, string>> = { talent: 'talents', trait: 'traits' };

/**
 * ENTITÉ RESPONSABLE de l'indécidabilité d'une branche (#1117, arbitrage user 2026-08-07 « Chip du
 * talent ») — quand une branche ne peut RIEN promettre parce qu'un `if` d'APPARTENANCE (Condition
 * `has` talent/trait, la famille STABLE de `stableCondVerdict`) donne la main à un second jet, ce
 * n'est pas un inconnu : c'est CET objet mécanique qui prend le relais, et sa fiche dit lequel.
 * On rend donc son identité (`{category, id}`, dérivée de `cond.what`/`cond.value` — aucun talent
 * nommé en code) pour que la surface affiche SA chip au lieu de se taire.
 *
 * Fail-closed conservé pour tout le reste : une branche indécidable pour une AUTRE raison (seuil de
 * DR, `compare` mutable par une op amont, contexte de touche absent, choix joueur) rend `undefined`
 * — l'objet responsable n'y est pas identifiable, et une chip inventée y enseignerait un faux.
 * Rend aussi `undefined` quand la branche EST décidable (il y a alors des ops à montrer). PURE.
 */
export function branchBlockingEntity(
  branch: Flow | undefined, target: Combatant | undefined, caster?: Combatant,
): { category: string; id: string } | undefined {
  if (!branch || !target || branch.kind !== 'if') return undefined;
  if (branchCertainOps(branch, target, caster) !== undefined) return undefined; // décidable : ses ops parlent
  const cond = branch.cond;
  if (cond.kind !== 'has') return undefined;
  const category = HAS_CATEGORY[cond.what];
  if (!category || typeof cond.value !== 'string') return undefined;
  const cc = combatConditionCtx(target, { caster });
  const verdict = stableCondVerdict(cond, cc);
  if (verdict === undefined) return undefined; // appartenance elle-même indécidable → silence
  // La branche EFFECTIVEMENT prise doit être celle qui rend la main à un second jet : c'est le Test
  // qui suspend la promesse, pas l'appartenance. Sans lui, l'indécidabilité vient d'ailleurs.
  const taken = verdict ? branch.then : branch.else;
  return taken && flowHasTest(taken) ? { category, id: cond.value } : undefined;
}

/** Le Test est-il SAUTÉ (no-op : ni étape ni branche) pour `c` ? Réunit les gates op-level historiques
 *  (`unlessImmune`/`onlyGroups`/`exceptGroups`) et la GATE générique de Condition (`gate`, Brisé : « pas
 *  Engagé OU Cœur vaillant, ET pions restants »). SOURCE UNIQUE — voie cascade (resolveFlowTest) et voie
 *  inline (resolveInlineFlowTest) la partagent → décision de gate identique. */
export function flowTestGated(ft: FlowTest, c: Combatant, cc: ConditionCtx): boolean {
  return (ft.unlessImmune != null && immunityTypes(c.traits ?? []).some((ty) => ty.includes(ft.unlessImmune!.toLowerCase())))
    || (ft.onlyGroups != null && !ft.onlyGroups.some((g) => groupMatch(g, c.groups ?? [])))
    || (ft.exceptGroups != null && ft.exceptGroups.some((g) => groupMatch(g, c.groups ?? [])))
    || !flowTestGateOpen(ft, cc);
}
