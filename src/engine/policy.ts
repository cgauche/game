/**
 * Registre des RÈGLES OPTIONNELLES (« règles maison ») — SOURCE UNIQUE.
 *
 * Une règle = UNE entrée `OptionalRule`. Le moteur lit sa valeur effective via `rule(id)`
 * (= surcharge runtime ⊕ défaut). Le panneau in-game (state/houseRules + ui/HouseRulesPanel)
 * écrit la surcharge par `setRule` et la PERSISTE ; il se RÉ-GÉNÈRE depuis ce registre (un
 * contrôle par entrée selon `kind`), donc ajouter une règle = ajouter une entrée ici, et elle
 * apparaît automatiquement en jeu. Module FEUILLE pur : aucune dépendance store/UI (la persistance
 * vit dans state/, pas ici — le moteur reste pur).
 *
 * Réf. : Livre de base, chapitre « Tests » et autres « Option : … ».
 */
export type RuleKind = 'flag' | 'param' | 'mode';
export type RuleValue = boolean | number | string;

export interface OptionalRule {
  /** Identifiant stable (clé de surcharge + persistance). */
  id: string;
  /** Libellé affiché dans le panneau. */
  label: string;
  /** Citation de la règle (« LDB 12 l.48 »), montrée en infobulle. */
  ref: string;
  /** Sous-système (regroupement dans le panneau). */
  group: string;
  /** Forme du contrôle auto-rendu : flag=toggle, param=nombre, mode=select. */
  kind: RuleKind;
  /** Valeur par défaut (RAW). */
  default: RuleValue;
  /** Valeurs possibles (kind='mode'). */
  options?: string[];
  /** Bornes (kind='param'). */
  min?: number;
  max?: number;
  step?: number;
  /** Aide courte (optionnelle). */
  hint?: string;
}

/**
 * LE registre. Ajouter une règle optionnelle = ajouter une entrée (et un SEUL point de lecture
 * dans son module métier via `rule(id)`). Les règles de Test pilotent `testPolicy.getTestPolicy()`.
 */
