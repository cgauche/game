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
    ref: 'LDB 14 l.198',
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
    ref: 'LDB 14 l.197',
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
    id: 'combat-aa-blessures',
    label: 'Blessures & Critiques (Aux Armes)',
    ref: 'AA 07 l.1-185',
    group: 'Combat',
    kind: 'mode',
    default: 'ldb',
    options: ['ldb', 'aa'],
    hint: 'Système ALTERNATIF de Blessures/Blessures Critiques/mort d’Aux Armes (remplace WFJDR p.172-178). ldb = Livre de base (RAW, défaut). aa = tables de Critiques PAR LOCALISATION d’Aux Armes + Critique sur un double (même s’il reste des Blessures) + décalage +10/Blessure au-delà de 0 + mort si (Inconscient & 0 PB & Blessures critiques > Bonus d’Endurance). Le corps mécanique (Blessures + États immédiats + Mort) est appliqué ; les sous-effets récurrents à durée Rounds (membre inutilisable, pénalité de Test) le sont AUSSI (#125, `aaCritical.ts`) — restent en texte : durées en jours (ctx sans horloge au site de résolution) et amputations permanentes non converties en séquelles.',
  },
  {
    id: 'combat-aa-avantage-groupe',
    label: 'Avantage de groupe (Aux Armes)',
    ref: 'AA 11 l.3-100',
    group: 'Combat',
    kind: 'flag',
    default: false,
    hint: 'Système ALTERNATIF d’Avantage d’Aux Armes (Annexe I) : l’Avantage n’est plus accumulé par combattant mais dans DEUX réserves de camp (alliés / adversaires). La génération est routée vers la réserve du camp (héros/alliés → alliés ; PNJ hostile ou neutre → adversaires). En fin de Round, le camp DOMINANT (le plus de combattants ; Coude-à-coude compte pour deux) prend 1 Avantage à l’autre (ou +1 si l’autre est vide) — remplace la décroissance et le Surnombre du Livre de base. Les Talents Battement/Coude-à-coude/Distraire/Impitoyable/Porte-bouclier/Rechargement rapide/Renversement/Artilleur (+ Cavalier émérite) lisent alors leur variante AA. Désactivé (défaut) = modèle par combattant du Livre de base, inchangé.',
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
    ref: 'LDB 13 l.29',
    group: 'Combat',
    kind: 'mode',
    default: 'fixed-i',
    options: ['fixed-i', 'roll-i', 'roll-bi'],
    hint: 'fixed-i = tri par Initiative, sans dé (défaut RAW, ordre stable d’un Round à l’autre) ; roll-i = 1d10 + Initiative ; roll-bi = 1d10 + Bonus d’Initiative + Bonus d’Agilité.',
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
    id: 'combat-round-seconds',
    label: 'Durée d’un Round (secondes)',
    ref: 'LDB 13 l.13 — MJ décide, valeur maison',
    group: 'Combat',
    kind: 'param',
    default: 10,
    min: 1,
    max: 60,
    hint: '« Un Round correspond en général à quelques secondes, mais c’est le MJ qui décide, si nécessaire, du temps qu’il représente » (LDB 13 l.13) : sert à décompter la rétention de souffle (BE×10 s, LDB 18 l.345) en Rounds.',
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
    id: 'market-tenir-comptes',
    label: 'Tenir les comptes (Statut)',
    ref: 'LDB 59 l.9',
    group: 'Marché',
    kind: 'flag',
    default: false,
    hint: 'Simplification LDB 59 l.9-11 : un objet coûtant au plus votre niveau de Statut (Bronze N = N sous, Argent N = N pistoles, Or N = N couronnes) s’achète sans compter les pièces ; au-delà, un seul achat par jour via un Test de Marchandage. Désactivé par défaut (chaque pièce est comptée, RAW).',
  },
  {
    id: 'market-guild',
    label: 'Guildes d’Artisans',
    ref: 'LDB 60 l.38',
    group: 'Marché',
    kind: 'flag',
    default: false,
    hint: 'Marché dans une ville à Guilde : les Défauts d’un objet réduisent sa Disponibilité (plus rare) et le premier Atout ne l’augmente pas.',
  },
  {
    id: 'tavern-games',
    label: 'Jeux de taverne',
    ref: 'NADJ ch.16 l.9',
    group: 'Activités',
    kind: 'flag',
    default: false,
    hint: 'Ajoute les jeux de taverne (Nuits agitées & dures journées, ch.16) : Al-Zahr, bras de fer, fléchettes, dominos, boules… résolus par la variante « jeu rapide » (Test opposé de la Compétence du jeu — ou Pari — Intermédiaire (+0), le plus de DR l’emporte). Désactivé par défaut.',
  },
  {
    id: 'craft-nd-availability',
    label: 'Artisanat : Disponibilité par défaut (objet ND)',
    ref: 'LDB 23 l.75-103 — silence, valeur maison',
    group: 'Activités',
    kind: 'mode',
    default: 'Rare',
    options: ['Commune', 'Limitée', 'Rare', 'Exotique'],
    hint: 'La Difficulté de l’Artisanat (ch.23 l.75-103) est fixée par la Disponibilité de l’équipement visé ; le canon ne prévoit rien pour un objet SANS Disponibilité chiffrée (« ND », ex. Arme improvisée/Licence de Guilde/Carte marine). Défaut Rare (prudent).',
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
    // #257 — LDB 23 l.5 / ADE II ch.8 l.65 bornent le budget par « participer à une Activité » ; le
    // Soutien (LDB 12 l.188-200) et Planification (ADE II ch.8 l.81 « peut aider au Test ») ne chiffrent
    // aucun coût d'Activité pour l'assistant. Défaut = false : `confirmActivity` ne décompte que le meneur.
    id: 'interlude-assist-costs-activity',
    label: 'Assister une Entreprise coûte un créneau (maison)',
    ref: 'LDB 12 l.188 / ADE II ch.8 l.81',
    group: 'Activités',
    kind: 'flag',
    default: false,
    hint: 'RAW muet : aucune règle ne dit si prêter son Soutien à l’Entreprise d’un autre (ex. Planification de bataille) consomme l’une des trois Activités de l’assistant. Désactivé (défaut) : seul le meneur dépense un créneau, les assistants aident gratuitement. Activé : chaque assistant qui a encore un créneau en dépense un.',
  },
  {
    // #352 — EDOC ch.8 l.151-153 chiffre le Test (Ragot Intermédiaire) mais jamais de durée à
    // l'Activité « Recueillir des informations » jouée HORS voyage (au comptoir d'une auberge, en
    // dehors d'une Étape) : le canon la borne implicitement à « une Étape » en voyage, muet ailleurs.
    id: 'inn-gather-info-minutes',
    label: 'Recueillir des informations à l’auberge — durée',
    ref: 'EDOC ch.8 l.151-153 — durée hors voyage non chiffrée, valeur maison (#352)',
    group: 'Activités',
    kind: 'param',
    default: 120,
    min: 30,
    max: 480,
    step: 30,
    hint: 'Temps passé à papoter et poser des questions dans une auberge (Ragot Intermédiaire, EDOC l.151), en MINUTES — avance l’horloge de campagne quelle que soit l’issue.',
  },
  {
    id: 'advancement-career-jump',
    label: 'Sauts de Niveau de Carrière (accord du MJ)',
    ref: 'LDB 07 l.140/148',
    group: 'Avancement',
    kind: 'flag',
    default: false,
    hint: 'Avec l’accord du MJ (LDB 07 l.140/148) : autorise un SAUT vers un Niveau de Carrière supérieur non-adjacent (même Carrière), et l’accès au MÊME Niveau d’une autre Carrière de la même Classe (Niveau courant complété requis). Désactivé (défaut) = RAW strict (Niveau suivant complété ou inférieur, ou 1er Niveau d’une autre Carrière).',
  },
  {
    id: 'advancement-mentor',
    label: 'Mentor requis hors carrière',
    ref: 'LDB 07 l.89',
    group: 'Avancement',
    kind: 'flag',
    default: false,
    hint: 'LDB 07 l.89 : une Augmentation de Caractéristique/Compétence HORS carrière (déjà au coût doublé) exige de trouver un mentor. Activé, ces Augmentations sont bloquées tant que le flag de groupe/scène « mentor » n’est pas posé (Effet d’éditeur setFlag « mentor »). Désactivé par défaut.',
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
    id: 'vents-tourbillonnants',
    label: 'Vents Tourbillonnants',
    ref: 'LDB 46 l.179-190',
    group: 'Magie',
    kind: 'mode',
    default: 'off',
    options: ['off', 'scene', 'round'],
    hint: "Avant chaque scène — ou à chaque Round dans une zone de turbulences — tirage 1d10 de la force des Vents (−30 à +30), appliqué aux Tests d'Incantation ET de Focalisation. Un porteur du Talent Seconde vue peut le repérer (Test de Perception Facile +40). off = désactivé (défaut) ; scene = tirage à l'ouverture du combat ; round = re-tirage à chaque Round (« zones de turbulences magiques »).",
  },
  {
    id: 'prayer-conviction',
    label: 'Prêchez ma sœur !',
    ref: 'LDB 40 l.42',
    group: 'Prières',
    kind: 'flag',
    default: false,
    hint: 'LDB 40 l.42 : les Tests de Prière entonnés discrètement ou sans conviction (murmurés) subissent une Difficulté plus élevée (un cran plus difficile). Le priant choisit alors, à l’incantation, entre prier à voix haute (normal) ou discrètement (plus dur). Désactivé par défaut.',
  },
  {
    id: 'prayer-petites',
    label: 'Petites Prières',
    ref: 'LDB 25 l.22',
    group: 'Prières',
    kind: 'flag',
    default: false,
    hint: 'LDB 25 l.22-24 : un personnage NON Béni qui prie dans un site sacré peut malgré tout être entendu — un 1d100 secret, exaucé sur 01 (pourcentage relevé s’il possède la Compétence Prière). Se déclenche depuis un Effet d’éditeur posé sur un site sacré. Désactivé par défaut.',
  },
  {
    id: 'prayer-petites-bonus-per-advance',
    label: 'Petites Prières : bonus par avance de Prière',
    ref: 'LDB 25 l.22-24 — silence, valeur maison',
    group: 'Prières',
    kind: 'param',
    default: 1,
    min: 0,
    max: 10,
    hint: '« Si vous avez la Compétence Prière, le MJ peut augmenter ce pourcentage » (l.24) — sans barème chiffré. Valeur maison : +N % de seuil d’exaucement par avance de Prière.',
  },
  {
    id: 'magic-sorcellerie',
    label: 'Sorcellerie',
    ref: 'LDB 49 l.5',
    group: 'Magie',
    kind: 'flag',
    default: false,
    hint: 'Domaine sombre de la Sorcellerie (LDB 49) : les Sorts dont le Domaine porte le marqueur Sorcellerie appliquent ses règles — +1 Point de Corruption à chaque jet d’Incantation Imparfaite, État Hémorragique possible sur la cible, et composant OBLIGATOIRE (sinon une Incantation Imparfaite Mineure est systématiquement lancée ; les ingrédients coûtent le NI en sous de cuivre). Désactivé par défaut.',
  },
  {
    id: 'corruption-tables-edoc',
    label: 'Tables de Corruption étendues (EDOC)',
    ref: 'EDOC ch.12',
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
    ref: 'EDOC ch.8 l.29',
    group: 'Voyage',
    kind: 'flag',
    default: false,
    hint: 'Sous-système optionnel du Compagnon T1 : un trajet est découpé en Étapes, chacune avec un jet de Météo (et ses activités). Désactivé = voyage jour-par-jour du Livre de base, inchangé. Toggle PARENT : les options de Voyage ci-dessous sont inertes tant qu’il est éteint.',
  },
  {
    id: 'travel-etapes-count-bonus',
    label: 'Étapes supplémentaires',
    ref: 'EDOC ch.8 l.34',
    group: 'Voyage',
    kind: 'param',
    default: 0,
    min: 0,
    max: 4,
    step: 1,
    hint: '« Si votre groupe apprécie une expérience de voyage plus complexe, augmentez le nombre d’Étapes de 2 ou plus. » +N Étapes par trajet. Sans effet si « Voyage par Étapes » est éteint.',
  },
  {
    id: 'travel-etapes-low-move-bonus',
    label: 'Étapes supplémentaires (groupe lent)',
    ref: 'EDOC ch.8 l.25 — MJ décide, valeur maison',
    group: 'Voyage',
    kind: 'param',
    default: 1,
    min: 1,
    max: 2,
    hint: '« Si [le Mouvement le plus faible des Personnages] est inférieur ou égal à 3, le voyage doit être augmenté de 1 ou 2 Étapes » — le canon ne tranche pas entre 1 et 2. Sans effet si « Voyage par Étapes » est éteint.',
  },
  {
    id: 'travel-allures',
    label: 'Montures et attelages (allures)',
    ref: 'EDOC 07 l.138-146',
    group: 'Voyage',
    kind: 'flag',
    default: false,
    hint: 'Règles de voyage du Compagnon T1 (ch.4) : voyage en selle sur les bêtes possédées (vitesse = Mouvement × 1,5/2,5/3 km/h au pas/trot/galop), endurance des allures (12 h au pas, Bonus d’Endurance en heures au trot, moitié au galop) avec Incidents de monte au-delà, et allure forcée d’un attelage (Test de Conduite d’attelage par km ; Échec Stupéfiant → Problème de véhicule). Indépendant du « Voyage par Étapes ».',
  },
  {
    // #340 — le canon ne fixe pas d'heure de départ (LDB « Voyage » borne un budget de 6 h/JOUR
    // sans dire quand la journée commence) : règle maison éditable (défaut ON) qui empêche un départ
    // terrestre/fluvial en pleine nuit. Le voyage MARITIME en est EXEMPT (équipage + installations
    // permettent de voguer de nuit, MDG 15 l.76 — cf. `sea-night-sailing`).
    id: 'travel-departure-gate',
    label: 'Porte d’heure de départ (terre & fleuve)',
    ref: 'LDB 51 l.224 (budget/jour) — heure de départ non chiffrée, valeur maison (#340)',
    group: 'Voyage',
    kind: 'flag',
    default: true,
    hint: 'Un voyage à pied, en selle ou sur le fleuve ne peut s’ébranler que de l’aube au crépuscule. Tenter de partir de nuit propose d’attendre l’aube (nuit jouée) ou d’annuler. La mer est exemptée (voguer de nuit = équipage + installations, MDG 15 l.76). Désactiver autorise un départ à toute heure.',
  },
  {
    // #340 — le canon ne modélise pas la privation de sommeil sur le budget de voyage : règle maison
    // éditable. Franchir un jour calendaire sans nuit jouée (aucun repos depuis le dernier) coûte
    // 1 État Exténué par jour blanc, retiré au prochain vrai sommeil comme tout Exténué (LDB 16).
    // Défaut ON [arbitrage user 2026-07-11 : « On a aucune règle sur la privation de sommeil ? » → activée].
    id: 'travel-sleep-forced',
    label: 'Privation de sommeil (nuit forcée)',
    ref: 'LDB 18 (Exténué) — privation de sommeil non chiffrée, valeur maison (#340)',
    group: 'Voyage',
    kind: 'flag',
    default: true,
    hint: 'Chaque jour calendaire franchi SANS nuit de sommeil jouée inflige 1 État Exténué (« privation de sommeil ») à chaque héros vivant. Il se dissipe au prochain vrai repos. Débrayable ici.',
  },
  {
    // #340 — voguer de nuit exige « un équipage suffisant et des installations adéquates », sinon la
    // distance du jour est divisée par deux (MDG 15 l.76). L'équipage du navire de campagne étant
    // ABSTRAIT (MDG 14 l.39), on ne peut le vérifier : réglage maison éditable (défaut ON = navire
    // équipé pour la nuit, comportement conservé) ; désactiver applique le ÷2 (`seaMilesPerDay(m, false)`).
    id: 'sea-night-sailing',
    label: 'Voguer de nuit (équipage & installations)',
    ref: 'MDG 15 l.76',
    group: 'Voyage',
    kind: 'flag',
    default: true,
    hint: 'Le navire de campagne peut naviguer de nuit (équipage suffisant, installations adéquates) : distance de jour pleine. Désactiver = pas de navigation nocturne → distance quotidienne divisée par deux (MDG 15 l.76).',
  },
  {
    id: 'travel-attraper-froid',
    label: 'Attraper froid',
    ref: 'EDOC ch.8 l.73',
    group: 'Voyage',
    kind: 'flag',
    default: false,
    hint: 'Option « Attraper Froid » : Test d’Exposition en fin d’Étape sous intempéries (pluie/neige sans manteau ni tente ; toujours sous averse/blizzard). En saison froide, l’exposition donne un rhume. Sauté si un héros réussit le poste « Plein air ». Sans effet si « Voyage par Étapes » est éteint.',
  },
  {
    id: 'water-scarcity',
    label: 'Pénurie d’eau',
    ref: 'LDB 18 l.340',
    group: 'Voyage',
    kind: 'flag',
    default: false,
    hint: 'L’eau est réputée abondante au Reikland (rivières, puits, auberges) → aucune Soif par défaut. Activer pour un contexte À SEC (siège, désert, souterrain prolongé) : chaque jour sans eau impose un Test de Résistance (de plus en plus dur) — 1ᵉʳ échec −10 Int/FM/Soc, puis −10 le reste + 1d10 Blessures (LDB 18 l.340). En mer, la Soif suit automatiquement les tonneaux du navire, sans cette règle.',
  },
  {
    id: 'sea-water-litres-mediane',
    label: 'Eau bue par jour (température Médiane, en mer)',
    ref: 'MDG ch.14 l.242 — fourchette, valeur maison',
    group: 'Voyage',
    kind: 'param',
    default: 3,
    min: 2,
    max: 3,
    hint: '« Un membre d’équipage boit 2 à 3 litres d’eau par jour » (hors bandes Caniculaire/Chaude, déjà chiffrées à 4 L/3 L) : le canon donne une fourchette, pas une valeur unique. Défaut : borne haute (3 L).',
  },
  // L'Approvisionnement est un POSTE d'Activité (un héros assigné via `travelRole`), résolu par
  // `travelPostes` sous « Voyage par Étapes ».
  {
    id: 'exposure-night-difficile-count',
    label: 'Exposition : Tests par nuit (difficile)',
    ref: 'LDB 18 — silence, valeur maison',
    group: 'Voyage',
    kind: 'param',
    default: 2,
    min: 0,
    max: 8,
    hint: 'LDB 18 l.328 ne chiffre que la CADENCE (Test toutes les 4h en environnement difficile) ; l’application « une nuit ~8h dehors = N Tests » est maison. Une nuit abritée en environnement extrême retombe sur ce même nombre.',
  },
  {
    id: 'exposure-night-extreme-count',
    label: 'Exposition : Tests par nuit (extrême)',
    ref: 'LDB 18 — silence, valeur maison',
    group: 'Voyage',
    kind: 'param',
    default: 4,
    min: 0,
    max: 12,
    hint: 'LDB 18 l.328 ne chiffre que la CADENCE (Test toutes les 2h en environnement extrême, ex. tempête) ; l’application « une nuit ~8h dehors = N Tests » est maison.',
  },
  {
    id: 'exposure-tent-cancels',
    label: 'La Tente annule l’Exposition du camp',
    ref: 'LDB 74 — silence, valeur maison',
    group: 'Voyage',
    kind: 'flag',
    default: true,
    hint: 'LDB 74 l.62 ne prête à la Tente AUCUN effet sur l’Exposition (seul le Sac de couchage a un bonus chiffré, +20 au Test de Froid, LDB 74 l.60) : cette annulation est une convenance maison. Désactiver : une Tente ne compte plus comme abri automatique (retombe sur l’abri de fortune, Survie en extérieur).',
  },
  {
    id: 'exposure-expire-hours',
    label: 'Exposition : dissipation des pénalités (heures)',
    ref: 'LDB 18 — silence, valeur maison',
    group: 'Voyage',
    kind: 'param',
    default: 24,
    min: 1,
    max: 168,
    step: 1,
    hint: 'Le canon ne fixe aucune durée à ces pénalités (−10 aux caractéristiques) : convention maison de dissipation après N heures au chaud/au frais.',
  },
  {
    id: 'exposure-no-coat-penalty',
    label: 'Exposition (Froid) : pénalité sans Manteau',
    ref: 'LDB 65 — silence, valeur maison',
    group: 'Voyage',
    kind: 'param',
    default: 10,
    min: 0,
    max: 30,
    step: 5,
    hint: 'LDB 65 l.44 dit seulement « des pénalités » sans les chiffrer : valeur maison retirée au Test de Résistance contre le froid sans Manteau/Cape porté(e).',
  },
  {
    id: 'siege-engine-push-speed',
    label: 'Vitesse de poussée d’un engin de siège',
    ref: 'ADE II ch.08 l.258 — roues, vitesse non chiffrée, valeur maison',
    group: 'Combat',
    kind: 'param',
    default: 2,
    min: 1,
    max: 6,
    hint: '« [le bélier/la baliste sont] dotés de roues pour se déplacer sur le champ de bataille » (ADE II ch.08 l.256/258) sans chiffrer de vitesse : plafond MAISON (en cases) d’une poussée d’équipage — mouvement SIMPLE, aucun Test.',
  },
  {
    id: 'sea-shipwreck-swim',
    label: 'Naufrage en mer : Difficulté du Test de Natation',
    ref: 'MDG 13 l.522 — noyade Natation Complexe (–10) ; naufrage en pleine mer non chiffré, valeur maison',
    group: 'Voyage',
    kind: 'mode',
    default: 'complexe',
    options: ['facile', 'accessible', 'intermediaire', 'complexe', 'difficile', 'tresDifficile'],
    hint: 'Quand le navire de campagne coule (Blessures à 0, MDG 13 l.674), chaque héros à bord tente un Test de Natation (LDB 09 l.372) pour rejoindre la côte ; échec = noyade (LDB 18 l.344). La Difficulté d’un naufrage en pleine mer n’est pas chiffrée : ancrage le plus proche = la noyade du Tourbillon (Natation Complexe –10, MDG 13 l.522). Défaut Complexe.',
  },
  {
    id: 'landRobberyFleePct',
    label: 'Vol terrestre — perte de cargaison en cas de FUITE (%)',
    ref: 'LDB 51 (« Voleurs ! » narratif) — non chiffré, valeur maison (#327)',
    group: 'Voyage',
    kind: 'param',
    default: 25,
    min: 0,
    max: 100,
    step: 5,
    hint: 'Arbitrage #327 (2026-07-11) : quand une péripétie dangereuse terrestre (embuscade) se solde par un combat, la cargaison des porteurs du convoi subit une perte GRADUÉE par l’issue. Combat FUI : le convoi laisse ce % d’Enc de cargaison aux assaillants (défaut 25). RAW muet en mécanique de vol terrestre → paramètre maison.',
  },
  {
    id: 'landRobberyLossPct',
    label: 'Vol terrestre — perte de cargaison en cas de DÉFAITE (%)',
    ref: 'LDB 51 (« Voleurs ! » narratif) — non chiffré, valeur maison (#327)',
    group: 'Voyage',
    kind: 'param',
    default: 75,
    min: 0,
    max: 100,
    step: 5,
    hint: 'Arbitrage #327 (2026-07-11) : combat de vol terrestre PERDU → les assaillants pillent ce % d’Enc de cargaison du convoi (défaut 75). Combat gagné = 0 %. RAW muet → paramètre maison.',
  },
  {
    id: 'piratePillagePct',
    label: 'Cogue pirate — pillage de la cale en cas de soumission (%)',
    ref: 'MDG 15 p.131 (« prendre ce qu’ils veulent ») — non chiffré, valeur maison (#327)',
    group: 'Voyage',
    kind: 'param',
    default: 100,
    min: 0,
    max: 100,
    step: 5,
    hint: 'Arbitrage #327 (2026-07-11) : se SOUMETTRE à la Cogue pirate (MDG ch.15) laisse les forbans « fouiller la cale et prendre ce qu’ils veulent » — ce % d’Enc de cargaison du navire est pillé (défaut 100). Le RAW décrit l’extorsion sans la chiffrer → paramètre maison.',
  },
  {
    id: 'boardingWaveSize',
    label: 'Abordage — nombre d’assaillants qui montent à bord',
    ref: 'MDG 15 p.131 (« ils approchent… ») — vague d’abordage non chiffrée, valeur maison',
    group: 'Voyage',
    kind: 'param',
    default: 5,
    min: 1,
    max: 12,
    step: 1,
    hint: 'Un abordage (MDG ch.14/15) dérivé d’un événement de navire hostile engendre une vague d’assaillants de CE nombre (individus de l’équipage type de la coque), plus le chef éventuel — la coque ennemie entière (25/45 marins) est l’effectif du navire, jamais autant de figurants sur le pont. Le RAW décrit l’assaut sans chiffrer la vague → paramètre maison, éditable.',
  },
  {
    // #443 — le tableau ÇA VA LÂCHER, CAPITAINE ! (MDG 13 l.121-142) chiffre une CADENCE infra-journalière
    // (1 Test par heure/minute/Round selon la bande de survitesse) que la boucle de voyage, JOUR par jour,
    // ne modélise pas. « Test de parti » (acteur non nommé par le RAW, même arbitrage que le Dégagement
    // #444) résolu à ce grain : ce paramètre borne le nombre de Tests joués par jour de survitesse.
    id: 'sea-overspeed-tests-per-day',
    label: 'Survitesse : Tests d’Endurance par jour',
    ref: 'MDG 13 l.121-142 — cadence infra-journalière, résolution par jour maison (#443)',
    group: 'Voyage',
    kind: 'param',
    default: 1,
    min: 1,
    max: 6,
    hint: '« Ça va lâcher, capitaine ! » chiffre 1 Test par heure/minute/Round selon la bande de survitesse — la boucle de voyage résout un JOUR à la fois. Défaut : 1 Test (le pire des dégâts de la bande) par jour de survitesse ; augmenter pour accentuer le risque des bandes les plus sévères (M+7 et plus).',
  },
  {
    id: 'sea-chart-orientation-dr',
    label: 'Carte marine : bonus d’Orientation',
    ref: 'MDG 15 l.290 — 2 ports désignés : toute route = maison',
    group: 'Voyage',
    kind: 'param',
    default: 2,
    min: 0,
    max: 5,
    step: 1,
    hint: 'Une Carte marine donne +2 DR au Test d’Orientation quotidien (MDG 15 l.290), en principe UNIQUEMENT entre les deux ports désignés à sa création. Faute d’un graphe de ports navigables (chantier de la carte du monde), la carte aide ici sur TOUTE route maritime — simplification maison, éditable (0 = la carte n’aide plus).',
  },
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
