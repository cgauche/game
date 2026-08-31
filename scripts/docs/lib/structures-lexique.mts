// LEXIQUE FERMÉ des concepts de structure de la donnée — source UNIQUE consommée par
// `scripts/docs/build-structures.mts` (doc `docs/structures-donnees.md`) ET par la garde
// `src/data/structures-contrat.test.ts` via `scripts/docs/lib/structures-scan.mts`.
//
// LA RÉFÉRENCE EST ANCRÉE SUR L'INDEX DES IDS (#1465 passe 4). Une occurrence de référence n'est
// pas devinée d'un vocabulaire de clés : c'est une paire (objet, clé) dont la valeur RÉSOUT vers
// un document indexé. Le CHAMP PORTEUR (`skills`, `ops`, `members`, `requiresSkill`…) est donc
// MESURÉ — le lexique ne le déclare plus, et aucun seuil ne le décide.
// Le lexique ne garde que ce qu'un lexique peut dire :
//   la GRAPHIE d'une référence (`{id}`, `{id,spec}`, `{ref}`, `{skillId}`…) et son statut ;
//   les concepts de VALEUR, reconnus à leur NOYAU de clés (jamais à un champ porteur) ;
//   les rôles d'ENVELOPPE d'un document.
// Statuts : `cible` = forme visée · `historique` = graphie connue à éteindre · `declaree` = forme
// volontairement conservée · absente du lexique = `divergente`.
//
// Les signatures de statut `cible` sont FIGÉES AU STOCK (`STRUCTURES_CIBLES` de
// `scripts/guards/lib/structuresStock.mjs`, égalité stricte testée) : faire passer une graphie en
// `cible` exige de toucher le stock — un mot du lexique ne solde plus des centaines d'occurrences.

/** Signature canonique d'un objet : ses clés triées, jointes par des virgules. */
export const signature = (cles: readonly string[]): string => [...cles].sort().join(',');

export type StatutSignature = 'cible' | 'historique' | 'declaree';

/**
 * SITE d'une entrée de lexique — `(datasets × champs)`. Sans site, l'entrée vaut PARTOUT ; avec, elle
 * ne vaut qu'à ce site et une entrée SANS site sert de repli pour tous les autres. Le statut d'une
 * même graphie peut donc différer d'un porteur à l'autre — ce qui est le cas dès que la charge utile
 * appartient au porteur : `{id, value}` est la CIBLE d'une réf de Compétence de statbloc (la valeur
 * IMPRIMÉE y est un champ de la référence) et reste HISTORIQUE partout ailleurs (un `value` de
 * `trappings › qualities` est un Indice d'Atout, un `value` de `creatures › traits` un paramètre
 * d'entité — concepts lotés L3).
 *
 * Le DATASET seul ne suffit pas et c'est mesuré : `creatures.json` porte `{id,value}` sur `skills`
 * (cible) ET sur `traits`/`optionals` (historique). Le champ entre donc dans la clé.
 */
export type SiteDeSignature = { readonly datasets: readonly string[]; readonly champs: readonly string[] };
export type SignatureLexique = { sig: string; statut: StatutSignature; note?: string; site?: SiteDeSignature };

/** Les documents qui portent un STATBLOC à valeurs de Test imprimées : le bestiaire et les statblocs
 *  EMBARQUÉS des projets de scène (`CustomStatblock`). MÊME schéma des deux côtés
 *  (`defs/creatures.ts` et `defs-scenes/communs.ts` composent tous deux `refOuSpec('skill', {value})`). */
export const SITE_STATBLOC: SiteDeSignature = {
  datasets: ['creatures.json', 'arene-projet.json', 'barge-du-sel-projet.json', 'diligence-projet.json', 'loup-et-saumure-projet.json'],
  champs: ['skills'],
};

/**
 * Strate de la grammaire (#1463, design 2026-08-23) à laquelle une forme appartient.
 * QUATRE strates : la strate `Instance` du design v2 (SkillInstance, ItemInstance, snapshot de
 * sauvegarde) est HORS PÉRIMÈTRE PAR CONSTRUCTION — les deux racines mesurées ne portent que des
 * documents AUTHORÉS ; son dénominateur se mesurera sur le runtime et un snapshot de test
 * (#1463, commentaire « Arbitrages de design L0 (2026-08-23, orchestrateur — suite à la contre-passe
 * du commit 3a6017ebb) », point 1).
 */
