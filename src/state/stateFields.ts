/**
 * Manifeste des CHAMPS TRANSITOIRES du store (pendings, modales de jet, files de révélation,
 * vue éphémère…) — SOURCE UNIQUE de leur valeur initiale ET des contextes qui les réinitialisent.
 *
 * Avant ce manifeste, chaque champ `pending*` était re-listé À LA MAIN sur plusieurs sites de reset
 * (état initial `create()`, `transitionTo` = changement de scène, `startCombat` = ouverture de combat),
 * soit ~3 copies hand-tunées et désynchronisables (un pending remis à null dans un site mais pas
 * l'autre = régression silencieuse). Ici : UN tableau, deux dérivés.
 *
 * - `initialFields()` : le bloc `{ champ: init }` complet — l'état `create()` le spread (forme à plat
 *   IDENTIQUE : `snapshotSave`/coop itèrent `Object.keys(getInitialState())`, indépendant de l'ordre).
 * - `resetFields(scope)` : le sous-ensemble `{ champ: init }` des champs dont `resetOn` inclut `scope`.
 *   Les sites de reset font `set({ ...resetFields('scene'), …spécifique })` au lieu de re-lister.
 *
 * INVARIANT : `resetFields(scope)` reproduit EXACTEMENT le patch (clés + valeurs) que le site faisait
 * à la main. Les champs réinitialisés à une valeur ≠ `init` (ex. `pendingReveals` calculé depuis le
 * startMessage d'une transition de scène) restent EXPLICITES hors `resetFields` sur leur site.
 */
import type { GameState } from './store';

/** Contextes de réinitialisation. `scene` = changement de scène (`transitionTo`) ;
 *  `combatStart` = ouverture de combat (`startCombat`). */
export type ResetScope = 'scene' | 'combatStart';

/** Champs transitoires couverts par le manifeste (= le bloc contigu de l'état initial). */
type FieldKey =
  | 'pendingTest' | 'pendingCorruption' | 'pendingBargain' | 'pendingAppraise' | 'pendingAttack'
  | 'actorAim' | 'actorMove' | 'hoverDelta' | 'pendingReload' | 'pendingStateRecovery' | 'pendingDefense'
  | 'pendingRenounce' | 'pendingMountTarget' | 'pendingDisengage' | 'pendingInteract' | 'pendingCast'
  | 'pendingCounterspell' | 'pendingExtendedTest' | 'pendingForceDoor' | 'pendingCascade'
  | 'pendingCastOpposition' | 'pendingHeal' | 'medic' | 'pendingRest' | 'pendingCleave'
  | 'pendingDualStrike' | 'pendingReveals' | 'pendingLogQueue' | 'scheduledEffects' | 'pendingTrample' | 'pendingManeuver'
  | 'pendingRun' | 'pendingApproach' | 'pendingWard' | 'pendingFocus' | 'pendingFrenzy' | 'pendingRoundStart'
  | 'pendingFateSave' | 'pendingVictory' | 'pendingLoot' | 'document' | 'previousScene';

type FieldSpec<K extends FieldKey> = { readonly init: GameState[K]; readonly resetOn: readonly ResetScope[] };
type Manifest = { readonly [K in FieldKey]: FieldSpec<K> };

/** Le manifeste : pour chaque champ, sa valeur initiale et les contextes qui le réinitialisent. */
const STATE_FIELDS: Manifest = {
  pendingTest: { init: null, resetOn: ['scene'] },
  pendingCorruption: { init: null, resetOn: ['scene'] },
  pendingBargain: { init: null, resetOn: [] },
  pendingAppraise: { init: null, resetOn: [] },
  pendingAttack: { init: null, resetOn: ['scene', 'combatStart'] },
  actorAim: { init: null, resetOn: ['combatStart'] },
  actorMove: { init: null, resetOn: ['combatStart'] },
  hoverDelta: { init: null, resetOn: [] },
  pendingReload: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingStateRecovery: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingDefense: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingRenounce: { init: null, resetOn: [] },
  pendingMountTarget: { init: null, resetOn: ['combatStart'] },
  pendingDisengage: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingInteract: { init: null, resetOn: ['scene'] },
  pendingCast: { init: null, resetOn: ['combatStart'] },
  pendingCounterspell: { init: null, resetOn: ['combatStart'] },
  pendingExtendedTest: { init: null, resetOn: [] },
  pendingForceDoor: { init: null, resetOn: [] },
  pendingCascade: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingCastOpposition: { init: null, resetOn: [] },
  pendingHeal: { init: null, resetOn: ['combatStart'] },
  medic: { init: null, resetOn: [] },
  pendingRest: { init: null, resetOn: [] },
  pendingCleave: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingDualStrike: { init: null, resetOn: ['scene'] },
  pendingReveals: { init: [], resetOn: ['combatStart'] },
  pendingLogQueue: { init: [], resetOn: ['scene', 'combatStart'] },
  scheduledEffects: { init: [], resetOn: [] },
  pendingTrample: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingManeuver: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingRun: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingApproach: { init: null, resetOn: ['scene'] },
  pendingWard: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingFocus: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingFrenzy: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingRoundStart: { init: null, resetOn: [] },
  pendingFateSave: { init: null, resetOn: [] },
  pendingVictory: { init: null, resetOn: ['combatStart'] },
  pendingLoot: { init: null, resetOn: [] },
  document: { init: null, resetOn: ['scene'] },
  previousScene: { init: null, resetOn: [] },
};

const FIELD_KEYS = Object.keys(STATE_FIELDS) as FieldKey[];

/** Bloc complet `{ champ: init }` des champs transitoires — assemblé dans l'état initial du store. */
export function initialFields(): Pick<GameState, FieldKey> {
  const out = {} as Pick<GameState, FieldKey>;
  for (const k of FIELD_KEYS) {
    // `init` est une valeur PARTAGÉE du manifeste ; les array (`[]`) sont copiés pour qu'aucune
    // instance de store ne mute le tableau du manifeste (sinon fuite entre parties).
    const v = STATE_FIELDS[k].init;
    (out as Record<FieldKey, unknown>)[k] = Array.isArray(v) ? [...v] : v;
  }
  return out;
}

/** Sous-ensemble `{ champ: init }` des champs dont `resetOn` inclut `scope` — patch de reset. */
export function resetFields(scope: ResetScope): Partial<Pick<GameState, FieldKey>> {
  const out: Partial<Record<FieldKey, unknown>> = {};
  for (const k of FIELD_KEYS) {
    if (!STATE_FIELDS[k].resetOn.includes(scope)) continue;
    const v = STATE_FIELDS[k].init;
    out[k] = Array.isArray(v) ? [...v] : v;
  }
  return out as Partial<Pick<GameState, FieldKey>>;
}
