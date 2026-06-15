/**
 * Domaine de la Bête (Ghur) — LDB 48 « Magie des Arcanes (Bête) », 8 sorts.
 * Curation B4 : Traits de créature accordés (Incarnation de Wyssan, Peau de chasseur), Projectile
 * magique (La lance d'Ambre), zone de prédateurs persistante (Vol du Destin), enchantement des
 * attaques à mains nues (Serres d'ambre). La métamorphose complète (Forme bestiale : remplacement
 * de Caractéristiques) et les capacités de communion/domination animales restent narratives.
 * L'attribut de Domaine (Ghur : Peur 1 au lanceur après l'incantation) reste assuré par
 * domainAttributes.ts. Aucune op nouvelle.
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_BETE: SpellSpec[] = [
  {
    label: 'Forme bestiale',
    // « …choisissez une nouvelle forme parmi les Bêtes du Reikland. Remplacez vos F, E, Ag et Dex par
    //   celles de la créature, recalculez vos PB, gagnez ses Traits sauf Bestial. » — MÉTAMORPHOSE
    //   mécanique (engine/polymorph) : forme par DÉFAUT l'Ours (forte) ; le choix parmi les Bêtes du
    //   Reikland, le +1 Trait facultatif par +2 DR et la perte de la parole restent journalisés.
    polymorph: { ref: 'Ours' },
    durationRounds: null, // « (Force Mentale) minutes »
    curated: true,
    source: 'LDB 48 — Domaine de la Bête « Forme bestiale »',
  },
  {
    label: 'Incarnation de Wyssan',
    // « Gagnez : Arboricole, Arme (BF+2), Armure 2, Belliqueux, Grand, Magique, Morsure (BF+1),
    //   Peur 1, Rage. Vous ne pouvez plus utiliser Langue ou Savoir. » — Traits clairs accordés +
    //   Armure 2 (apAll) ; les armes naturelles à offset de BF (Arme/Morsure) et la Taille (Grand)
    //   restent journalisées (l'op grantTrait n'exprime pas « BF+N », et la Taille est un sous-système).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Bête « Incarnation de Wyssan »',
  },
  {
    label: "La lance d'Ambre",
    // « Projectile magique avec Dégâts +12. Frappe la première créature sur la trajectoire, ignorant
    //   les PA de cuir et de fourrure. Si la cible subit des Blessures, +1 État Hémorragique, puis la
    //   lance continue (−1 Dégât à chaque cible), s'arrêtant si elle n'inflige aucune Blessure. » —
    //   Dégâts via le moteur missile ; Hémorragique à la touche ; la traversée en ligne reste journalisée.
    durationRounds: null,
    curated: true,
    source: "LDB 48 — Domaine de la Bête « La lance d'Ambre »",
  },
  {
    label: 'Langue bestiale',
    // « Vous pouvez communiquer avec les créatures Bestial… +20 aux Tests d'Emprise sur les animaux
    //   et Dressage… vous ne pouvez lancer aucun Sort. » — communication animale utilitaire : arbitré.
    durationRounds: null, // « (Force Mentale) minutes »
    curated: true,
    source: 'LDB 48 — Domaine de la Bête « Langue bestiale »',
  },
  {
    label: 'Maître de la bête',
    // « Vous persuadez 1 créature Bestial que vous êtes le chef de sa meute ; elle vous protège
    //   jusqu'à la mort… » — domination d'un animal (contrôle de PNJ) : arbitré.
    durationRounds: null, // « (Bonus de Force Mentale) jours »
    curated: true,
    source: 'LDB 48 — Domaine de la Bête « Maître de la bête »',
  },
  {
    label: 'Peau de chasseur',
    // « +20 en Endurance et les Traits Peur 1 et Infravision, ainsi que le Talent Sens aiguisé
    //   (Odorat). » — Endurance/Peur/Infravision mécaniques ; le Talent Sens aiguisé reste journalisé.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Bête « Peau de chasseur »',
  },
  {
    label: "Serres d'ambre",
    // « Vos attaques à mains nues (Corps à corps (Bagarre)) sont considérées comme magiques,
    //   possèdent une valeur de Dégâts égale à votre Bonus de Force Mentale et infligent +1 État
    //   Hémorragique chaque fois qu'elles entraînent la perte de Blessures. » — enchantement des
    //   attaques à mains nues (Magique + Hémorragique à la touche) ; la valeur de Dégâts = BFM reste
    //   journalisée (l'op n'écrase pas la valeur de base de l'arme).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "LDB 48 — Domaine de la Bête « Serres d'ambre »",
  },
  {
    label: 'Vol du Destin',
    // « La volée attaque quiconque dans la ZdE (hors Magie des Arcanes (Bête)), infligeant +7 Dégâts
    //   à la fin du Round, et reste en jeu pour la durée. Toutes les créatures dans la ZdE gagnent +1
    //   État Aveuglé. » — zone persistante (disque BFM m) : Dégâts récurrents + Aveuglé ; le
    //   déplacement de la volée (Test d'Emprise sur les animaux) reste journalisé.
    persistentZone: {
      shape: 'disc',
      radiusMeters: { bonusOf: 'FM' },
      perRound: { damage: { amount: 7 }, conditions: [{ name: 'Aveuglé' }] },
    },
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Bête « Vol du Destin »',
  },
];