export type Strate = 'Référence' | 'Valeur' | 'Ops' | 'Document';

/** Le dataset dont les références sont lotées L2 (les refs de Compétence) — #1463 design v2. */
export const CIBLE_COMPETENCE = 'skills.json';

/**
 * LOT d'extinction d'une ligne de stock : il se DÉDUIT du CONCEPT, il ne s'assigne pas à la main.
 * Un concept vit dans UN SEUL lot sur TOUS ses porteurs (#1463, commentaire « Arbitrages de design L0
 * (2026-08-23, orchestrateur — suite à la contre-passe du commit 3a6017ebb) », point 2) : `source` → L1d ; une référence → L2 quand sa cible est la Compétence,
 * L3 sinon ; toute autre valeur du lexique → L4 ; une structure hors lexique → L1a.
 */
export const lotDeForme = (concept: string, signature: string, cibles: readonly string[] = []): string =>
  concept === 'source'
    ? 'L1d #1469'
    : concept === 'reference' || concept === 'refs'
      ? cibles.includes(CIBLE_COMPETENCE) || /skill/i.test(signature)
        ? 'L2 #1463'
        : 'L3 #1463'
      : concept
        ? 'L4 #1463'
        : 'L1a #1466';

/** Lot d'extinction de chaque clé RÉSERVÉE : celui du concept qui POSSÈDE le nom (#1463 S2). */
export const LOT_CLE_RESERVEE: Readonly<Record<string, string>> = {
  skill: 'L2 #1463',
  talent: 'L3 #1463',
  char: 'L4 #1463',
  price: 'L4 #1463',
  cost: 'L4 #1463',
  count: 'L4 #1463',
  source: 'L1d #1469',
};

/** Les 9 lots d'extinction du chantier — un `lot` de stock hors de cette liste est une dérive.
 *  `L2 #1548` porte les graphies de RÉFÉRENCE du lot L2 (« une graphie par concept référencé ») ;
 *  `#1553` porte la CURATION des orphelines (contenu qui ne résout vers rien), qui n'est pas une
 *  forme d'enveloppe. */
export const LOTS_CONNUS = ['L1a #1466', 'L1b #1467', 'L1c #1468', 'L1d #1469', 'L2 #1463', 'L2 #1548', 'L3 #1463', 'L4 #1463', '#1553'] as const;

/**
 * ANGLES MORTS de la mesure — SOURCE UNIQUE, consommée par la garde
 * (`src/data/structures-contrat.test.ts`, `GARDE.angleMort`), par le générateur
 * (`docs/structures-donnees.md`, § « Périmètre mesuré et angles morts ») et par l'en-tête de
 * `scripts/guards/lib/structuresStock.mjs` (la garde vérifie que l'en-tête les porte TOUS).
 */
