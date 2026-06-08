import type { MerchantArchetypeDef } from '../types';

/**
 * Médecin / Barbier-chirurgien (LDB 75 « Docteur en médecine » : aide médicale 4-6 pistoles).
 * Vend les soins de l'apothicaire (Herbes et potions, LDB 72) et les Prothèses (membres perdus
 * sur Blessure Critique). Les curatifs essentiels sont GARANTIS en stock (`curated`) : dans un
 * scénario meurtrier (arène), on doit toujours pouvoir acheter de quoi se soigner.
 */
export const merchantArchetype: MerchantArchetypeDef = {
  name: 'medecin',
  label: 'Médecin',
  category: { subTypes: ['Herbes et potions', 'Prothèses'] },
  settlement: 'ville',
  resaleRate: 0.5, // base ½ du prix listé (LDB 60 l.22) ; Marchandage la module ¼–½
  bargainSkill: 40,
  curated: ['Potion de guérison', 'Faxtoryll', 'Cataplasme de guérison', 'Potion de vitalité', 'Œil de verre', 'Crochet', 'Fausse jambe'],
};
