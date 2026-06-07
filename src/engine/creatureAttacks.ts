/**
 * Attaques d'une créature DÉRIVÉES DE SES TRAITS (data, pas d'invention) — Livre de base,
 * « Traits » p.338+. Un trait d'attaque liste une attaque naturelle distincte (Morsure,
 * Attaque caudale, Cornes, Souffle, Tentacules, Arme = griffes/arme naturelle, Étreinte
 * glaciale). Le Venin n'est PAS une attaque à part : c'est un Atout de la Morsure → exclu ici.
 *
 * Source UNIQUE pour : le feedback d'animation (un geste par attaque) ET, à terme, le choix
 * d'attaque en combat. Pur et testé.
 */

/** Type d'attaque naturelle (geste distinct). */
export type AttackKind = 'arme' | 'morsure' | 'caudale' | 'cornes' | 'souffle' | 'tentacules' | 'etreinte';

export interface CreatureAttack {
  kind: AttackKind;
  /** Libellé canonique du trait (« Morsure +10 », « Attaque caudale +9 »…). */
  label: string;
  /** Indice de Dégâts (« +N ») si présent, sinon 0. */
  bonus: number;
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

// Trait (préfixe de libellé) → type d'attaque. Ordre = priorité (le 1er match gagne).
const TRAIT_ATTACK: [RegExp, AttackKind][] = [
  [/^morsure\b/i, 'morsure'],
  [/^attaque caudale\b/i, 'caudale'],
  [/^cornes?\b/i, 'cornes'],
  [/^souffle\b/i, 'souffle'],
  [/^tentacules?\b/i, 'tentacules'],
  [/^étreinte glaciale\b/i, 'etreinte'],
  [/^arme\b/i, 'arme'],
];

/** Attaques naturelles d'une créature à partir de ses traits (ordre des traits préservé). */
export function creatureAttacks(traits: string[]): CreatureAttack[] {
  const out: CreatureAttack[] = [];
  for (const t of traits) {
    for (const [re, kind] of TRAIT_ATTACK) {
      if (re.test(t)) {
        const m = t.match(/[+-]?\d+/);
        out.push({ kind, label: t, bonus: m ? parseInt(m[0], 10) : 0 });
        break;
      }
    }
  }
  return out;
}