export const ANGLES_MORTS: readonly string[] = [
  'La référence est ANCRÉE SUR L’INDEX DES IDS, scopé par DATASET : une occurrence de référence est une paire (objet, clé) dont la valeur RÉSOUT vers un document indexé d’une CIBLE MAJORITAIRE de son site. Le CHAMP PORTEUR (`skills`, `ops`, `members`…) est MESURÉ, jamais déclaré.',
  'La RÉSOLUTION est PAR SITE `(dataset, champ, clé)` : cible(s) MAJORITAIRE(S) = les datasets qui couvrent ≥ 50 % des valeurs résolvantes du site. Une valeur qui ne résout QUE vers une cible non majoritaire est comptée AMBIGUË (§1bis, imprimée avec son site et son dataset parasite) et n’ouvre PAS de référence.',
  'Les COLLISIONS d’ids restent un angle mort du PILOTAGE, pas de la résolution : la colonne « cibles » d’une forme liste tous les datasets atteignables par les valeurs de la ligne.',
  'LOT, MOTIF et DATE d’une forme sont du PILOTAGE : la sonde ne les mesure pas — la forme OBSERVÉE les reprend du stock par son SITE (concept, dataset, champ, signature), si bien que la véracité d’un `motif` est une décision de REVUE qu’aucune garde ne contrôle.',
  'La RÉSOLVABILITÉ d’un `{text}` se mesure sur le LIBELLÉ NORMALISÉ (casse, accents, ponctuation, espaces) d’une entité d’un dataset de la CIBLE MAJORITAIRE de son site — de n’importe quel dataset quand le site n’a pas de cible ; elle ne vérifie AUCUN type d’entité attendu, et un `label` qui est aussi un id peut la faire mordre sur un homonyme : la forme `text (résolvable)` est un candidat à migrer en `{id}`, pas un verdict.',
  'Le partage d’un SITE tranche entre référence cassée et document embarqué, mais les TELLS de document passent avant le ratio (`label` + `source`, ou `label` + ≥ 2 clés de charge utile) et l’égalité tranche pour le DOCUMENT ; un site à UNE seule valeur est un document, sauf si la clé est `…Id`/`…Ids`/`…Ref`.',
  'L’ORDRE DES PASSES est un angle mort déclaré : l’index est complété par les documents EMBARQUÉS (passe 3) AVANT que la résolution ne soit mesurée (passe 4) — un site comme `arene-projet.json › members {entityId}` ne résout que grâce à cet ordre.',
  'Une clé dont la valeur est un LITTÉRAL D’ENUM du schéma zod du document n’ouvre jamais de référence (discriminants `kind`/`type`/`class`/`op`…). Depuis #1466 L1a les DEUX racines sont au registre (`SCHEMA_DEFS` + `SCHEMA_DEFS_SCENES`, joints par BASENAME) : les discriminants des scènes sont fermés comme les autres. La fermeture reste bornée à ce que l’introspection atteint — un littéral sous une enveloppe qu’`enfantsDe` ne traverse pas y échappe.',
  'Les clés de PROSE `label`/`nom`/`desc`/`title` n’ouvrent jamais de référence ; `text` sous un champ de dotation est l’exception unique (résolution NARRATIVE #624).',
  'La strate `Instance` du design v2 (SkillInstance, ItemInstance, saves) est DÉCLARÉE HORS PÉRIMÈTRE, pas absente : elle existe en SNAPSHOTS nommés dans la racine `src/scenes` — `barge-du-sel-projet.json` et `loup-et-saumure-projet.json` sous `scenes[].entities[].postes[].ammo[]` (des `ItemInstance` recopiées par `src/engine/items.ts`). Ces chemins ne sont pas mesurés ; `saves` a en outre sa propre politique de version (`src/state/saves.ts`).',
  'Les ABSENCES d’enveloppe ne se comptent que sur les ENTRÉES DE RACINE (`id` et `source` partout, `label` sur les familles `entité`/`table`) : un document EMBARQUÉ n’est jamais sommé de porter un `id`.',
  'Le RÉGIME D’ENTRÉES vient de la famille DÉCLARÉE par le schéma zod (`liste` → les éléments, `record` → les valeurs, `config` → le document EST son entrée) ; un document qu’aucune def ne déclare serait classé par sa racine JSON — depuis #1466 L1a il n’y en a plus aucun, les quatre projets de `src/scenes` sont déclarés `config`. La FAMILLE mesurée (`entité`/`table`/`config`/`record`) se déduit du régime : `record` et `config` RECOPIENT la déclaration (régime `valeurs` / `racine`), seule la partition `entité` ⊕ `table` est observée (part des entrées à bornes numériques). Depuis #1467 L1b V-FLIP-RECORD, le régime `valeurs` descend dans `entries` quand le record porte son enveloppe.',
  'Une valeur mesurée hors de sa forme propre est enregistrée sous sa PROJECTION sur le vocabulaire du concept, suffixée `+…` ; de même pour une référence (clés de graphie + clés qui résolvent, charge utile repliée).',
  'La candidature `plage` est STRUCTURELLE : élément d’un TABLEAU portant `min` ET `max` NUMÉRIQUES. Un `{min,max}` porté par un champ hors tableau n’est pas mesuré comme plage.',
  'Un concept exprimé en SCALAIRE hors liste (`species: "humain"`) est mesuré sous la forme `id-nu`, sans signature d’objet.',
  '`kind` est polysémique et n’est pas dédoublonné (Condition, Flow, événement de mer, pion de scène).',
  'Le classement est ORDONNÉ : une VALEUR (reconnue à son noyau) passe avant une RÉFÉRENCE ; un objet qui recoupe deux concepts n’est compté qu’une fois.',
  'Deux comparateurs de `water-exposure.json` (`<=`/`>=` sous `woundsRemaining`/`woundsLost`) échappent à `conditionSchema` et restent comptés en op.',
  'Le scan AST est borné aux littéraux `z.object`/`z.strictObject`/`z.looseObject` des `src/data/schemas/defs/*.ts` : il ne voit ni les clés ajoutées par `.extend(...)`, ni un schéma composé par une fabrique, ni les defs hors de ce dossier. Le « schéma commun candidat » est apparié par SIGNATURE EXACTE.',
  'Les portes MOTEUR (`src/engine`, `src/state`) et les JSON hors documents (outillage, `public/qc/*`, baselines de gardes) ne sont pas mesurés : ce contrat parle de la DONNÉE authorée et de ses schémas.',
  'Les CACHES de parse AST (`CACHE_SOURCE`, `CACHE_LITTERAUX`) sont module-level et ne sont jamais invalidés : en mode watch, une édition d’un `defs/*.ts` n’est pas re-mesurée sans redémarrage.',
];

