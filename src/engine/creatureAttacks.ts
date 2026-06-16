/**
 * Attaques d'une créature DÉRIVÉES DE SES TRAITS (data, RAW — Livre de base, « Traits » p.338+).
 * Un trait d'attaque OCTROIE une/des MANŒUVRE(S) de 1ʳᵉ classe (`TraitData.grantsManeuvers` → dataset
 * `maneuvers`). `creatureAttacks` résout ces octrois par id (`findManeuverById`) et porte sur chaque
 * `CreatureAttack` la `ManeuverDef` ENTIÈRE (résolue ENSUITE par `state/combatManeuvers.resolveManeuver`)
 * + l'`indice` (le `+N` de l'instance de trait). On ne modélise QUE ce que la donnée écrit ; rien d'inventé.
 *
 * Le trait `Souffle` octroie les 6 souffles élémentaires ; la DÉSAMBIGUÏSATION est GÉNÉRIQUE : on choisit
 * la manœuvre dont le suffixe d'id (`souffle-feu`…) correspond à `norm(arg)` (« Feu » → souffle-feu),
 * sinon le défaut élémentaire `souffle-feu` (exotiques arbitrés MJ). Aucun regex « (Type) » en dur.
 */
import { asTrait, formatTrait } from './traits/dispatch';
import { traitByLabel, findManeuverById, type ManeuverDef } from '../data';
import { norm } from '../lib/normalize';
import type { TraitList } from './statEntry';

/** Type d'attaque naturelle (geste + règle distincts). Sert UNIQUEMENT à l'anim/pose/icône. */
export type AttackKind = 'arme' | 'morsure' | 'caudale' | 'cornes' | 'souffle' | 'vomi' | 'tentacules' | 'etreinte' | 'regard' | 'langue' | 'hurlement';

/** Déclenchement RAW : action normale, gratuite (coût en Avantage), ou gratuite à la Charge. */
export type AttackTrigger = 'action' | 'free' | 'charge';

export interface CreatureAttack {
  kind: AttackKind;
  /** Libellé canonique du trait (« Morsure +10 », « Attaque caudale +9 »…). */
  label: string;
  /** Indice de Dégâts (« +N », BF inclus) si présent, sinon 0 — lu de l'INSTANCE du trait. */
  bonus: number;
  /** Alias explicite de `bonus` pour la résolution de Dégâts (`{indiceOf}`) — l'Indice de la manœuvre. */
  indice: number;
  /** Comment l'attaque se déclenche (dérivé de `def.activation`). */
  trigger: AttackTrigger;
  /** Coût en Avantage de l'Attaque gratuite (dérivé de `def.advantageCost`). */
  avantage: number;
  /** Caractéristique du jet d'attaquant (CC mêlée / CT distance·zone) ; absent = pas de jet
   *  d'attaquant (Hurlement : chaque cible teste sa Résistance). */
  stat?: 'CC' | 'CT';
  /** Gestion de l'Avantage dépensé : `fixed` (défaut) / `variable` (Regard) / `all` (Hurlement). */
  advantageMode?: 'fixed' | 'variable' | 'all';
  /** Attaque de ZONE (Souffle/Vomi) — dérivé de `def.targeting === 'zone'`. */
  aoe?: boolean;
  /** Attaque magique (Souffle, Étreinte glaciale). */
  magic?: boolean;
  /** Une Attaque gratuite PAR tentacule (le résolveur n'en dépend pas ; l'IA boucle dessus). */
  perTentacle?: boolean;
  /** Nombre porté EN TÊTE du trait (« 8 Tentacules +9 » → 8). */
  count?: number;
  /** Aspect/Type entre parenthèses (Souffle : Feu/Froid/… ; affiché au feed). */
  type?: string;
  /** La MANŒUVRE de 1ʳᵉ classe résolue (profil + effets AUTHORÉS) — source de TOUTE la résolution. */
  def: ManeuverDef;
}

/** Libellé canonique d'attaque (FR, court) pour l'UI/galerie. */
export const ATTACK_LABEL: Record<AttackKind, string> = {
  morsure: 'Morsure',
  caudale: 'Attaque caudale',
  cornes: 'Cornes',
  arme: 'Arme / griffes',
  souffle: 'Souffle',
  vomi: 'Vomissement',
  tentacules: 'Tentacules',
  etreinte: 'Étreinte glaciale',
  regard: 'Regard pétrifiant',
  langue: 'Langue préhensile',
  hurlement: 'Hurlement fantomatique',
};

/** Choisit, parmi les manœuvres octroyées par un trait, celle qui correspond à l'argument de l'instance
 *  (Souffle « (Feu) » → `souffle-feu`). Désambiguïsation GÉNÉRIQUE par suffixe d'id ; défaut = 1ʳᵉ
 *  octroyée (un seul grant → elle ; Souffle exotique sans correspondance → `souffle-feu`, en tête). */
function pickGranted(ids: string[], arg?: string): ManeuverDef | undefined {
  if (ids.length === 1) return findManeuverById(ids[0]);
  const a = norm(arg ?? '').trim();
  const match = a ? ids.find((id) => norm(id).endsWith(a)) : undefined;
  return findManeuverById(match ?? ids[0]);
}

/** Attaques naturelles d'une créature à partir de ses traits : chaque trait d'attaque OCTROIE sa/ses
 *  manœuvre(s) (`grantsManeuvers`) ; on résout chaque octroi en `CreatureAttack` portant la `ManeuverDef`
 *  + l'Indice/compte/type lus de l'INSTANCE. Le libellé est reconstruit par `formatTrait`. Ajouter une
 *  attaque naturelle = un dataset `maneuvers` + un `grantsManeuvers` dans `traits.json` (plus de table). */
export function creatureAttacks(traits: TraitList): CreatureAttack[] {
  const out: CreatureAttack[] = [];
  for (const x of traits) {
    const inst = asTrait(x);
    const grants = traitByLabel.get(inst.key)?.grantsManeuvers;
    if (!grants?.length) continue;
    const def = pickGranted(grants.map((r) => r.id), inst.arg);
    if (!def) continue;
    const type = inst.arg && !/divers|au choix/i.test(inst.arg) ? inst.arg : undefined;
    const indice = inst.value ?? 0;
    out.push({
      kind: def.kind, label: formatTrait(inst), bonus: indice, indice, type, def,
      trigger: def.activation, avantage: def.advantageCost,
      ...(def.stat ? { stat: def.stat } : {}), ...(def.advantageMode ? { advantageMode: def.advantageMode } : {}),
      ...(inst.count != null ? { count: inst.count } : {}),
      ...(def.targeting === 'zone' ? { aoe: true } : {}), ...(def.magic ? { magic: true } : {}),
      ...(def.kind === 'tentacules' ? { perTentacle: true } : {}),
    });
  }
  return out;
}

/** Atout Venin : les Attaques venimeuses infligent l'État Empoisonné sur PB (Difficulté de résistance
 *  par défaut Intermédiaire). Retourne la Difficulté écrite, ou 'Intermédiaire' si absente. */
export function venomDifficulty(traits: TraitList): string | null {
  for (const x of traits) {
    const inst = asTrait(x);
    if (inst.key === 'Venin') return inst.arg ?? 'Intermédiaire';
  }
  return null;
}
