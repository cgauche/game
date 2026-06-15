/**
 * Magie du Chaos (Magie noire des Dieux Sombres) — LDB 51, sorts communs + Nurgle + Slaanesh.
 * Curation B4 : les Projectiles de Corruption (Décharge, Explosion) infligent leurs Dégâts (moteur
 * missile) et imposent un Test de Résistance sous peine de Corruption (composition test→corruption) ;
 * « Déchirer l'Aethyr » ouvre un portail (invocation hostile) ; les sorts de possession/obsession/
 * messagers/transformation restent narratifs. Les sorts de Tzeentch sont dans magie-tzeentch.ts.
 */
import { SpellSpec } from '../../engine/spellspec';

export const MAGIE_CHAOS: SpellSpec[] = [
  {
    label: 'Allure démoniaque',
    // « Lancez 1d10 sur le Tableau (p.78) et appliquez le Trait démoniaque correspondant à votre Dieu
    //   pour la durée (+2 DR : prolonger ET relancer). » — Trait aléatoire d'un tableau par Dieu : arbitré.
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Allure démoniaque »',
  },
  {
    label: 'Aspect sublimé',
    // « Cicatrices, difformités et Mutations de la Cible deviennent indétectables (sauf par des moyens
    //   divins / Seconde vue sur Test). » — dissimulation des stigmates : arbitré.
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Aspect sublimé »',
  },
  {
    label: 'Décharge de Corruption',
    // « Projectile magique infligeant Dégâts +6. Les cibles touchées doivent réussir un Test de
    //   Résistance Intermédiaire (+0) ou gagner 1 Corruption. » — Dégâts via le moteur missile ; le
    //   Test de Corruption à la touche (composition test→corruption).
    durationRounds: null,
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Décharge de Corruption »',
  },
  {
    label: "Déchirer l'Aethyr",
    // « Un portail vers l'Aethyr apparaît ; à chaque fin de Round, un démon mineur (selon votre
    //   Domaine) le traverse — PAS sous votre contrôle. Les vivants voyant la faille testent
    //   Résistance (+0) ou gagnent +1 Corruption ; entrer = mort (sauf Destin). +1 démon/round par
    //   +5 DR. » — invocation HOSTILE (1er démon) ; l'afflux continu et la Corruption restent
    //   journalisés.
    summon: { ref: 'Sanguinaire de Khorne', count: 1, allyOfCaster: false },
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "LDB 51 — Magie du Chaos « Déchirer l'Aethyr »",
  },
  {
    label: 'Esclave des Ténèbres',
    // « Test opposé de FM (à gagner d'au moins +2 DR) : l'âme de la victime part dans les Royaumes du
    //   Chaos et un démon possède le corps (contrôle au MJ, sauf Point de Destin). Échecs punis. » —
    //   possession démoniaque : arbitré.
    durationRounds: null, // Spéciale
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Esclave des Ténèbres »',
  },
  {
    label: 'Explosion de Corruption',
    // « Projectile magique infligeant Dégâts +5 qui Cible tout le monde dans la ZdE. Toute personne
    //   affectée teste Résistance Intermédiaire (+0) ou gagne 1 Corruption. » — Dégâts ZdE (moteur
    //   missile) ; Test de Corruption à la touche.
    durationRounds: null,
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Explosion de Corruption »',
  },
  {
    label: 'Obsession',
    // « La Cible devient obsédée (Tests de Résistance horaires de difficulté croissante) ; à la fin,
    //   Test de Résistance (+0) ou +1 Corruption. Une seule fois par Domaine et par Cible. » —
    //   malédiction obsessionnelle : arbitré.
    durationRounds: null, // « (DR) jours »
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Obsession »',
  },
  {
    label: 'Odieux messager',
    // « Un essaim de démons mineurs porte un court message à votre Cible (invisible sauf Seconde
    //   vue). » — messagers démoniaques : arbitré.
    durationRounds: null, // Instantanée
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Odieux messager »',
  },
  {
    label: 'Pouvoir du Chaos',
    // « Les Sorts lancés près du point ciblé voient leur NI réduit de moitié. Toute personne dans la
    //   ZdE teste Résistance (+0) à la fin de chaque Round ou gagne +1 Corruption. » — déchirure
    //   d'Aethyr (réduction de NI + aura de Corruption) : arbitré.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Pouvoir du Chaos »',
  },
  {
    label: 'Flot de Corruption',
    type: 'Magie du Chaos', // Nurgle
    // « Attaque de Souffle comme 2 Avantages dépensés sur le Trait Souffle ; Projectile magique de
    //   Dégâts = BE, ignore les PA, + Traits Corrosif et Poison. Si une cible subit plus de Blessures
    //   que son BE, Test de Résistance (+0) ou Infection du Sang. +2 Dégâts par +2 DR. » — délégué à
    //   l'attaque de ZONE du Trait Souffle ; les Traits ajoutés et l'Infection restent journalisés.
    breathAttack: true,
    durationRounds: null,
    curated: true,
    source: 'LDB 51 — Magie du Chaos (Nurgle) « Flot de Corruption »',
  },
  {
    label: 'Consentement',
    type: 'Magie du Chaos', // Slaanesh
    // « L'Initiative de la cible passe à 10 (si supérieure) ; ses déplacements sont aléatoires (MJ) et
    //   elle ne peut agir qu'en réussissant un Test de Calme (+0). » — effondrement mental : arbitré
    //   (l'Initiative absolue et l'action conditionnée ne sont pas des op simples).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 51 — Magie du Chaos (Slaanesh) « Consentement »',
  },
];
