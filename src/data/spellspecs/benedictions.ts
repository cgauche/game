/**
 * Bénédictions (LDB 41 — Bénédictions, p.221) : les 19 Prières mineures du Talent
 * Béni. Chaque entrée recopie sa description canon (spells.json, source LDB p.221) ;
 * `source` = la desc verbatim abrégée. Les effets non modélisés (relance, arme
 * magique, suffocation…) restent `narrative` — branchés « par identité » au Lot 8.
 *
 * Portée 6 m / Cible 1 / Durée 6 rounds pour toutes sauf mention (Guérison,
 * Convalescence : Contact + Instantanée ; Ténacité : Instantanée).
 */
import { SpellSpec } from '../../engine/spellspec';
import { CharKey } from '../../engine/types';

/** Bénédiction « +10 en X pendant 6 rounds » (12 des 19 suivent ce gabarit exact). */
const plus10 = (label: string, char: CharKey, source: string): SpellSpec => ({
  label,
  ops: [{ op: 'charMod', char, mod: 10 }],
  durationRounds: 6,
  curated: true,
  source,
});

export const BENEDICTIONS: SpellSpec[] = [
  plus10('Bénédiction de Bataille', 'CC', '« Votre cible gagne +10 en Capacité de Combat »'),
  plus10('Bénédiction de Charisme', 'Soc', '« Votre cible gagne +10 en Sociabilité »'),
  plus10('Bénédiction de Courage', 'FM', '« Votre cible gagne +10 en Force Mentale. »'),
  plus10('Bénédiction de Finesse', 'Dex', '« Votre cible gagne +10 en Dextérité. »'),
  plus10('Bénédiction de Grâce', 'Ag', '« Votre cible gagne +10 en Agilité. »'),
  plus10('Bénédiction de La Chasse', 'CT', '« Votre cible gagne +10 en Capacité de Tir. »'),
  plus10('Bénédiction de Puissance', 'F', '« Votre cible gagne +10 en Force. »'),
  plus10('Bénédiction de Sagesse', 'Int', '« Votre cible gagne +10 en Intelligence. »'),
  plus10('Bénédiction de Vigueur', 'E', '« Votre cible gagne +10 en Endurance. »'),
  plus10('Bénédiction de Vivacité', 'I', '« Votre cible gagne +10 en Initiative. »'),
  {
    label: 'Bénédiction de Guérison',
    ops: [{ op: 'heal', amount: 1 }],
    durationRounds: null, // Instantanée
    curated: true,
    source: '« Votre cible regagne +1 Point de Blessure. »',
  },
  {
    label: 'Bénédiction de Ténacité',
    ops: [{ op: 'removeCondition' }], // « retirer 1 État » — au choix de la cible (nom absent)
    durationRounds: null, // Instantanée
    curated: true,
    source: '« Votre cible peut retirer 1 Etat. »',
  },
  // --- Effets « par identité » non encore mécanisés (Lot 8) : journalisés verbatim ---
  {
    label: 'Bénédiction de Chance',
    ops: [{ op: 'narrative', text: 'Bénédiction de Chance : la cible peut relancer le prochain Test auquel elle échoue (second résultat conservé).' }],
    durationRounds: 6,
    curated: true,
    source: '« Votre cible peut relancer le prochain Test auquel elle échoue. »',
  },
  {
    label: 'Bénédiction de Conscience',
    ops: [{ op: 'narrative', text: 'Bénédiction de Conscience : Test de Force Mentale Accessible (+20) pour briser un Commandement de la divinité, sinon Honte (pas d’Action) — arbitrage MJ.' }],
    durationRounds: 6,
    curated: true,
    source: '« …Test de Force Mentale Accessible (+20) pour briser n’importe quel Commandement… »',
  },
  {
    label: 'Bénédiction de Convalescence',
    ops: [{ op: 'narrative', text: 'Bénédiction de Convalescence : réduit d’1 journée la durée d’une maladie (une seule fois par maladie et par personne).' }],
    durationRounds: null,
    curated: true,
    source: '« …réduire la durée d’une maladie dont elle est affligée d’une 1 journée. »',
  },
  {
    label: 'Bénédiction de Droiture',
    // « L'arme de votre cible est considérée comme Magique. » — Atout Magique temporisé
    // (op enchantWeapon → isMagicWeapon → touche l'Éthéré, LDB 85).
    ops: [{ op: 'enchantWeapon', addQualities: ['Magique'] }],
    durationRounds: 6,
    curated: true,
    source: '« L’arme de votre cible est considérée comme Magique. »',
  },
  {
    label: 'Bénédiction de Protection',
    ops: [{ op: 'narrative', text: 'Bénédiction de Protection : les ennemis doivent réussir un Test de Force Mentale Accessible (+20) pour attaquer la cible — arbitrage MJ.' }],
    durationRounds: 6,
    curated: true,
    source: '« Les ennemis doivent effectuer un Test de Force Mentale Accessible (+20) pour attaquer votre cible… »',
  },
  {
    label: 'Bénédiction de Sauvagerie',
    ops: [{ op: 'narrative', text: 'Bénédiction de Sauvagerie : sur les Blessures Critiques infligées, deux lancers — garder le meilleur.' }],
    durationRounds: 6,
    curated: true,
    source: '« Quand votre cible inflige par la suite des Blessures Critiques, effectuez deux lancers et choisissez le meilleur résultat. »',
  },
  {
    label: 'Bénédiction de Souffle',
    ops: [{ op: 'narrative', text: 'Bénédiction de Souffle : la cible n’a pas besoin de respirer (ignore la suffocation).' }],
    durationRounds: 6,
    curated: true,
    source: '« Votre cible n’a pas besoin de respirer et ignore les règles de suffocation »',
  },
];