/**
 * MANDAT du volet SLOTS — SOURCE UNIQUE de la phrase, jamais recopiée : le doc l'ÉMET (§6), la garde
 * `src/data/slots-contrat.test.ts` l'assère, les autres sites y RENVOIENT.
 */
export const MANDAT_SLOTS =
  'Ce volet est le REMPLAÇANT committé du « test FK générique » re-scopé au commentaire #1466 du 2026-08-23 : « le registre des SLOTS pour `docs/structures-donnees.md` (déclaré × observé) ».';

/**
 * ANGLES MORTS du volet SLOTS — SOURCE UNIQUE, même patron que `ANGLES_MORTS` (le doc les émet, la
 * garde les référence, l'en-tête du stock en porte la copie et la garde compare les trois).
 */
export const ANGLES_MORTS_SLOTS: readonly string[] = [
  'L’espèce `acteur` (`actorRefSchema`) est HORS résolution : elle désigne l’acteur d’une mécanique par un ENUM, pas l’id d’une entité d’un dataset — ce n’est pas une FK.',
  'Un slot dont le `type` n’est pas un type du registre `_ids.generated` (entité INTERNE à une scène : pion, nœud de dialogue) n’est pas résoluble ici — l’index qui les porte est celui du scan (documents EMBARQUÉS), pas le registre généré. Ces slots sont au stock `SLOTS_INTERNES`, listés et jamais résolus ; l’unification passe par `typedRef` en L2 (#1473).',
  'La PROJECTION path → champ retient le DERNIER segment-clé : deux paths distincts qui finissent sur la même clé se joignent au même champ observé (couverture sur-estimée à la marge).',
  '`valeursAuPath` ne descend PAS dans une branche d’union (`|N`) : la branche servie est celle qui parse, la donnée ne la porte pas — un slot sous union rend 0 valeur posée, et la résolution y est vacueuse.',
];

/**
 * DÉCLARÉ-AVANT-POSÉ ASSUMÉ (`cible-declaree`) — une famille de formes que le schéma déclare et que
 * la donnée ne porte pas ENCORE, avec le LOT qui la peuplera. Ce n'est PAS un stock : un stock ne
 * fait que décroître, une cible déclarée se solde en PEUPLANT la donnée (elle quitte alors la mesure
 * d'elle-même). Le doc l'ÉMET (§2.4 table B) ; le contenu de la table est MESURÉ, seuls la date et
 * le lot de peuplement se déclarent ici.
 */
export type LotDePeuplement = { readonly lot: string; readonly date: string };
export const LOTS_DE_PEUPLEMENT: Readonly<Record<string, LotDePeuplement>> = {
  // Les 57 variantes d'`Effect` sont passées en zod au commit ee98da334 (#1466 L1a T3-b) ; celles
  // qu'aucune scène ne pose encore sont écrites du DÉCLARÉ seul, en attente d'adoption.
  'variante d’`Effect`': { lot: 'adoption scènes (L1b #1467 et suivants)', date: '2026-08-24' },
};

