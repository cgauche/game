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
export type SignatureLexique = { sig: string; statut: StatutSignature; note?: string };

/** Strate de la grammaire (#1463, design 2026-08-23) à laquelle une forme appartient. */
export type Strate = 'Référence' | 'Valeur' | 'Ops' | 'Document';

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
};

/** Concepts, du plus discriminant au plus général (le premier qui matche gagne). */
export const CONCEPTS: readonly Concept[] = [
  {
    id: 'reference',
    label: 'référence à une entité',
    strate: 'Référence',
    resolvables: true,
    signatures: [
      { sig: 'id', statut: 'cible' },
      { sig: 'id,spec', statut: 'cible' },
      { sig: 'choix,id', statut: 'cible', note: 'choix borné / libre (DESIGN v2 S2)' },
      { sig: 'id,type', statut: 'cible', note: 'slot de dotation polymorphe' },
      { sig: 'count,id,type', statut: 'cible' },
      { sig: 'of,pick', statut: 'cible', note: 'tirage parmi un ensemble borné' },
      { sig: 'pick,table', statut: 'cible', note: 'tirage sur une table nommée' },
      { sig: 'id,value', statut: 'historique', note: 'charge utile `value` à plat sur la référence — la cible la porte sous `advances` (#1463 S2)' },
      { sig: 'id,spec,value', statut: 'historique', note: '#1463 « Cible précisée » l’énumère parmi les 5 graphies historiques, son 1er paragraphe la dit champ optionnel de la MÊME structure — L0 retient l’énumération (une ligne de stock se retire, elle ne se devine pas)' },
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
      { sig: 'ids-nus', statut: 'historique', note: 'tableau de chaînes dont au moins un élément résout — la cible est une liste d’objets de référence (#1463 S2)' },
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
      { sig: 'book,note,page', statut: 'cible', note: 'note = précision optionnelle de `sourceRefSchema` (`src/data/schemas/common.ts`)' },
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
  libellé: { cible: 'label', divergentes: ['nom', 'title'], typeAttendu: 'string', requiseSurFamilles: ['entité', 'table'] },
  prose: { cible: 'desc', divergentes: ['text', 'description', 'effect', 'rules', 'hint'] },
  source: { cible: 'source', divergentes: [], typeAttendu: 'object', requise: true },
  maison: { cible: 'maison', divergentes: [], typeAttendu: 'string' },
  'méta libre': { cible: null, divergentes: ['_source', '_comment', '_doc', '__genere', '__lecture', '__livres'] },
};

/** Toutes les clés recensées d'un rôle, cible comprise (l'ordre du doc : cible d'abord). */
export const clesDuRole = (role: RoleEnveloppe): string[] => [...(role.cible ? [role.cible] : []), ...role.divergentes];
