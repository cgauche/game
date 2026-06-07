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

/** Type d'attaque naturelle (geste + règle distincts). */
export type AttackKind = 'arme' | 'morsure' | 'caudale' | 'cornes' | 'souffle' | 'tentacules' | 'etreinte';

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
  tentacules: 'Tentacules',
  etreinte: 'Étreinte glaciale',
};

// Règle RAW par type (hors Dégâts/type, lus du libellé). Le 1er match du libellé gagne.
const RULES: Array<{ re: RegExp; kind: AttackKind; base: Omit<CreatureAttack, 'kind' | 'label' | 'bonus' | 'type'> }> = [
  [/^morsure\b/i, 'morsure', { trigger: 'free', avantage: 1 }],
  [/^attaque caudale\b/i, 'caudale', { trigger: 'free', avantage: 1, prone: true }],
  [/^cornes?\b/i, 'cornes', { trigger: 'charge', avantage: 0 }],
  [/^souffle\b/i, 'souffle', { trigger: 'free', avantage: 2, aoe: true, magic: true }],
  [/^tentacules?\b/i, 'tentacules', { trigger: 'free', avantage: 0, entangle: true, perTentacle: true }],
  [/^étreinte glaciale\b/i, 'etreinte', { trigger: 'action', avantage: 2, magic: true }],
  [/^arme\b/i, 'arme', { trigger: 'action', avantage: 0 }],
].map(([re, kind, base]) => ({ re: re as RegExp, kind: kind as AttackKind, base: base as CreatureAttack }));

/** Aspect/Type entre parenthèses (« Souffle +15 (Feu) » → « Feu » ; « (divers) » ignoré). */
function parseType(label: string): string | undefined {
  const m = label.match(/\(([^)]+)\)/);
  const t = m?.[1]?.trim();
  return t && !/divers|au choix/i.test(t) ? t : undefined;
}

/** Attaques naturelles d'une créature à partir de ses traits, avec leurs RÈGLES RAW (ordre préservé). */
export function creatureAttacks(traits: string[]): CreatureAttack[] {
  const out: CreatureAttack[] = [];
  for (const t of traits) {
    for (const { re, kind, base } of RULES) {
      if (re.test(t)) {
        const m = t.match(/[+-]?\d+/);
        out.push({ kind, label: t, bonus: m ? parseInt(m[0], 10) : 0, type: parseType(t), ...base });
        break;
      }
    }
  }
  return out;
}

/** Atout Venin : les Attaques venimeuses infligent l'État Empoisonné sur PB (Difficulté de résistance
 *  par défaut Intermédiaire). Retourne la Difficulté écrite, ou 'intermediaire' si absente. */
export function venomDifficulty(traits: string[]): string | null {
  const v = traits.find((t) => /^venin\b/i.test(t));
  if (!v) return null;
  const m = v.match(/\(([^)]+)\)/);
  return m?.[1]?.trim() ?? 'Intermédiaire';
}