export type Concept = {
  id: string;
  label: string;
  strate: Strate;
  signatures: readonly SignatureLexique[];
  /**
   * Le concept est ANCRÉ SUR L'INDEX DES IDS : ses instances sont les objets dont au moins une
   * valeur résout vers un document indexé. Porte aussi la colonne « résolvables » du doc — un
   * ATTRIBUT DÉCLARÉ sur l'entrée, jamais un test d'identité au call-site (#842).
   */
  resolvables?: boolean;
  /** Concept exprimé en TABLEAU de chaînes (liste d'ids nus) : pas de signature d'objet. */
  listeIdsNus?: boolean;
  /** Le concept est nommé par la CLÉ qui le porte — déclaré, jamais mesuré à un seuil. */
  champs?: readonly string[];
  /** Clés dont la présence (au moins `noyauMin`) classe un objet dans le concept. */
  noyau?: readonly string[];
  noyauMin?: number;
  /** Le concept n'est candidat que si le SITE d'appel l'a mesuré (cf. `contexte.candidats`). */
  exigeCandidatureStructurelle?: boolean;
  /**
   * Graphies ENVELOPPANTES dont CE concept mesure la réconciliation nue/enveloppée dans le doc
   * (#842 : le comportement se déclare sur l'entrée du registre, jamais à un test d'identité au
   * call-site) — seul le concept qui POSSÈDE des graphies enveloppantes porte ce champ.
   */
  graphiesEnveloppantes?: readonly string[];
};

/**
 * Graphies ENVELOPPANTES : une clé de graphie sous laquelle pend un OBJET (ou un tableau d'objets)
 * plutôt qu'un id nu. L'intérieur porte le CHEMIN de graphie dans sa signature (`ref>id`,
 * `wildcard>id`, `choice>id`) et HÉRITE du statut de l'enveloppe : `{ref:{id}}` se lit
 * `ref>id / historique`, jamais `id / cible` (#1463, commentaire « Arbitrages de design L0
 * (2026-08-23, orchestrateur — suite à la contre-passe du commit 3a6017ebb) », point 4).
 */
export const GRAPHIES_ENVELOPPANTES = ['ref', 'wildcard', 'choice', 'random'] as const;

