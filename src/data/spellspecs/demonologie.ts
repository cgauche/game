/**
 * Démonologie (Magie noire) — LDB 50, 4 sorts. Curation B4. « Destruction de Démon Mineur » draine
 * un démon (Blessures ignorant BE/PA, ciblage de Groupe) ; détection, octogramme de protection et
 * la manifestation d'un démon (invocation — en attente du moteur dédié) restent narratifs.
 * Aucune op nouvelle.
 */
import { SpellSpec } from '../../engine/spellspec';

export const DEMONOLOGIE: SpellSpec[] = [
  {
    label: 'Destruction de Démon Mineur',
    // « Une cible Démoniaque de Force Mentale inférieure à la vôtre subit BFM Blessures, ignorant le
    //   Bonus d'Endurance et les PA. De plus, vous pouvez augmenter l'une de vos Caractéristiques de
    //   +10 pour la durée. » — Blessures aux Démons (op wounds onlyGroups) ; le gate « FM inférieure »
    //   et le choix du +10 de Caractéristique restent journalisés.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 50 — Démonologie « Destruction de Démon Mineur »',
  },
  {
    label: 'Détection de démon',
    // « Vous savez immédiatement s'il y a un démon actif à portée, invoqué, lié à un artefact ou
    //   possédant quelqu'un. » — divination : arbitré.
    durationRounds: null,
    curated: true,
    source: 'LDB 50 — Démonologie « Détection de démon »',
  },
  {
    label: 'Manifestation de Démon mineur',
    // « Un Démon Mineur apparaît. Test opposé de Focalisation (Dhar)/FM : succès → il exécute un
    //   ordre puis disparaît ; échec → il attaque. » — démon invoqué (moteur d'invocation : Sanguinaire
    //   de Khorne, allié le temps du Sort) ; l'issue du Test opposé (obéir vs se retourner) reste journalisée.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 50 — Démonologie « Manifestation de Démon mineur »',
  },
  {
    label: 'Octogramme',
    // « Quiconque possède le Trait Démoniaque ne peut entrer ou sortir de l'octogramme à moins que sa
    //   Force Mentale ne soit deux fois supérieure à la vôtre. » — barrière de protection : arbitré.
    durationRounds: null, // « (Force Mentale) minutes »
    curated: true,
    source: 'LDB 50 — Démonologie « Octogramme »',
  },
];