export const OPTIONAL_RULES: OptionalRule[] = [
  {
    id: 'test-auto-bands',
    label: 'Réussite / échec automatiques',
    ref: 'LDB 12 l.46/48',
    group: 'Tests',
    kind: 'mode',
    default: 'normal',
    options: ['normal', 'inverted', 'off'],
    hint: 'normal = 01-05 réussite auto / 96-00 échec auto (RAW) ; inverted = l’inverse ; off = aucune bande.',
  },
  {
    id: 'test-critiques-doubles',
    label: 'Succès / échec stupéfiants',
    ref: 'LDB 12 l.151',
    group: 'Tests',
    kind: 'flag',
    default: false,
    hint: 'Hors combat, un Test réussi sur un DOUBLE est un Succès Stupéfiant (✦) ; raté sur un double, un Échec Stupéfiant. Purement narratif (libellé) : aucun effet mécanique nouveau.',
  },
  {
    id: 'test-fast-sl',
    label: 'Calculer rapidement un DR',
    ref: 'LDB 12 l.128',
    group: 'Tests',
    kind: 'flag',
    default: false,
    hint: 'Sur une réussite, le DR = le chiffre des dizaines du jet.',
  },
  {
    id: 'test-over-100',
    label: 'Tests supérieurs à 100 %',
    ref: 'LDB 12 l.101',
    group: 'Tests',
    kind: 'flag',
    default: false,
    hint: 'Une valeur de Compétence/Caractéristique au-delà de 100 % n’est plus plafonnée : +1 DR par tranche de 10 % au-dessus de 100 sur une réussite.',
  },
  {
    id: 'test-auto-band-width',
    label: 'Largeur des bandes automatiques',
    ref: 'LDB 12 l.48',
    group: 'Tests',
    kind: 'param',
    default: 5,
    min: 0,
    max: 10,
    hint: 'Largeur des bandes de réussite/échec automatiques : 01-N réussite, (101−N)-00 échec. Défaut 5 (01-05 / 96-00) ; 0 = aucune bande.',
  },
  {
    id: 'test-extended-min-sl',
    label: 'Tests étendus : DR 0 = ±1 minimum',
    ref: 'LDB 12 l.208',
    group: 'Tests',
    kind: 'flag',
    default: false,
    hint: 'Dans un Test étendu, un Round réussi ajoute au moins +1 au total cumulé (même à DR 0) et un Round raté en retire au moins 1.',
  },
  {
    id: 'test-metier-int',
    label: 'Métier (Savoir) : Int au lieu de Dex',
    ref: 'LDB 09 l.352',
    group: 'Tests',
    kind: 'flag',
    default: false,
    hint: 'Quand un Test de Métier sert de Savoir (déterminer une information), il utilise l’Intelligence au lieu de la Dextérité.',
  },
  {
    id: 'test-intimidation-char',
    label: 'Intimidation : caractéristique',
    ref: 'LDB 09 l.266',
    group: 'Tests',
    kind: 'mode',
    default: 'F',
    options: ['F', 'max', 'FM', 'Int'],
    hint: 'Caractéristique de base d’Intimidation. F = Force (RAW) ; max = la meilleure de F/FM/Int ; FM = Force Mentale ; Int = Intelligence.',
  },
  {
    id: 'fortune-mid-session',
    label: 'Chance regagnée en cours de session',
    ref: 'LDB 17 l.52',
    group: 'Destin & Résistance',
    kind: 'mode',
    default: 'off',
    options: ['off', 'manual', 'auto'],
    hint: 'Longues Séances de Jeu : regagner des Points de Chance en cours de session (≈ 1×/h). off = seulement en début de session (RAW, via l’Effet de scène) ; manual = un bouton « Regagner la Chance maintenant » ici, à la demande ; auto = informationnel (le temps réel n’est pas traçable par le moteur — déclenchez-le à la main).',
  },
  {
    id: 'combat-advantage-cap',
    label: 'Plafond d’Avantage',
    ref: 'LDB 15 l.17',
    group: 'Combat',
    kind: 'param',
    default: 10,
    min: 1,
    max: 20,
    hint: 'Limiter les Avantages : valeur maximale d’Avantage qu’un combattant peut accumuler.',
  },
  {
    id: 'combat-advantage-cap-bi',
    label: 'Plafond d’Avantage = Bonus d’Initiative',
    ref: 'LDB 15 l.15',
    group: 'Combat',
    kind: 'flag',
    default: false,
    hint: 'L’Avantage d’un combattant ne peut dépasser son Bonus d’Initiative (plafond par combattant). Prime sur le plafond fixe ci-dessus.',
  },
  {
    id: 'combat-diff-cap-bonus',
    label: 'Plafond des bonus de Difficulté',
    ref: 'LDB 14 l.126',
    group: 'Combat',
    kind: 'param',
    default: 60,
    min: 0,
    max: 100,
    step: 10,
    hint: 'Plafond de la SOMME des bonus de Difficulté d’un Test (RAW +60 = Très Facile). L’Avantage reste hors plafond.',
  },
  {
    id: 'combat-diff-cap-malus',
    label: 'Plafond des malus de Difficulté',
    ref: 'LDB 14 l.126',
    group: 'Combat',
    kind: 'param',
    default: 30,
    min: 0,
    max: 100,
    step: 10,
    hint: 'Plafond de la SOMME des malus de Difficulté d’un Test (RAW −30 = Très Difficile), exprimé en valeur positive. Règle optionnelle EDO (Difficultés extrêmes, réf EDO App.2) : porter ce plafond à 50.',
  },
  {
    id: 'combat-frappe-mortelle',
    label: 'Frappe Mortelle',
    ref: 'LDB 14 l.9',
    group: 'Combat',
    kind: 'flag',
    default: false,
    hint: 'Tuer un adversaire en un seul coup permet d’enchaîner sur un autre (jusqu’au Bonus de CC). La règle de Taille enchaîne déjà sur une simple touche, indépendamment de cette option.',
  },
  {
    id: 'combat-defensive-stance',
    label: 'Sur la Défensive',
    ref: 'LDB 13 l.118',
    group: 'Combat',
    kind: 'flag',
    default: true,
    hint: 'Action « Sur la Défensive » : +20 aux Tests de défense jusqu’au prochain tour. Désactiver retire cette Action.',
  },
  {
    id: 'combat-critical-deflect',
    label: 'Déviation Critique',
    ref: 'LDB 63 l.63',
    group: 'Combat',
    kind: 'flag',
    default: true,
    hint: 'Sacrifier 1 PA pour annuler un Coup Critique sur une localisation blindée. Désactiver : le Critique est toujours subi (plus d’offre de déviation).',
  },
  {
    id: 'combat-ranged-melee-penalty',
    label: 'Tir dans un corps à corps',
    ref: 'LDB 14 l.133',
    group: 'Combat',
    kind: 'flag',
    default: true,
    hint: 'Tirer sur une cible Engagée : −20 au toucher ; si ce malus transforme une réussite en échec, le tir touche un allié au hasard. Désactiver retire le malus et le tir égaré.',
  },
  {
    id: 'combat-helpless-mode',
    label: 'Cible Inconsciente',
    ref: 'LDB 16 l.112',
    group: 'Combat',
    kind: 'mode',
    default: 'critique',
    options: ['critique', 'mort-auto'],
    hint: 'critique = l’attaque réussit en Coup Critique (RAW, défaut). mort-auto = en CORPS À CORPS la cible est tuée automatiquement ; le tir reste un succès à bout portant (critique).',
  },
  {
    id: 'combat-sudden-death',
    label: 'Mort Subite',
    ref: 'LDB 18 l.51',
    group: 'Combat',
    kind: 'mode',
    default: 'figurants',
    options: ['figurants', 'tous', 'off'],
    hint: 'Sur un coup fatal (Dégâts > PB), la cible meurt ou tombe Inconsciente sans passer par les Blessures critiques. figurants = figurants seuls (défaut) ; tous = aussi les PNJ importants ; off = personne (tout passe par les critiques). Jamais les PJ.',
  },
  {
    id: 'combat-weapon-reach',
    label: 'Longueur d’arme',
    ref: 'LDB 62 l.215',
    group: 'Combat',
    kind: 'flag',
    default: false,
    hint: 'En mêlée, une arme plus longue impose −10 à l’adversaire pour vous toucher (selon l’Allonge des armes). Désactivé par défaut.',
  },
  {
    id: 'combat-init-method',
    label: 'Méthode d’Initiative',
    ref: 'LDB 13 l.39',
    group: 'Combat',
    kind: 'mode',
    default: 'roll-i',
    options: ['roll-i', 'fixed-i', 'roll-bi'],
    hint: 'roll-i = 1d10 + Initiative (défaut) ; fixed-i = Initiative fixe, sans dé (ordre stable d’un Round à l’autre) ; roll-bi = 1d10 + Bonus d’Initiative + Bonus d’Agilité.',
  },
  {
    id: 'combat-init-reroll',
    label: 'Relancer l’Initiative chaque Round',
    ref: 'LDB 13 l.43',
    group: 'Combat',
    kind: 'flag',
    default: false,
    hint: 'Option « effectuer un lancer pour chaque Round » : au début de chaque Round, l’Initiative de tous les combattants est re-tirée (selon la Méthode d’Initiative ci-dessus) et l’ordre recalculé — les plus lents ne sont plus toujours derniers. Désactivé (défaut) = l’ordre d’ouverture est conservé pour tout le combat.',
  },
  {
    id: 'combat-se-fatiguer',
    label: 'Se fatiguer au combat',
    ref: 'LDB 16 l.99',
    group: 'Combat',
    kind: 'flag',
    default: false,
    hint: 'Un effort soutenu épuise : après Bonus d’Endurance Rounds de combat, Test de Résistance — échec = État Exténué. Désactivé par défaut.',
  },
  {
    id: 'combat-cadence',
    label: 'Cadence de combat',
    ref: 'maison',
    group: 'Combat',
    kind: 'mode',
    default: 'manuel',
    options: ['manuel', 'rapide', 'auto'],
    hint: 'manuel = chaque jet d’un héros passe par sa modale (défaut) ; rapide = les jets se lancent et s’appliquent seuls, sans dépenser Chance/Résilience/Sombre Pacte (le Sauvetage par Destin reste une modale) ; auto = l’IA joue aussi les héros (cible, action, surincantation, défense) et dépense le Destin pour éviter la mort.',
  },
  {
    id: 'social-status-reaction-roll',
    label: 'Réaction au Statut (1d10)',
    ref: 'LDB 08 l.54',
    group: 'Social',
    kind: 'flag',
    default: false,
    hint: 'Au-delà de la norme sociale : avant un Test social ciblant un PNJ, 1d10 → 1-2 « Braver le Statut » (annule les mods de Statut) ; 3-8 réactions classiques (mods normaux) ; 9-10 « Opinions extrêmes » (mods inversés).',
  },
  {
    id: 'social-begging-bonus',
    label: 'Mendicité et Statut',
    ref: 'LDB 08 l.92',
    group: 'Social',
    kind: 'flag',
    default: false,
    hint: 'La mendicité est plus efficace juste au-dessus de soi : un personnage Bronze qui mendie auprès d’un Échelon Argent obtient +10 au lieu de −10 (Bronze → Argent uniquement).',
  },
  {
    id: 'social-charm-intra-tier',
    label: 'Statut au sein d’un même Échelon',
    ref: 'LDB 08 l.88',
    group: 'Social',
    kind: 'flag',
    default: false,
    hint: 'Le MJ applique aussi le ±10 de Statut entre deux personnes du MÊME Échelon mais de Standing différent (Standing supérieur +10 / inférieur −10).',
  },
  {
    id: 'creation-gnome-jouable',
    label: 'Gnome jouable (NADJ)',
    ref: 'NADJ appendice I l.10',
    group: 'Création',
    kind: 'flag',
    default: false,
    hint: 'Ajoute le Gnome (Nuits agitées) comme race jouable : il devient une option du Tableau des Races aléatoires (borne 98, partagée avec l’Ogre) et apparaît dans la grille de sélection. Désactivé par défaut.',
  },
  {
    id: 'creation-signes-astraux',
    label: 'Signes astraux à la création',
    ref: 'ADE2 ch.03',
    group: 'Création',
    kind: 'flag',
    default: true,
    hint: 'Étape optionnelle ADE2 : un signe astral (1d100, +25 PX si le tirage est gardé) qui modifie les attributs de départ ou octroie un Talent, plus l’ascendant et les demeures célestes (flavor). Désactiver retire l’étape du créateur.',
  },
  {
    id: 'market-mode',
    label: 'Système d’achat / vente',
    ref: 'LDB 59 l.15',
    group: 'Marché',
    kind: 'mode',
    default: 'complet',
    options: ['complet', 'sans-disponibilite', 'sans-marchandage', 'simplifie'],
    hint: 'complet = Disponibilité + Marchandage (RAW) ; sans-disponibilite = tout en stock (pas de Test) ; sans-marchandage = prix fixes (pas de jet opposé) ; simplifie = les deux désactivés.',
  },
  {
    id: 'market-guild',
    label: 'Guildes d’Artisans',
    ref: 'LDB 60 l.69',
    group: 'Marché',
    kind: 'flag',
    default: false,
    hint: 'Marché dans une ville à Guilde : les Défauts d’un objet réduisent sa Disponibilité (plus rare) et le premier Atout ne l’augmente pas.',
  },
  {
    id: 'interlude-enabled',
    label: 'Entre deux aventures',
    ref: 'LDB 22 l.14',
    group: 'Activités',
    kind: 'flag',
    default: true,
    hint: 'Système « Entre deux aventures » (événements, Activités, dépenses). Désactiver court-circuite l’interlude (ignoré silencieusement).',
  },
  {
    id: 'interlude-elf-duty',
    label: 'Devoir elfique (Prestige Elfique)',
    ref: 'LDB 23 l.48',
    group: 'Activités',
    kind: 'flag',
    default: true,
    hint: 'Un personnage elfe perd 1 Activité (interlude ≥ 3 semaines) pour son devoir envers les siens. Désactiver lève cette restriction.',
  },
  {
    id: 'magic-composant',
    label: "Composants d'incantation",
    ref: 'LDB 46 l.159',
    group: 'Magie',
    kind: 'flag',
    default: false,
    hint: "Un lanceur peut focaliser sa magie via un composant adapté à un Sort d'Arcane/Domaine (acheté pour ce Sort, coût = NI pistoles d'argent). Sur une Incantation Imparfaite, le composant l'absorbe : Majeure → Mineure, Mineure → annulée. Consumé à l'incantation, même sans Imparfaite. Composants gérés sur la fiche du personnage. Désactivé par défaut.",
  },
  {
    id: 'corruption-tables-edoc',
    label: 'Tables de Corruption étendues (EDOC)',
    ref: 'EDOC ch.8',
    group: 'Corruption',
    kind: 'mode',
    default: 'ldb',
    options: ['ldb', 'toute', 'khorne', 'nurgle', 'slaanesh', 'tzeentch'],
    hint: 'Tables de mutations du Compagnon T1 (physiques + mentales), alignées par Puissance du Chaos. ldb = Tableaux du Livre de base (RAW, défaut). toute = tables EDOC « Toute Puissance » (élargies). khorne/nurgle/slaanesh/tzeentch = tables alignées sur un dieu (pour une campagne dédiée). Une mutation peut différer du Livre de base (ex. Écailles épineuses).',
  },
  {
    id: 'psych-acquisition-optional',
    label: 'Acquisition de Traits psychologiques',
    ref: 'ADE2 Annexe I',
    group: 'Psychologie',
    kind: 'flag',
    default: false,
    hint: 'Règles facultatives ADE II (Annexe I) pour gagner de nouveaux Traits psychologiques en cours de partie : Phobie du noir (États Brisé de Terreur cumulés ≥ Bonus de FM → Phobie), Animosité & Haine (dépenser le Destin pour survivre → Test de Calme ; échec → Animosité, doublon → Haine), Trauma (Ambition rendue impossible → Test de Calme ; échec → Trauma). Désactivé par défaut.',
  },
  {
    id: 'disease-mode',
    label: 'Utilisation des maladies',
    ref: 'LDB 20 l.36',
    group: 'Maladies',
    kind: 'mode',
    default: 'full',
    options: ['full', 'situational', 'off'],
    hint: 'full = toutes les expositions (RAW) ; situational = pas d’Infection Mineure post-critique, mais Infecté/Maladie conservés (Skavens/Nurgle) ; off = aucune maladie (ni contraction, ni progression, ni contagion).',
  },
  {
    id: 'travel-etapes',
    label: 'Voyage par Étapes',
    ref: 'EDOC ch.5 l.29',
    group: 'Voyage',
    kind: 'flag',
    default: false,
    hint: 'Sous-système optionnel du Compagnon T1 : un trajet est découpé en Étapes, chacune avec un jet de Météo (et ses activités). Désactivé = voyage jour-par-jour du Livre de base, inchangé. Toggle PARENT : les options de Voyage ci-dessous sont inertes tant qu’il est éteint.',
  },
  {
    id: 'travel-etapes-count-bonus',
    label: 'Étapes supplémentaires',
    ref: 'EDOC ch.5 l.34',
    group: 'Voyage',
    kind: 'param',
    default: 0,
    min: 0,
    max: 4,
    step: 1,
    hint: '« Si votre groupe apprécie une expérience de voyage plus complexe, augmentez le nombre d’Étapes de 2 ou plus. » +N Étapes par trajet. Sans effet si « Voyage par Étapes » est éteint.',
  },
  {
    id: 'travel-attraper-froid',
    label: 'Attraper froid',
    ref: 'EDOC ch.5 l.73',
    group: 'Voyage',
    kind: 'flag',
    default: false,
    hint: 'Option « Attraper Froid » : Test d’Exposition en fin d’Étape sous intempéries (pluie/neige sans manteau ni tente ; toujours sous averse/blizzard). En saison froide, l’exposition donne un rhume. Sauté si un héros réussit le poste « Plein air ». Sans effet si « Voyage par Étapes » est éteint.',
  },
  // NB : l'ancien flag POC `travel-forage` est RETIRÉ — l'Approvisionnement est désormais un POSTE
  // d'Activité (un héros assigné via `travelRole`), résolu par `travelPostes` sous « Voyage par Étapes ».
];