/** Concepts, du plus discriminant au plus général (le premier qui matche gagne). */
export const CONCEPTS: readonly Concept[] = [
  {
    id: 'reference',
    label: 'référence à une entité',
    strate: 'Référence',
    resolvables: true,
    graphiesEnveloppantes: GRAPHIES_ENVELOPPANTES,
    signatures: [
      { sig: 'id', statut: 'cible' },
      { sig: 'id,spec', statut: 'cible' },
      { sig: 'choix,id', statut: 'cible', note: 'choix borné / libre (DESIGN v2 S2)' },
      { sig: 'id,type', statut: 'cible', note: 'slot de dotation polymorphe' },
      { sig: 'count,id,type', statut: 'cible' },
      { sig: 'of,pick', statut: 'cible', note: 'tirage parmi un ensemble borné' },
      { sig: 'pick,table', statut: 'cible', note: 'tirage sur une table nommée' },
      // Les trois lignes SITE-QUALIFIÉES ci-dessous passent AVANT leurs homonymes sans site : au
      // statbloc, la valeur IMPRIMÉE est un champ de la référence — `#1463` (« Faits tranchés au
      // Source ») : « `value` = le seul nom du NOMBRE IMPRIMÉ au statbloc », et sa clause de
      // composition « `value` requis sur un statbloc ». `advances` est le nom du RANG ACHETÉ en PX
      // (Augmentation, `LDB 07`, `docs/raw/avancement.md:27`), qui vit sur l'INSTANCE, pas ici.
      // RÉSERVE OUVERTE, dite et non tranchée (commit de préservation `772a217cc`, verbatim
      // utilisateur) : « la forme {id, spec|choix, value} n'est PAS le schéma final — #1463 tranche un
      // noyau générique de référence + compositions fermées ; `value`/`times`/avances = un seul rang
      // acheté en PX, à nommer au RAW ». Ce qui est CIBLE ici est la COMPOSITION (charge utile portée
      // par la référence) ; le NOM du champ reste un point ouvert de L5.
      { sig: 'id,value', statut: 'cible', site: SITE_STATBLOC, note: 'réf de Compétence de STATBLOC + son nombre imprimé (`refOuSpec(\'skill\', {value})`)' },
      { sig: 'id,spec,value', statut: 'cible', site: SITE_STATBLOC, note: 'idem, spécialisation DÉSIGNÉE' },
      { sig: 'choix,id,value', statut: 'cible', site: SITE_STATBLOC, note: 'idem, spécialisation À CHOISIR (libre ou bornée) — désignée au spawn' },
      { sig: 'id,value', statut: 'historique', note: 'charge utile `value` à plat sur une référence dont le porteur n’est PAS un statbloc (Indice d’Atout, paramètre d’entité) — #1463 S2' },
      { sig: 'id,spec,value', statut: 'historique', note: '#1463 « Cible précisée » l’énumère parmi les 5 graphies historiques, son 1er paragraphe la dit champ optionnel de la MÊME structure — L0 retient l’énumération hors statbloc (une ligne de stock se retire, elle ne se devine pas)' },
      { sig: 'arg,id', statut: 'historique', note: 'paramètre d’entité non déclaré (#1463 S2 A11)' },
      { sig: 'arg,id,value', statut: 'historique' },
      { sig: 'count,id', statut: 'historique' },
      { sig: 'count,text', statut: 'historique' },
      { sig: 'id,times', statut: 'historique' },
      { sig: 'id,qualityChoice', statut: 'historique' },
      { sig: 'ref', statut: 'historique', note: 'ref emboîtée {ref:{id,spec}} ou id nu sous `ref`' },
      { sig: 'wildcard', statut: 'historique' },
      { sig: 'specOptions,wildcard', statut: 'historique' },
      { sig: 'skillId', statut: 'historique' },
      { sig: 'skillId,spec', statut: 'historique' },
      { sig: 'skill,spec', statut: 'historique' },
      { sig: 'talentId', statut: 'historique' },
      { sig: 'trappingId', statut: 'historique' },
      { sig: 'creatureId', statut: 'historique' },
      { sig: 'vehicleId', statut: 'historique' },
      { sig: 'career', statut: 'historique' },
      { sig: 'choice', statut: 'historique' },
      { sig: 'random', statut: 'historique' },
      { sig: 'text', statut: 'declaree', note: 'dotation narrative — occurrence de référence seulement quand le texte normalisé résout vers un `label` (#1463, #624)' },
      { sig: 'id-nu', statut: 'historique', note: 'référence portée par un CHAMP SCALAIRE d’un document (`species: "humain"`) — la cible est un objet de référence' },
    ],
  },
  {
    id: 'refs',
    label: 'liste de références (ids nus)',
    strate: 'Référence',
    listeIdsNus: true,
    signatures: [
      {
        sig: 'ids-nus',
        statut: 'cible',
        note: 'tableau de chaînes dont au moins un élément résout — forme CIBLE, DESIGN v2 S2 (#1463, 2026-08-23) : « `refs(type)` = liste d’ids nus brandée (75 champs `string[]`) ». Ce qui reste est le TYPAGE du champ, pas une réécriture de la donnée.',
      },
    ],
  },
  {
    id: 'monnaie',
    label: 'somme d’argent',
    strate: 'Valeur',
    signatures: [
      { sig: 'brass,gold,silver', statut: 'cible' },
      { sig: 'bronze,gold,silver', statut: 'historique', note: 'bronze = erreur de traduction, collisionne StatusTier' },
      { sig: 'gold,silver', statut: 'historique' },
    ],
    noyau: ['gold', 'silver'],
    noyauMin: 1,
  },
  {
    id: 'prix',
    label: 'prix (Money | saisonnier | dé | ND)',
    strate: 'Valeur',
    champs: ['price'],
    signatures: [
      { sig: 'automne,ete,hiver,printemps', statut: 'declaree', note: 'coefficient SAISONNIER — `Price = Money | {saison} | {dice} | "ND"` (DESIGN v2 S4) : ce n’est pas une bourse à éteindre' },
      { sig: 'dice', statut: 'declaree', note: 'prix TIRÉ (DESIGN v2 S4)' },
    ],
  },
  {
    id: 'de',
    label: 'lancer de dés',
    strate: 'Valeur',
    signatures: [
      { sig: 'n,sides', statut: 'cible' },
      { sig: 'n,plus,sides', statut: 'cible' },
    ],
    noyau: ['n', 'sides'],
  },
  {
    id: 'source',
    label: 'référence de source (livre/folio)',
    strate: 'Valeur',
    signatures: [
      { sig: 'book,page', statut: 'cible' },
      { sig: 'book,note,page', statut: 'cible', note: 'note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`)' },
      { sig: 'book,chapter', statut: 'historique', note: 'folio obligatoire (#1463, 2026-08-23)' },
      { sig: 'book,chapter,page', statut: 'historique' },
    ],
    noyau: ['book'],
  },
  {
    id: 'test',
    label: 'jet à faire (compétence/caractéristique + difficulté)',
    strate: 'Valeur',
    signatures: [
      { sig: 'difficulty,skill', statut: 'historique' },
      { sig: 'char,difficulty', statut: 'historique' },
      { sig: 'characteristic,difficulty', statut: 'historique' },
      { sig: 'difficulty,skillId', statut: 'historique' },
    ],
    noyau: ['difficulty'],
  },
  {
    id: 'plage',
    label: 'plage de tirage (min,max)',
    strate: 'Valeur',
    signatures: [
      { sig: 'max,min', statut: 'cible', note: 'cible = portée par `range` d’une entrée de table (#1463 S1)' },
    ],
    noyau: ['min', 'max'],
    exigeCandidatureStructurelle: true,
  },
  {
    id: 'quantite',
    label: 'quantité (CountSpec : fixe ou tirée)',
    strate: 'Valeur',
    signatures: [
      { sig: 'fixed', statut: 'cible' },
      { sig: 'roll', statut: 'cible' },
    ],
    noyau: ['fixed'],
  },
  {
    id: 'sequence',
    label: 'paramètres de séquence jouée en manches',
    strate: 'Valeur',
    signatures: [],
    noyau: ['target', 'drCap', 'table', 'rounds', 'phases', 'pot', 'volley', 'sides', 'combined', 'throwerPenalty'],
    noyauMin: 2,
  },
];

