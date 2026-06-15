/**
 * Magie naturelle (magie des hauts-hommes / sorcellerie blanche) — LDB 49, 6 sorts (NI 0).
 * Curation B4 : sortilèges folkloriques utilitaires (charmes, philtres, projection astrale, vision
 * spirituelle) opérant hors du cadre tactique — ils restent `narrative` (rien d'inventé, règle 2).
 * Aucune op nouvelle.
 */
import { SpellSpec } from '../../engine/spellspec';

export const MAGIE_NATURELLE: SpellSpec[] = [
  {
    label: 'Bonne Volonté',
    // « Tous les Tests de Sociabilité dans la ZdE bénéficient de +10, et les Traits Psychologiques
    //   Animosité et Haine n'ont aucun effet. » — aura sociale de zone (hors combat) : arbitré.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 49 — Magie naturelle « Bonne Volonté »',
  },
  {
    label: 'Charme protecteur',
    // « Ceux qui portent la breloque gagnent le Talent Résistance à la magie (sans effet s'ils l'ont
    //   déjà). » — talisman conféré à un objet porté : arbitré.
    durationRounds: null, // « (Bonus de Force Mentale) jours »
    curated: true,
    source: 'LDB 49 — Magie naturelle « Charme protecteur »',
  },
  {
    label: "Chevaucher l'Obscurité",
    // « Votre esprit quitte votre corps et entre dans la Haie ; témoin invisible, vous traversez les
    //   obstacles non magiques. Votre corps reste insensible. » — projection astrale : arbitré.
    durationRounds: null, // « (Bonus de Force Mentale) minutes »
    curated: true,
    source: "LDB 49 — Magie naturelle « Chevaucher l'Obscurité »",
  },
  {
    label: 'Nepenthès',
    // « Si la potion est ingérée pendant que le Sort est actif, la cible peut choisir d'oublier un
    //   individu de façon permanente. » — philtre d'oubli : arbitré.
    durationRounds: null, // « (Bonus de Force Mentale) Rounds »
    curated: true,
    source: 'LDB 49 — Magie naturelle « Nepenthès »',
  },
  {
    label: 'Panacée',
    // « Si la décoction est bue pendant que le Sort est actif, la cible est guérie de BFM Blessures
    //   et d'une maladie (+1 maladie par +2 DR). » — élixir curatif : le soin/la purge se produisent
    //   à l'ingestion (action séparée), pas à l'incantation : arbitré (valeurs indiquées).
    durationRounds: null, // « (Bonus de Force Mentale) Rounds »
    curated: true,
    source: 'LDB 49 — Magie naturelle « Panacée »',
  },
  {
    label: 'Séparer les branches',
    // « Vous percevez les créatures invisibles, les esprits, les démons et celles impossibles à
    //   repérer. » — vision du Monde des Esprits : arbitré.
    durationRounds: null, // « (Bonus de Force Mentale) minutes »
    curated: true,
    source: 'LDB 49 — Magie naturelle « Séparer les branches »',
  },
];
