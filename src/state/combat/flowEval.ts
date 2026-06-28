/**
 * Évaluation d'un `FlowTest`/`Condition` EN COMBAT — briques PURES partagées par les trois voies de
 * résolution d'un Test déclenché (étape de cascade héros `triggeredTest`, jet inline ennemi/auto
 * `resolveFlowTest`, jet inline hors-cascade `resolveInlineFlowTest`). SOURCE UNIQUE : la vue d'acteur,
 * le `ConditionCtx` de combat et le calcul de gate vivent ICI (plus de copie par site).
 *
 * Module FEUILLE : n'importe RIEN de combatFlow/combatEffects (que des briques engine + le modèle `flow`)
 * → aucun cycle. Réutilisé par `combatEffects` (runSpellFlowLines), `triggeredEffects` (resolveInlineFlowTest)
 * et `combat/triggeredTest` (resolveFlowTest / simpleTriggeredTestStep).
 */
import { type Combatant, type CharKey, CHAR_KEYS } from '../../engine/types';
import { effectiveChar } from '../../engine/characteristics';
import { SIZE_ORDER, effectiveSize } from '../../engine/size';
import { campOf } from '../../engine/relations';
import { aggregateCapabilities } from '../../engine/combatFeatures/dispatch';
import { immunityTypes } from '../../engine/traits/dispatch';
import { groupMatch } from '../../engine/groups';
import type { OpsCtx } from '../../engine/ops';
import { type ActorView, type ConditionCtx, type FlowTest, flowTestGateOpen } from '../flow';

/** Vue d'un combattant pour les Conditions d'acteur (`compare`/`relation`/`has`/`capability`) : PB +
 *  Taille/Avantage + camp + appartenances (Groupes/Talents/Traits) + valeur d'États par nom + niveau des
 *  Capacités de combat agrégées. SOURCE UNIQUE (combat) — remplace les copies de combatEffects/triggeredTest. */
export function buildActorView(c: Combatant | undefined): ActorView | undefined {
  return c ? {
    id: c.id, woundsCurrent: c.wounds.current, woundsMax: c.wounds.max, size: SIZE_ORDER[effectiveSize(c.size)],
    advantage: c.advantage ?? 0, camp: campOf(c),
    groups: c.groups ?? [], talents: (c.talents ?? []).map((t) => ({ id: t.talentId, spec: t.spec })), traits: (c.traits ?? []).map((t) => t.id),
    conditions: Object.fromEntries(c.conditions.map((x) => [x.name, x.value ?? 1])), capabilities: aggregateCapabilities(c),
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