/** Le concept ANCRÉ sur l'index des ids (attribut déclaré, jamais un test d'identité au call-site). */
export const CONCEPT_REFERENCE = CONCEPTS.find((c) => c.resolvables)!;

/**
 * GRAPHIE d'une référence : toutes les clés que les signatures de référence du lexique nomment.
 * Elle ne sert qu'à PROJETER la signature d'un objet porteur (garder les clés de graphie, replier
 * la charge utile en `+…`) — jamais à décider qu'un objet est une référence : c'est la RÉSOLUTION
 * vers l'index des ids qui le décide. Ajouter un mot ici ne peut donc pas fabriquer une référence.
 */
export const GRAPHIE_REFERENCE: ReadonlySet<string> = new Set(
  CONCEPT_REFERENCE.signatures.flatMap((s) => s.sig.split(',')).filter((k) => !k.includes('-')),
);

/**
 * Clés de PROSE : leur valeur est un texte d'affichage, jamais une référence — même quand le texte
 * égale par homonymie l'id ou le libellé d'une entité. Exception unique : `text` sous un champ de
 * dotation, dont la résolution NARRATIVE est déclarée (#624).
 */
export const CLES_PROSE_SANS_REFERENCE = ['label', 'nom', 'desc', 'title'] as const;

/** Clés d'IDENTITÉ d'un document (la cible `id`, ses graphies divergentes). */
export const CLES_IDENTITE = ['id', 'key', 'nom'] as const;

/** Clé dont le NOM annonce une référence : elle DOIT résoudre, sinon c'est une FK morte (L1a). */
export const RX_CLE_REFERENCE = /(Id|Ids|Ref)$/;

/**
 * Clés dont le NOM est réservé à un concept (DESIGN v2 S2 « homonymes ») : si la même clé porte
 * ≥ 2 classes de type dans la donnée, c'est un homonyme nominatif — il entre au stock.
 */
export const CLES_RESERVEES = ['skill', 'char', 'talent', 'price', 'cost', 'count', 'source'] as const;

export type RoleEnveloppe = {
  cible: string | null;
  divergentes: readonly string[];
  typeAttendu?: string;
  /** L'absence de la cible sur une ENTRÉE DE RACINE est elle-même une divergence. */
  requise?: boolean;
  /** Requise sur les seules familles de document citées (`entité`, `table`). */
  requiseSurFamilles?: readonly string[];
};

