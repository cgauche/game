/**
 * Attaques d'une créature DÉRIVÉES DE SES TRAITS (data, RAW — Livre de base, « Traits » p.338+).
 * Un trait d'attaque liste une attaque naturelle distincte avec ses RÈGLES PRÉCISES (coût en
 * Avantage, déclenchement, effets). On ne modélise QUE ce que le trait écrit ; rien d'inventé.
 *
 * Règles encodées (citations RAW) :
 *  - Arme (Indice)           : arme de base (dents/griffes). Action normale. Dégâts = Indice (BF inclus).
 *  - Morsure (Indice)        : « Attaque gratuite en dépensant 1 Avantage ». Dégâts = Indice.
 *  - Attaque caudale (Indice): « Attaque gratuite … 1 Avantage ». Cible de TAILLE INFÉRIEURE qui
 *                              perd des PB → État À Terre. Dégâts = Indice.
 *  - Cornes (Indice)(Aspect) : « Quand la créature gagne un Avantage pour Charger, … Attaque
 *                              gratuite de Cornes ». Déclenchée à la CHARGE (pas de coût d'Avantage).
 *  - Souffle (Indice)(Type)  : « au prix de 2 Avantages … Attaque gratuite ». ZONE, Test opposé
 *                              CT/Esquive, Dégâts = Indice ; effets par Type ; Attaque MAGIQUE.
 *  - Tentacules (Indice)     : « une Action d'Attaque gratuite PAR tentacule » (# tentacules ; pas
 *                              de coût d'Avantage). Sur Dégâts → Empêtré (Empoignade).
 *  - Étreinte glaciale       : « au prix de 2 Avantages ET de son Action ». Test opposé CC ; succès
 *                              → 1d10 + DR Blessures ignorant BE et PA. Attaque MAGIQUE.
 *  - Venin (Difficulté)      : PAS une attaque — Atout : sur PB infligés, la cible subit Empoisonné.
 */
import { asTrait } from './traits/dispatch';
import type { TraitInstance, TraitList } from './statEntry';

/** Type d'attaque naturelle (geste + règle distincts). */
export type AttackKind = 'arme' | 'morsure' | 'caudale' | 'cornes' | 'souffle' | 'vomi' | 'tentacules' | 'etreinte' | 'regard' | 'langue' | 'hurlement';

/** Déclenchement RAW : action normale, gratuite (coût en Avantage), ou gratuite à la Charge. */
export type AttackTrigger = 'action' | 'free' | 'charge';

export interface CreatureAttack {
  kind: AttackKind;
  /** Libellé canonique du trait (« Morsure +10 », « Attaque caudale +9 »…). */
  label: string;
  /** Indice de Dégâts (« +N », BF inclus) si présent, sinon 0. */
  bonus: number;
  /** Comment l'attaque se déclenche (cf. RAW). */
  trigger: AttackTrigger;
  /** Coût en Avantage de l'Attaque gratuite (0 pour action/charge/tentacule). */
  avantage: number;
  /** Cible de Taille INFÉRIEURE qui perd des PB → À Terre (Attaque caudale). */
  prone?: boolean;
  /** Sur Dégâts → État Empêtré + Empoignade (Tentacules). */
  entangle?: boolean;
  /** Attaque de ZONE, Test opposé CT/Esquive (Souffle). */
  aoe?: boolean;
  /** Attaque magique (Souffle, Étreinte glaciale) → soumise à la Résistance à la Magie, etc. */
  magic?: boolean;
  /** Une Attaque gratuite PAR tentacule (le nombre dépend de la créature). */
  perTentacle?: boolean;
  /** Nombre porté EN TÊTE du trait (« 8 Tentacules +9 » — « # Tentacules (Indice) », LDB 85 l.354). */
  count?: number;
  /** Aspect/Type entre parenthèses (Souffle : Feu/Froid/Corrosif/… ; Cornes : Aspect). */
  type?: string;
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

type AttackBase = Omit<CreatureAttack, 'kind' | 'label' | 'bonus' | 'type' | 'count'>;

// Règle RAW par CLÉ CANONIQUE d'attaque (la clé est produite par `parseTraitInstance` → casse/pluriel
// déjà normalisés ; plus de regex de préfixe). Ajouter une attaque naturelle = 1 entrée ici + son
// libellé dans `EXTRA_TRAIT_LABELS` (dispatch). Dégâts/type/compte sont lus de l'instance, pas réécrits.
const RULES: Record<string, { kind: AttackKind; base: AttackBase }> = {
  Morsure: { kind: 'morsure', base: { trigger: 'free', avantage: 1 } },
  'Attaque caudale': { kind: 'caudale', base: { trigger: 'free', avantage: 1, prone: true } },
  Cornes: { kind: 'cornes', base: { trigger: 'charge', avantage: 0 } },
  Souffle: { kind: 'souffle', base: { trigger: 'free', avantage: 2, aoe: true, magic: true } },
  Vomissement: { kind: 'vomi', base: { trigger: 'free', avantage: 3, aoe: true } }, // Troll : 3 Av, zone, corrosif + Sonné
  'Langue préhensile': { kind: 'langue', base: { trigger: 'free', avantage: 1, entangle: true } }, // Jabberslythe : gratuite 1 Av, à distance, Indice + Empêtré
  'Hurlement fantomatique': { kind: 'hurlement', base: { trigger: 'free', avantage: 2, aoe: true } }, // Banshee : gratuit, tous les Av (min 2), zone
  'Regard pétrifiant': { kind: 'regard', base: { trigger: 'action', avantage: 1 } }, // Action, ≥1 Av (CT/Init, pétrifie)
  Tentacules: { kind: 'tentacules', base: { trigger: 'free', avantage: 0, entangle: true, perTentacle: true } },
  'Étreinte glaciale': { kind: 'etreinte', base: { trigger: 'action', avantage: 2, magic: true } },
  Arme: { kind: 'arme', base: { trigger: 'action', avantage: 0 } },
};

/** Libellé canonique d'une attaque reconstruit depuis l'instance (la donnée structurée n'a plus de
 *  chaîne brute) : « Morsure +10 », « 8 Tentacules +9 », « Souffle +15 (Feu) ». L'Indice de Dégâts
 *  s'affiche signé (c'est un bonus). */
function attackLabel(t: TraitInstance): string {
  let s = t.count != null ? `${t.count} ${t.key}` : t.key;
  if (t.value != null) s += ` +${t.value}`;
  if (t.arg) s += ` (${t.arg})`;
  return s;
}

/** Attaques naturelles d'une créature à partir de ses traits, avec leurs RÈGLES RAW (ordre préservé).
 *  La clé canonique (`asTrait`) sélectionne la règle ; compte/Dégâts/type sont lus de l'instance
 *  (« 8 Tentacules +9 » → compte 8, Dégâts 9 ; « Souffle +15 (Feu) » → Dégâts 15, type Feu — LDB 85
 *  l.354). Aucun parsing quand la donnée est déjà structurée. */
export function creatureAttacks(traits: TraitList): CreatureAttack[] {
  const out: CreatureAttack[] = [];
  for (const x of traits) {
    const inst = asTrait(x);
    const rule = RULES[inst.key];
    if (!rule) continue;
    const type = inst.arg && !/divers|au choix/i.test(inst.arg) ? inst.arg : undefined;
    out.push({ kind: rule.kind, label: attackLabel(inst), bonus: inst.value ?? 0, type, ...(inst.count != null ? { count: inst.count } : {}), ...rule.base });
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