const RULES_BY_ID = new Map<string, OptionalRule>(OPTIONAL_RULES.map((r) => [r.id, r]));
const overrides = new Map<string, RuleValue>();

/** Définition d'une règle (métadonnée pour l'auto-rendu du panneau). */
export function ruleDef(id: string): OptionalRule | undefined {
  return RULES_BY_ID.get(id);
}

/** Valeur EFFECTIVE d'une règle : surcharge runtime si présente, sinon défaut. */
export function rule(id: string): RuleValue {
  if (overrides.has(id)) return overrides.get(id)!;
  return RULES_BY_ID.get(id)?.default ?? false;
}

/** Surcharge runtime (depuis le panneau in-game). Ignore un id inconnu. */
export function setRule(id: string, value: RuleValue): void {
  if (RULES_BY_ID.has(id)) overrides.set(id, value);
}

/** Retire la surcharge → retour au défaut. */
export function resetRule(id: string): void {
  overrides.delete(id);
}

/** Snapshot des surcharges (pour persistance). */
export function ruleOverrides(): Record<string, RuleValue> {
  return Object.fromEntries(overrides);
}

/** Remplace les surcharges (depuis la persistance). Ignore les ids inconnus. */
export function loadRuleOverrides(o: Record<string, RuleValue>): void {
  overrides.clear();
  for (const [k, v] of Object.entries(o)) if (RULES_BY_ID.has(k)) overrides.set(k, v);
}
