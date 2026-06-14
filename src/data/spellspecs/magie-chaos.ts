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
    ops: [{ op: 'narrative', text: 'Allure démoniaque : lancez 1d10 sur le Tableau des aspects démoniaques (selon votre Dieu) et gagnez le Trait obtenu pour la durée ; par +2 DR, prolongez et relancez. Trait Démoniaque + 0 PB = âme aspirée — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Allure démoniaque »',
  },
  {
    label: 'Aspect sublimé',
    // « Cicatrices, difformités et Mutations de la Cible deviennent indétectables (sauf par des moyens
    //   divins / Seconde vue sur Test). » — dissimulation des stigmates : arbitré.
    ops: [{ op: 'narrative', text: 'Aspect sublimé : la Cible paraît sans défaut (cicatrices, difformités, Mutations cachées) ; un Test de Perception Difficile (−20), ou Intermédiaire pour Seconde vue, révèle qu’un Sort opère sans en dévoiler la teneur — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Aspect sublimé »',
  },
  {
    label: 'Décharge de Corruption',
    // « Projectile magique infligeant Dégâts +6. Les cibles touchées doivent réussir un Test de
    //   Résistance Intermédiaire (+0) ou gagner 1 Corruption. » — Dégâts via le moteur missile ; le
    //   Test de Corruption à la touche (composition test→corruption).
    ops: [{ op: 'test', skill: 'Résistance', difficulty: 'intermediaire', onFail: [{ op: 'corruption', amount: 1 }] }],
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
    ops: [{ op: 'narrative', text: 'Déchirer l’Aethyr : un démon mineur de plus traverse le portail à CHAQUE fin de Round (+1/round par +5 DR) ; les vivants voyant la faille testent Résistance (+0) ou gagnent +1 Corruption ; entrer dedans tue, sauf à dépenser un Point de Destin — arbitrage MJ.' }],
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
    ops: [{ op: 'narrative', text: 'Esclave des Ténèbres : Test opposé de Force Mentale (à gagner d’au moins +2 DR) — l’âme de la Cible est envoyée dans les Royaumes du Chaos et son corps possédé par un démon (sauf Point de Destin) ; un échec retourne le Sort contre vous — arbitrage MJ.' }],
    durationRounds: null, // Spéciale
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Esclave des Ténèbres »',
  },
  {
    label: 'Explosion de Corruption',
    // « Projectile magique infligeant Dégâts +5 qui Cible tout le monde dans la ZdE. Toute personne
    //   affectée teste Résistance Intermédiaire (+0) ou gagne 1 Corruption. » — Dégâts ZdE (moteur
    //   missile) ; Test de Corruption à la touche.
    ops: [{ op: 'test', skill: 'Résistance', difficulty: 'intermediaire', onFail: [{ op: 'corruption', amount: 1 }] }],
    durationRounds: null,
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Explosion de Corruption »',
  },
  {
    label: 'Obsession',
    // « La Cible devient obsédée (Tests de Résistance horaires de difficulté croissante) ; à la fin,
    //   Test de Résistance (+0) ou +1 Corruption. Une seule fois par Domaine et par Cible. » —
    //   malédiction obsessionnelle : arbitré.
    ops: [{ op: 'narrative', text: 'Obsession : via un objet cher à la Cible, vous l’obsédez (Tests de Résistance horaires, de plus en plus durs, une Maladresse la rend totalement obsédée 1d10−BFM heures) ; à la fin, Test de Résistance (+0) ou +1 Corruption — arbitrage MJ.' }],
    durationRounds: null, // « (DR) jours »
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Obsession »',
  },
  {
    label: 'Odieux messager',
    // « Un essaim de démons mineurs porte un court message à votre Cible (invisible sauf Seconde
    //   vue). » — messagers démoniaques : arbitré.
    ops: [{ op: 'narrative', text: 'Odieux messager : un essaim de démons mineurs invisibles porte un message (~25 mots, doublé par +2 DR) à votre Cible, presque instantanément — arbitrage MJ.' }],
    durationRounds: null, // Instantanée
    curated: true,
    source: 'LDB 51 — Magie du Chaos « Odieux messager »',
  },
  {
    label: 'Pouvoir du Chaos',
    // « Les Sorts lancés près du point ciblé voient leur NI réduit de moitié. Toute personne dans la
    //   ZdE teste Résistance (+0) à la fin de chaque Round ou gagne +1 Corruption. » — déchirure
    //   d'Aethyr (réduction de NI + aura de Corruption) : arbitré.
    ops: [{ op: 'narrative', text: 'Pouvoir du Chaos : dans la ZdE, le NI des Sorts est réduit de moitié (et l’incantation s’y fait en Difficulté Accessible +20) ; quiconque y reste teste Résistance (+0) à chaque fin de Round ou gagne +1 Corruption — arbitrage MJ.' }],
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
    ops: [{ op: 'narrative', text: 'Flot de Corruption : le Souffle ignore les PA et porte les Traits Corrosif et Poison ; une cible qui subit plus de Blessures que son BE teste Résistance (+0) ou contracte Infection du Sang — arbitrage MJ.' }],
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
    ops: [{ op: 'narrative', text: 'Consentement : l’Initiative de la cible chute à 10, ses déplacements deviennent erratiques (MJ), et elle ne peut entreprendre une Action qu’en réussissant un Test de Calme (+0) — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 51 — Magie du Chaos (Slaanesh) « Consentement »',
  },
];