/**
 * Rôles d'ENVELOPPE d'un document (§2 du doc) : pour chaque rôle, la clé CIBLE (`null` = le rôle
 * n'a pas de forme cible : toute clé qui le porte est une divergence), les clés DIVERGENTES qui le
 * portent sous un autre nom, la classe de type ATTENDUE de la cible, et si l'absence de la cible
 * est elle-même une divergence.
 *
 * Les ABSENCES ne se comptent que sur les ENTRÉES DE RACINE : un document EMBARQUÉ (étape de Flow,
 * rangée de table, modificateur de vent) n'est jamais sommé de porter un `id` ni une `source` — on
 * n'y compte que les clés DIVERGENTES.
 */
export const ROLES_ENVELOPPE: Record<string, RoleEnveloppe> = {
  identité: { cible: 'id', divergentes: ['key', 'nom'], typeAttendu: 'string', requise: true },
  libellé: { cible: 'label', divergentes: ['nom'], typeAttendu: 'string', requiseSurFamilles: ['entité', 'table'] },
  // `title` est un SECOND champ d'affichage, qui COEXISTE avec le libellé (#1467 L1b V-P7) — d'où son
  // rôle propre. Mesuré : `creatures.json` (490 entrées) et `gods.json` (40) portent `label` ET
  // `title`, et les deux sont RENDUS — `title` est le sous-titre de la fiche du Codex (`registry.ts`,
  // specs `gods` et `creatures` : `sub: c.title`), `label` en est le nom. Les confondre en un seul rôle
  // détruirait un des deux affichages à la migration.
  // Pas de `typeAttendu` : `title` admet `null` — 437 des 490 entrées de `creatures.json` le portent
  // ainsi (`z.string().nullable()`), l'absence de sous-titre étant un ÉTAT MODÉLISÉ du dataset. Le
  // devenir de ces 437 nuls et des 53 valeurs réelles se tranche en #1541, pas dans le détecteur.
  'sous-titre': { cible: 'title', divergentes: [] },
  // `effect`, `rules` et `hint` ont été RETIRÉS des divergentes (#1467 L1b V-P2) : le détecteur
  // classait par NOM de clé, pas par TYPE, et ces trois-là ne portent pas de prose.
  //   `crew-morale.json › factors[].effect` = expression de dés lue par `rollExpr`
  //     (`src/data/schemas/defs/crew-morale.ts:22-23`) ;
  //   `sea-events.json › manann.factors[].effect` = objet `{sign, flat, d10}`
  //     (`src/data/schemas/defs/sea-events.ts:19-23`) ;
  //   `hint` = qualificatif d'affichage d'un marqueur de cargaison
  //     (`src/data/schemas/defs/land-cargo.ts:37-38`) et aide de saisie d'une règle optionnelle
  //     (`src/data/schemas/defs/reglesOptionnelles.ts:42`) ;
  //   `speciesRace.json › rules` = tableau de règles (`src/data/schemas/defs/speciesRace.ts:23`).
  // Les `effect` qui ÉTAIENT des issues ou une clé de registre ont, eux, été migrés (`outcome`,
  // `potEffectId`, `ops`) plutôt que retirés de la mesure.
  prose: { cible: 'desc', divergentes: ['text', 'description'] },
  source: { cible: 'source', divergentes: [], typeAttendu: 'object', requise: true },
  maison: { cible: 'maison', divergentes: [], typeAttendu: 'string' },
  'méta libre': { cible: null, divergentes: ['_source', '_comment', '_doc', '__genere', '__lecture', '__livres'] },
};

/** Toutes les clés recensées d'un rôle, cible comprise (l'ordre du doc : cible d'abord). */
export const clesDuRole = (role: RoleEnveloppe): string[] => [...(role.cible ? [role.cible] : []), ...role.divergentes];

/** Vocabulaire propre des concepts de VALEUR : toutes les clés que leurs signatures et noyaux nomment. */
export const CLES_DE_VALEUR: ReadonlySet<string> = new Set(
  CONCEPTS.filter((c) => !c.resolvables && !c.listeIdsNus).flatMap((c) => [
    ...c.signatures.flatMap((s) => s.sig.split(',')),
    ...(c.noyau ?? []),
  ]),
);
