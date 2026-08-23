// SONDE des structures OBSERVÉES dans la donnée — moteur de mesure partagé par le générateur
// `scripts/docs/build-structures.mts` et la garde `src/data/structures-contrat.test.ts`.
// Aucun rendu ici : uniquement des mesures (l'affichage vit dans le générateur, le stock dans
// `scripts/guards/lib/structuresStock.mjs`).
//
// Deux RACINES de documents, déclarées UNE fois dans `RACINES` (consommée par `listerDocuments`).
// Les JSON sont lus UNE fois par run ; toutes les passes ci-dessous travaillent en mémoire.
//
// LE CŒUR EST L'INDEX DES IDS. Quatre passes, dans cet ordre (ordre = angle mort déclaré) :
//   1. INDEX RACINE   — l'identité de chaque entrée de racine (`id`/`key`/`nom`, ou la clé du
//      record) : `id → Set<dataset>`.
//   2. CHAMPS DE RÉFÉRENCE MESURÉS — tout objet portant une valeur chaîne qui résout dans l'index
//      racine fait de la clé de son parent un CHAMP porteur de références (mesuré, jamais déclaré).
//   3. DOCUMENTS EMBARQUÉS — objet à clé d'identité, sans `op`, dont le SITE (dataset, champ, clé
//      d'identité) ne porte pas majoritairement des références. Leurs ids complètent l'index.
//      C'est le SITE qui tranche, jamais la seule valeur : un id de spécialisation qui collisionne
//      avec l'id d'une carrière ne fait pas d'un `{id,label}` une référence.
//   4. MESURE — occurrences de référence, formes de valeur, ops, enveloppe, orphelines.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import {
  CLES_IDENTITE,
  CLES_RESERVEES,
  CONCEPTS,
  CONCEPT_REFERENCE,
  GRAPHIE_REFERENCE,
  ROLES_ENVELOPPE,
  RX_CLE_REFERENCE,
  signature,
  type Concept,
  type Strate,
} from './structures-lexique.mjs';

export type Racine = {
  id: string;
  dir: string;
  motif: string;
  suffixe: string;
  recursif: boolean;
  /** Les documents de cette racine sont-ils attendus au registre zod (#1463 L1) ? */
  auRegistre: boolean;
};

export const RACINES: readonly Racine[] = [
  { id: 'src/data', dir: 'src/data', motif: '*.json', suffixe: '.json', recursif: false, auRegistre: true },
  { id: 'src/scenes', dir: 'src/scenes', motif: '*-projet.json', suffixe: '-projet.json', recursif: true, auRegistre: false },
];

export type Document = { racine: string; chemin: string; nom: string };

/** Classe de type d'une valeur JSON (jamais `typeof` nu : `null` et les tableaux comptent à part). */
const classeDeType = (v: unknown): string =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v;

/**
 * RÉGIME D'ENTRÉES d'un document : d'où viennent ses entrées, donc de qui sont les « clés de
 * premier niveau ». La famille DÉCLARÉE (introspection zod, `zod-introspect.mts`) tranche :
 *   `liste`  → `elements` : une entrée par élément du tableau racine ;
 *   `record` → `valeurs`  : une entrée par valeur de l'objet racine ;
 *   sinon    → `racine`   : le document EST son entrée (famille `config`), ses clés de premier
 *                           niveau sont celles de sa racine.
 * Hors registre (les documents de scène), la racine JSON tranche seule, même règle.
 */
const regimeEntrees = (racineJson: string, familleDeclaree?: string): 'elements' | 'valeurs' | 'racine' => {
  if (familleDeclaree?.startsWith('liste')) return 'elements';
  if (familleDeclaree?.startsWith('record')) return 'valeurs';
  if (familleDeclaree) return 'racine';
  return racineJson === 'array' ? 'elements' : 'racine';
};

/** Liste les documents des deux `RACINES`, chemins POSIX relatifs à la racine du dépôt. */
export function listerDocuments(root: string): Document[] {
  const out: Document[] = [];
  for (const racine of RACINES) {
    const base = join(root, racine.dir);
    const marche = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
          if (racine.recursif) marche(p);
        } else if (e.name.endsWith(racine.suffixe) && !e.name.startsWith('_')) {
          out.push({ racine: racine.id, chemin: relative(root, p).split('\\').join('/'), nom: e.name });
        }
      }
    };
    if (statSync(base).isDirectory()) marche(base);
  }
  return out.filter((d, i, xs) => xs.findIndex((x) => x.chemin === d.chemin) === i);
}

const inc = <K,>(m: Map<K, number>, k: K, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

/** Régime d'une valeur de `price` (la colonne Prix du RAW n'a pas UNE forme, elle en a plusieurs). */
const regimePrix = (v: unknown): string =>
  v === null
    ? 'absent (null)'
    : Array.isArray(v)
      ? 'tableau'
      : typeof v === 'object'
        ? `objet {${signature(Object.keys(v as object))}}`
        : typeof v === 'string'
          ? v === 'ND'
            ? "littéral « ND »"
            : 'chaîne libre'
          : typeof v === 'number'
            ? 'nombre'
            : typeof v === 'boolean'
              ? 'booléen'
              : 'autre';

/** Texte normalisé pour la résolution d'un `{text}` vers un libellé d'entité (casse/accents/espaces). */
const normaliserLibelle = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** NATURE devinée d'une valeur d'`arg` — dénominateur A11 de #1466 (motif, jamais un verdict). */
const natureParametre = (v: string): string => {
  if (/^-?\d+(\.\d+)?$/.test(v)) return 'nombre';
  if (/^\d+\+$/.test(v)) return 'seuil `N+`';
  if (/^(tres-petit|petit|moyen|grand|enorme|monstrueux)$/i.test(v)) return 'taille';
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(v)) return 'id d’entité';
  if (/\s/.test(v.trim()) && v.trim().split(/\s+/).length > 3) return 'prose';
  return 'enum-libellé';
};

export type Contexte = {
  /** Nom de la clé sous laquelle l'objet pend (`''` = racine du document). */
  champ: string;
  /** Concepts dont le SITE d'appel a mesuré la candidature structurelle (cf. `plage`). */
  candidats?: readonly string[];
};

export type Classement = {
  concept: string;
  strate: Strate;
  statut: 'cible' | 'historique' | 'declaree' | 'divergente';
  note: string;
  signature: string;
};

/** Concepts de VALEUR : tous ceux que l'index des ids ne décide pas (ni référence, ni liste d'ids). */
const CONCEPTS_VALEUR = CONCEPTS.filter((c) => !c.resolvables && !c.listeIdsNus);

const statutDe = (c: Concept, sig: string): Classement => {
  const hit = c.signatures.find((s) => s.sig === sig);
  return { concept: c.id, strate: c.strate, statut: hit?.statut ?? 'divergente', note: hit?.note ?? '', signature: sig };
};

/**
 * Classement d'un objet dans un concept de VALEUR — par le NOM de la clé qui le porte quand le
 * concept en déclare un (`price` → `prix`), sinon par son NOYAU de clés. Aucun seuil, aucun
 * vocabulaire : un concept de valeur est reconnu à ses clés propres, pas à la fréquence de ses
 * voisins. `null` = ce n'est pas une valeur du lexique.
 */
export function classerValeur(sig: string, cles: readonly string[], contexte: Contexte = { champ: '' }): Classement | null {
  const set = new Set(cles);
  for (const c of CONCEPTS_VALEUR) {
    if (c.exigeCandidatureStructurelle && !contexte.candidats?.includes(c.id)) continue;
    const parChamp = c.champs?.includes(contexte.champ) ?? false;
    const parNoyau = c.noyau ? c.noyau.filter((k) => set.has(k)).length >= (c.noyauMin ?? c.noyau.length) : false;
    if (parChamp || parNoyau) return statutDe(c, projeteValeur(c.id, cles) || sig);
  }
  return null;
}

/**
 * SIGNATURE PROJETÉE d'un objet de référence : on garde les clés de la GRAPHIE du lexique et les
 * clés qui RÉSOLVENT, la charge utile est repliée en `+…`. Sans cette projection, une même graphie
 * produirait autant de lignes de stock que le porteur a de variantes de charge utile.
 */
const signatureProjetee = (cles: readonly string[], resolvantes: ReadonlySet<string>): string => {
  const projete = cles.filter((k) => resolvantes.has(k) || GRAPHIE_REFERENCE.has(k));
  return signature(projete) + (cles.length > projete.length ? '+…' : '');
};

/** Vocabulaire propre d'un concept de VALEUR : les clés que ses signatures et son noyau nomment. */
const VOCABULAIRE_VALEUR = new Map(
  CONCEPTS.map((c) => [c.id, new Set([...c.signatures.flatMap((s) => s.sig.split(',')), ...(c.noyau ?? [])])]),
);

/**
 * Une valeur mesurée AILLEURS que sous sa forme propre (une plage aplatie dans une rangée de table)
 * est enregistrée sous sa PROJECTION sur le vocabulaire du concept : sans quoi une même divergence
 * produirait autant de lignes de stock que la table a de variantes de charge utile.
 */
const projeteValeur = (concept: string, cles: readonly string[]): string => {
  const vocab = VOCABULAIRE_VALEUR.get(concept)!;
  const projete = cles.filter((k) => vocab.has(k));
  return signature(projete) + (cles.length > projete.length ? '+…' : '');
};

export type CleNiveau1 = { cle: string; n: number; parClasse: Array<{ classe: string; n: number }> };
export type GroupeEnveloppe = {
  document: string;
  chemin: string;
  /** `racine` = les entrées du document ; `embarqué` = un document plus bas dans l'arbre. */
  portee: 'racine' | 'embarqué';
  /** Famille du document porteur (`entité`, `table`, `config`, `record`). */
  famille: string;
  /** Record : l'identité est portée par la CLÉ de l'entrée, pas par une clé de l'objet. */
  identiteParCle?: boolean;
  nbEntrees: number;
  cles: CleNiveau1[];
};
export type DivergenceEnveloppe = {
  role: string;
  cle: string;
  motif: 'clé divergente' | 'type divergent' | 'clé absente';
  detail: string;
  document: string;
  chemin: string;
  entrees: number;
};
export type FormeObservee = {
  concept: string;
  strate: Strate;
  famille: string;
  dataset: string;
  champ: string;
  signature: string;
  statut: 'cible' | 'historique' | 'declaree' | 'divergente';
  note: string;
  occurrences: number;
  /** Occurrences dont un `{text}` narratif résout vers le `label` d'une entité (références seules). */
  resolvables: number;
  /** Datasets vers lesquels les valeurs de cette forme résolvent (références seulement). */
  cibles: string[];
};
export type SignatureOrpheline = {
  dataset: string;
  champ: string;
  signature: string;
  motif: 'clé de référence non résolue' | 'clé réservée' | 'identité non résolue';
  occurrences: number;
};
export type OpObservee = { op: string; signature: string; dataset: string; occurrences: number };
export type DocumentObserve = Document & {
  racineJson: string;
  familleDeclaree: string;
  famille: string;
  regime: 'elements' | 'valeurs' | 'racine';
  nbEntrees: number;
  clesNiveau1: CleNiveau1[];
};
export type Homonyme = {
  cle: string;
  classes: string[];
  total: number;
  parClasse: Array<{ classe: string; datasets: string[] }>;
};
export type Parametre = { valeur: string; occurrences: number; racines: string[]; datasets: string[]; nature: string };
export type Collision = { id: string; datasets: string[] };

const ajouteCle = (cles: Map<string, CleNiveau1>, k: string, v: unknown) => {
  if (!cles.has(k)) cles.set(k, { cle: k, n: 0, parClasse: [] });
  const e = cles.get(k)!;
  e.n += 1;
  const classe = classeDeType(v);
  const vue = e.parClasse.find((c) => c.classe === classe);
  if (vue) vue.n += 1;
  else e.parClasse.push({ classe, n: 1 });
};
const trieCles = (cles: Map<string, CleNiveau1>): CleNiveau1[] =>
  [...cles.values()]
    .sort((a, b) => a.cle.localeCompare(b.cle))
    .map((c) => ({ ...c, parClasse: [...c.parClasse].sort((a, b) => a.classe.localeCompare(b.classe)) }));

type Obj = Record<string, unknown>;
const estObjet = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Valeur d'identité d'un objet (première clé d'identité portant une chaîne non vide). */
const identiteDe = (o: Obj): { cle: string; valeur: string } | null => {
  for (const k of CLES_IDENTITE) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return { cle: k, valeur: v };
  }
  return null;
};

/** Parcours de tout objet du document, avec le CHAMP porteur (clé du parent) et son chemin. */
function parcourir(racine: unknown, visite: (o: Obj, champ: string, chemin: string, dansTableau: boolean) => void) {
  const marche = (n: unknown, champ: string, chemin: string, dansTableau: boolean): void => {
    if (Array.isArray(n)) return void n.forEach((x) => marche(x, champ, chemin, true));
    if (!estObjet(n)) return;
    visite(n, champ, chemin, dansTableau);
    for (const [k, v] of Object.entries(n)) marche(v, k, chemin ? `${chemin}.${k}` : k, false);
  };
  marche(racine, '', '', false);
}

/**
 * Mesure OBSERVÉE sur les deux racines.
 * @param root racine absolue du dépôt
 * @param famillesDeclarees nom de document → famille déclarée par son schéma zod
 *   (`introspecterDefs`), qui donne le RÉGIME D'ENTRÉES. Absente = régime déduit de la racine JSON
 *   seule (documents hors registre).
 */
export function scannerDonnees(root: string, famillesDeclarees: ReadonlyMap<string, string> = new Map()) {
  const docs = listerDocuments(root);
  const brutParDocument = new Map<string, unknown>(
    docs.map((d) => [d.chemin, JSON.parse(readFileSync(join(root, d.chemin), 'utf8')) as unknown]),
  );

  // --- passe 1 : régime, entrées de racine, INDEX DES IDS -------------------
  type Prepare = Document & {
    brut: unknown;
    racineJson: string;
    familleDeclaree: string;
    regime: 'elements' | 'valeurs' | 'racine';
    entrees: Obj[];
    racineEntrees: Set<Obj>;
    famille: string;
  };
  const index = new Map<string, Set<string>>();
  const ajouteIndex = (id: string, dataset: string) => {
    if (!index.has(id)) index.set(id, new Set());
    index.get(id)!.add(dataset);
  };
  const prepares: Prepare[] = docs.map((doc) => {
    const brut = brutParDocument.get(doc.chemin);
    const racineJson = Array.isArray(brut) ? 'array' : estObjet(brut) ? 'object' : classeDeType(brut);
    const familleDeclaree = famillesDeclarees.get(doc.nom) ?? '';
    const regime = regimeEntrees(racineJson, familleDeclaree || undefined);
    const brutes: unknown[] =
      regime === 'elements'
        ? Array.isArray(brut)
          ? brut
          : []
        : regime === 'valeurs'
          ? Object.values((brut ?? {}) as object)
          : estObjet(brut)
            ? [brut]
            : [];
    const entrees = brutes.filter(estObjet);
    if (regime === 'valeurs') for (const k of Object.keys((brut ?? {}) as object)) ajouteIndex(k, doc.nom);
    else for (const e of entrees) { const ident = identiteDe(e); if (ident) ajouteIndex(ident.valeur, doc.nom); }
    const portePlage = entrees.filter((e) => {
      const r = e.range;
      return (estObjet(r) && typeof r.min === 'number' && typeof r.max === 'number') || (typeof e.min === 'number' && typeof e.max === 'number');
    }).length;
    const famille =
      regime === 'valeurs' ? 'record' : regime === 'racine' ? 'config' : portePlage * 2 >= entrees.length && entrees.length ? 'table' : 'entité';
    return { ...doc, brut, racineJson, familleDeclaree, regime, entrees, racineEntrees: new Set(entrees), famille };
  });

  /** Libellés d'entité de TOUS les datasets (résolution des `{text}`, normalisés). */
  const libelles = new Set<string>();
  for (const p of prepares)
    parcourir(p.brut, (o) => {
      if (typeof o.label === 'string' && o.label.trim()) libelles.add(normaliserLibelle(o.label));
    });

  const resoutIndex = (k: string, v: unknown): boolean =>
    typeof v === 'string' && (index.has(v) || (k === 'text' && libelles.has(normaliserLibelle(v))));

  // --- passe 2 : CHAMPS de référence MESURÉS --------------------------------
  // `champsDeReference` = les clés de parent sous lesquelles pend au moins un objet qui résout.
  // `sitesDeCle` mesure, pour chaque SITE (dataset, champ, clé), la part des valeurs qui résolvent :
  // c'est ce qui distingue une RÉFÉRENCE CASSÉE d'un DOCUMENT embarqué. Sous `creatures.json|skills`,
  // la clé `id` résout partout — un `{id:"zzz", value:10}` y est donc une référence orpheline, jamais
  // un document. Sous `arene-projet.json|entities`, c'est `ref` qui résout et jamais `id` — un pion
  // de scène EST un document. (Angle mort : un site dont la part de résolution frôle la moitié.)
  /** `dataset|champ|clé` → combien de valeurs chaîne de cette clé résolvent, sur combien. */
  const sitesDeCle = new Map<string, { resolvent: number; total: number }>();
  for (const p of prepares)
    parcourir(p.brut, (o, champ) => {
      if (p.racineEntrees.has(o) || !champ) return;
      for (const [k, v] of Object.entries(o)) {
        if (typeof v !== 'string') continue;
        const k2 = `${p.nom}|${champ}|${k}`;
        if (!sitesDeCle.has(k2)) sitesDeCle.set(k2, { resolvent: 0, total: 0 });
        const s = sitesDeCle.get(k2)!;
        s.total += 1;
        if (resoutIndex(k, v)) s.resolvent += 1;
      }
    });
  /** Un SITE (dataset, champ, clé) porte-t-il des références ? Mesuré : la majorité y résout. */
  const siteDeReference = (dataset: string, champ: string, cle: string) => {
    const s = sitesDeCle.get(`${dataset}|${champ}|${cle}`);
    return !!s && s.resolvent > 0 && s.resolvent * 2 >= s.total;
  };

  // --- passe 3 : DOCUMENTS EMBARQUÉS ---------------------------------------
  const documentsEmbarques = new Set<Obj>();
  for (const p of prepares)
    parcourir(p.brut, (o, champ) => {
      if (p.racineEntrees.has(o)) return;
      if (typeof o.op === 'string') return;
      const ident = identiteDe(o);
      if (!ident || siteDeReference(p.nom, champ, ident.cle)) return;
      documentsEmbarques.add(o);
      ajouteIndex(ident.valeur, p.nom);
    });

  // --- passe 4 : MESURE -----------------------------------------------------
  const kindsCondition = kindsDeCondition(root);
  /** clé `concept | dataset | champ | signature` → ligne de forme observée. */
  const formes = new Map<string, FormeObservee & { ciblesSet: Set<string> }>();
  const orphelines = new Map<string, SignatureOrpheline>();
  const reservees = new Map(CLES_RESERVEES.map((k) => [k as string, new Map<string, Map<string, number>>()]));
  const clesEnveloppe = new Map<string, number>();
  const groupes = new Map<string, { groupe: GroupeEnveloppe; cles: Map<string, CleNiveau1> }>();
  const ops = new Map<string, number>();
  /** Documents portant au moins une clé `source` à une profondeur quelconque (T3, lot L1d #1469). */
  const docsAvecSource = new Set<string>();
  const conditionsAvecOp = new Map<string, number>();
  const conditionsSansOp = new Map<string, number>();
  const opsComparateurs = new Map<string, number>();
  const parametres = new Map<string, { occurrences: number; racines: Set<string>; datasets: Set<string> }>();
  const regimesPrix = new Map<string, number>();
  const clesParDocument = new Map<string, string[]>();
  /** signature d'objet à `text` → { occurrences, resolvables } (T6 : 622 purs + 33 {count,text}). */
  const textes = new Map<string, { occurrences: number; resolvables: number }>();
  const documents: DocumentObserve[] = [];
  let totalOps = 0;
  let objetsVus = 0;
  let objetsClasses = 0;
  /** Objets qu'AUCUNE strate ne porte : ni document, ni forme mesurée, ni orpheline recensée. */
  let objetsInvisibles = 0;
  const invisibles = new Map<string, number>();

  const ligneForme = (
    concept: Concept,
    p: Prepare,
    champ: string,
    cl: { statut: FormeObservee['statut']; note: string; signature: string },
  ) => {
    const k = [concept.id, p.nom, champ || '(racine)', cl.signature].join(' | ');
    if (!formes.has(k))
      formes.set(k, {
        concept: concept.id,
        strate: concept.strate,
        famille: p.famille,
        dataset: p.nom,
        champ: champ || '(racine)',
        signature: cl.signature,
        statut: cl.statut,
        note: cl.note,
        occurrences: 0,
        resolvables: 0,
        cibles: [],
        ciblesSet: new Set<string>(),
      });
    return formes.get(k)!;
  };

  for (const p of prepares) {
    const clesNiveau1 = new Map<string, CleNiveau1>();
    for (const e of p.entrees) {
      for (const [k, v] of Object.entries(e)) ajouteCle(clesNiveau1, k, v);
      inc(clesEnveloppe, signature(Object.keys(e)));
    }

    const noteGroupe = (chemin: string, o: Obj) => {
      const k = `${p.nom} | ${chemin}`;
      if (!groupes.has(k))
        groupes.set(k, {
          groupe: { document: p.nom, chemin, portee: 'embarqué', famille: p.famille, nbEntrees: 0, cles: [] },
          cles: new Map(),
        });
      const g = groupes.get(k)!;
      g.groupe.nbEntrees += 1;
      for (const [ck, cv] of Object.entries(o)) ajouteCle(g.cles, ck, cv);
    };

    parcourir(p.brut, (o, champ, chemin, dansTableau) => {
      objetsVus += 1;
      const cles = Object.keys(o);
      const sig = signature(cles);
      const estRacine = p.racineEntrees.has(o);
      const estEmbarque = documentsEmbarques.has(o);
      const estDocument = estRacine || estEmbarque;

      // ---- Ops et Conditions
      const kind = typeof o.kind === 'string' ? o.kind : '';
      const estCondition = !!kind && kindsCondition.has(kind);
      if (typeof o.op === 'string') {
        if (estCondition) inc(conditionsAvecOp, kind);
        else {
          totalOps += 1;
          inc(ops, `${o.op} | ${sig} | ${p.nom}`);
          if (!/^[A-Za-z]/.test(o.op)) inc(opsComparateurs, `${o.op} | ${kind || '—'} | ${p.nom}`);
        }
      } else if (estCondition) inc(conditionsSansOp, kind);

      // ---- Résolution vers l'index
      const identite = estDocument ? identiteDe(o)?.cle : undefined;
      const resolvantes = new Set<string>();
      const cibles = new Set<string>();
      for (const [k, v] of Object.entries(o)) {
        if (k === identite || !resoutIndex(k, v)) continue;
        resolvantes.add(k);
        if (typeof v === 'string') for (const d of index.get(v) ?? []) cibles.add(d);
      }

      // ---- `{text}` : mesuré même quand il ne résout pas (T6)
      if (typeof o.text === 'string') {
        if (!textes.has(sig)) textes.set(sig, { occurrences: 0, resolvables: 0 });
        const t = textes.get(sig)!;
        t.occurrences += 1;
        if (libelles.has(normaliserLibelle(o.text))) t.resolvables += 1;
      }

      // ---- VALEUR d'abord (noyau propre), RÉFÉRENCE ensuite (index des ids)
      const candidats = dansTableau && typeof o.min === 'number' && typeof o.max === 'number' ? ['plage'] : undefined;
      const valeur = classerValeur(sig, cles, { champ, candidats });
      let classe = false;
      if (valeur) {
        const c = CONCEPTS.find((x) => x.id === valeur.concept)!;
        ligneForme(c, p, champ, valeur).occurrences += 1;
        classe = true;
      } else if (resolvantes.size && !estDocument) {
        const ligne = ligneForme(CONCEPT_REFERENCE, p, champ, {
          ...statutDe(CONCEPT_REFERENCE, signatureProjetee(cles, resolvantes)),
        });
        ligne.occurrences += 1;
        for (const d of cibles) ligne.ciblesSet.add(d);
        if (resolvantes.has('text')) ligne.resolvables += 1;
        classe = true;
      } else if (resolvantes.size && estDocument) {
        // Référence portée par un CHAMP SCALAIRE d'un document (`species: "humain"`).
        for (const k of resolvantes) {
          const ligne = ligneForme(CONCEPT_REFERENCE, p, k, statutDe(CONCEPT_REFERENCE, 'id-nu'));
          ligne.occurrences += 1;
          for (const d of index.get(String(o[k])) ?? []) ligne.ciblesSet.add(d);
        }
        classe = true;
      }

      // ---- Listes d'ids nus (concept `refs`)
      const conceptRefs = CONCEPTS.find((c) => c.listeIdsNus)!;
      for (const [k, v] of Object.entries(o)) {
        if (!Array.isArray(v) || !v.length || !v.every((x) => typeof x === 'string')) continue;
        if (!(v as string[]).some((x) => index.has(x))) continue;
        const ligne = ligneForme(conceptRefs, p, k, statutDe(conceptRefs, 'ids-nus'));
        ligne.occurrences += 1;
        for (const x of v as string[]) for (const d of index.get(x) ?? []) ligne.ciblesSet.add(d);
        classe = true;
      }

      if (classe) objetsClasses += 1;

      // ---- ORPHELINES : ce qui annonce une référence et ne résout pas
      let orpheline = false;
      if (!estDocument && !classe) {
        const cleRef = cles.find((k) => RX_CLE_REFERENCE.test(k));
        const cleReservee = cles.find((k) => (CLES_RESERVEES as readonly string[]).includes(k));
        const cleIdentite = cles.find((k) => (CLES_IDENTITE as readonly string[]).includes(k));
        const motif: SignatureOrpheline['motif'] | null = cleRef
          ? 'clé de référence non résolue'
          : cleIdentite
            ? 'identité non résolue'
            : cleReservee
              ? 'clé réservée'
              : null;
        if (motif) {
          const k = [p.nom, champ || '(racine)', sig].join(' | ');
          if (!orphelines.has(k))
            orphelines.set(k, { dataset: p.nom, champ: champ || '(racine)', signature: sig, motif, occurrences: 0 });
          orphelines.get(k)!.occurrences += 1;
          orpheline = true;
        }
      }
      if (!estDocument && !classe && !orpheline) {
        objetsInvisibles += 1;
        inc(invisibles, `${p.nom} | ${champ || '(racine)'} | ${sig}`);
      }

      if (estEmbarque) noteGroupe(chemin || '(racine)', o);

      if ('arg' in o && 'id' in o) {
        const v = String(o.arg);
        if (!parametres.has(v)) parametres.set(v, { occurrences: 0, racines: new Set(), datasets: new Set() });
        const par = parametres.get(v)!;
        par.occurrences += 1;
        par.racines.add(p.racine);
        par.datasets.add(p.nom);
      }
      if ('price' in o) inc(regimesPrix, regimePrix(o.price));
      if ('source' in o) docsAvecSource.add(p.nom);
      for (const k of CLES_RESERVEES) {
        if (!(k in o)) continue;
        const classes = reservees.get(k)!;
        const cls = classeDeType(o[k]);
        if (!classes.has(cls)) classes.set(cls, new Map());
        inc(classes.get(cls)!, p.nom);
      }
    });

    const clesTriees = trieCles(clesNiveau1);
    for (const k of clesTriees) {
      if (!clesParDocument.has(k.cle)) clesParDocument.set(k.cle, []);
      clesParDocument.get(k.cle)!.push(`${p.nom}(${k.n})`);
    }
    documents.push({
      racine: p.racine,
      chemin: p.chemin,
      nom: p.nom,
      racineJson: p.racineJson,
      familleDeclaree: p.familleDeclaree,
      famille: p.famille,
      regime: p.regime,
      nbEntrees: p.entrees.length,
      clesNiveau1: clesTriees,
    });
  }

  const groupesEnveloppe: GroupeEnveloppe[] = [
    ...prepares.map((p): GroupeEnveloppe => ({
      document: p.nom,
      chemin: '(entrées)',
      portee: 'racine',
      famille: p.famille,
      identiteParCle: p.regime === 'valeurs',
      nbEntrees: p.entrees.length,
      cles: documents.find((d) => d.chemin === p.chemin)!.clesNiveau1,
    })),
    ...[...groupes.values()].map(({ groupe, cles }) => ({ ...groupe, cles: trieCles(cles) })),
  ].sort((a, b) => a.document.localeCompare(b.document) || a.chemin.localeCompare(b.chemin));

  const homonymes: Homonyme[] = CLES_RESERVEES.map((cle) => {
    const classes = reservees.get(cle)!;
    return {
      cle,
      classes: [...classes.keys()].sort(),
      total: [...classes.values()].reduce((a, m) => a + [...m.values()].reduce((x, y) => x + y, 0), 0),
      parClasse: [...classes]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([c, m]) => ({ classe: c, datasets: [...m].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d}:${n}`) })),
    };
  }).filter((h) => h.classes.length >= 2);

  const enveloppe = mesurerEnveloppe(groupesEnveloppe);
  const enveloppeParMotif = new Map<string, number>();
  for (const e of enveloppe) inc(enveloppeParMotif, `${e.role} | ${e.motif}`);

  const collisions: Collision[] = [...index]
    .filter(([, ds]) => ds.size >= 2)
    .map(([id, ds]) => ({ id, datasets: [...ds].sort() }))
    .sort((a, b) => b.datasets.length - a.datasets.length || a.id.localeCompare(b.id));

  /** Angle mort MESURÉ : un `label` qui est aussi un id indexé rend la résolution `{text}` ambiguë. */
  const labelsQuiSontDesIds = [...index.keys()].filter((id) => libelles.has(normaliserLibelle(id))).sort();

  return {
    documents,
    index: { ids: index.size, libelles: libelles.size, collisions, labelsQuiSontDesIds },
    groupesEnveloppe,
    enveloppe,
    enveloppeParMotif: [...enveloppeParMotif].sort().map(([k, n]) => ({ role: k.split(' | ')[0], motif: k.split(' | ')[1], documents: n })),
    clesParDocument: [...clesParDocument].sort((a, b) => a[0].localeCompare(b[0])),
    formes: [...formes.values()]
      .map(({ ciblesSet, ...f }) => ({ ...f, cibles: [...ciblesSet].sort() }))
      .sort(
        (a, b) =>
          a.concept.localeCompare(b.concept) ||
          a.dataset.localeCompare(b.dataset) ||
          a.champ.localeCompare(b.champ) ||
          a.signature.localeCompare(b.signature),
      ),
    /** Champs porteurs de référence MESURÉS : les clés de parent sous lesquelles une occurrence de
     *  référence a été mesurée — jamais une déclaration du lexique, jamais un seuil de vocabulaire. */
    champsDeReference: [...new Set([...formes.values()].filter((f) => f.strate === 'Référence').map((f) => f.champ))].sort(),
    orphelines: [...orphelines.values()].sort(
      (a, b) => b.occurrences - a.occurrences || a.dataset.localeCompare(b.dataset) || a.signature.localeCompare(b.signature),
    ),
    homonymes,
    clesEnveloppe: [...clesEnveloppe].sort((a, b) => b[1] - a[1]),
    ops: [...ops]
      .map(([k, occurrences]): OpObservee => {
        const [op, sig, dataset] = k.split(' | ');
        return { op, signature: sig, dataset, occurrences };
      })
      .sort(
        (a, b) =>
          a.op.localeCompare(b.op) || b.occurrences - a.occurrences || a.signature.localeCompare(b.signature) || a.dataset.localeCompare(b.dataset),
      ),
    documentsSansSource: documents.filter((d) => !docsAvecSource.has(d.nom)).map((d) => d.nom).sort(),
    totalOps,
    conditions: [...new Set([...conditionsAvecOp.keys(), ...conditionsSansOp.keys()])]
      .map((kind) => ({ kind, avecOp: conditionsAvecOp.get(kind) ?? 0, sansOp: conditionsSansOp.get(kind) ?? 0 }))
      .sort((a, b) => b.avecOp + b.sansOp - (a.avecOp + a.sansOp) || a.kind.localeCompare(b.kind)),
    totalConditionsAvecOp: [...conditionsAvecOp.values()].reduce((a, b) => a + b, 0),
    totalConditionsSansOp: [...conditionsSansOp.values()].reduce((a, b) => a + b, 0),
    opsComparateurs: [...opsComparateurs]
      .map(([k, occurrences]) => {
        const [op, kind, dataset] = k.split(' | ');
        return { op, kind, dataset, occurrences };
      })
      .sort((a, b) => b.occurrences - a.occurrences || a.op.localeCompare(b.op)),
    textes: [...textes]
      .map(([sig, t]) => ({ signature: sig, ...t }))
      .sort((a, b) => b.occurrences - a.occurrences || a.signature.localeCompare(b.signature)),
    parametres: [...parametres]
      .map(([valeur, p]): Parametre => ({
        valeur,
        occurrences: p.occurrences,
        racines: [...p.racines].sort(),
        datasets: [...p.datasets].sort(),
        nature: natureParametre(valeur),
      }))
      .sort((a, b) => b.occurrences - a.occurrences || a.valeur.localeCompare(b.valeur)),
    regimesPrix: [...regimesPrix].sort((a, b) => b[1] - a[1]),
    objets: {
      vus: objetsVus,
      classes: objetsClasses,
      invisibles: objetsInvisibles,
      documentsEmbarques: documentsEmbarques.size,
      entreesDeRacine: prepares.reduce((a, p) => a + p.entrees.length, 0),
    },
    invisibles: [...invisibles]
      .map(([k, occurrences]) => {
        const [dataset, champ, sig] = k.split(' | ');
        return { dataset, champ, signature: sig, occurrences };
      })
      .sort((a, b) => b.occurrences - a.occurrences || a.dataset.localeCompare(b.dataset)),
  };
}

/**
 * Divergences d'ENVELOPPE, une ligne par (rôle, clé, motif, document, chemin) — le dénominateur du
 * lot L1b (#1467). Trois motifs :
 *   `clé divergente` — le rôle est porté sous un autre nom que sa cible (`key`/`nom` pour l'identité) ;
 *   `type divergent` — la clé cible est là, sa classe de type ne l'est pas (`source` en chaîne) ;
 *   `clé absente`    — une ENTRÉE DE RACINE ne porte nulle part la clé cible d'un rôle requis
 *                      (`id` et `source` partout, `label` sur les familles `entité`/`table`).
 * Un document EMBARQUÉ ne compte que ses clés DIVERGENTES : il n'est jamais sommé de porter un `id`.
 */
export function mesurerEnveloppe(groupes: readonly GroupeEnveloppe[]): DivergenceEnveloppe[] {
  const out: DivergenceEnveloppe[] = [];
  for (const g of groupes) {
    const parCle = new Map(g.cles.map((k) => [k.cle, k]));
    for (const [role, def] of Object.entries(ROLES_ENVELOPPE)) {
      for (const cle of def.divergentes) {
        const vue = parCle.get(cle);
        if (vue)
          out.push({ role, cle, motif: 'clé divergente', detail: '', document: g.document, chemin: g.chemin, entrees: vue.n });
      }
      if (!def.cible) continue;
      const cible = parCle.get(def.cible);
      if (!cible) {
        const requise = def.requise || (def.requiseSurFamilles?.includes(g.famille) ?? false);
        const porteeParCle = role === 'identité' && g.identiteParCle;
        if (requise && !porteeParCle && g.portee === 'racine' && g.nbEntrees > 0)
          out.push({ role, cle: def.cible, motif: 'clé absente', detail: '', document: g.document, chemin: g.chemin, entrees: g.nbEntrees });
        continue;
      }
      if (!def.typeAttendu) continue;
      for (const { classe, n } of cible.parClasse)
        if (classe !== def.typeAttendu)
          out.push({ role, cle: def.cible, motif: 'type divergent', detail: classe, document: g.document, chemin: g.chemin, entrees: n });
    }
  }
  return out.sort(
    (a, b) =>
      a.role.localeCompare(b.role) ||
      a.cle.localeCompare(b.cle) ||
      a.motif.localeCompare(b.motif) ||
      a.detail.localeCompare(b.detail) ||
      a.document.localeCompare(b.document) ||
      a.chemin.localeCompare(b.chemin),
  );
}

// ---------------------------------------------------------------------------
// Redéclarations LOCALES : AST des `defs/*.ts`, littéraux d'objet passés à z.object/strictObject/
// looseObject dont la signature recoupe le lexique ou un schéma commun de `common.ts`.
// ---------------------------------------------------------------------------

/** Un `createSourceFile` par fichier et par run (T9) : `common.ts` était parsé deux fois. */
const CACHE_SOURCE = new Map<string, ts.SourceFile>();
const sourceDe = (fichier: string, texte: () => string) => {
  const vu = CACHE_SOURCE.get(fichier);
  if (vu) return vu;
  const sf = ts.createSourceFile(fichier, texte(), ts.ScriptTarget.Latest, true);
  CACHE_SOURCE.set(fichier, sf);
  return sf;
};
const sourceCommune = (root: string) => {
  const fichier = join(root, 'src/data/schemas/common.ts');
  return sourceDe(fichier, () => readFileSync(fichier, 'utf8'));
};

/** `kind` reconnus par `conditionSchema` (`src/data/schemas/common.ts`) — lus par AST, jamais listés
 *  à la main : une Condition en donnée porte un `op` (comparateur) qui n'est PAS une op de jeu. */
function kindsDeCondition(root: string): Set<string> {
  const sf = sourceCommune(root);
  const out = new Set<string>();
  const collecte = (n: ts.Node) => {
    if (
      ts.isPropertyAssignment(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === 'kind' &&
      ts.isCallExpression(n.initializer) &&
      ts.isPropertyAccessExpression(n.initializer.expression) &&
      n.initializer.expression.name.text === 'literal' &&
      n.initializer.arguments.length &&
      ts.isStringLiteral(n.initializer.arguments[0])
    )
      out.add((n.initializer.arguments[0] as ts.StringLiteral).text);
    ts.forEachChild(n, collecte);
  };
  const visite = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'conditionSchema' && n.initializer)
      collecte(n.initializer);
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return out;
}

/** Schémas COMMUNS candidats, par signature de clés (lus dans `common.ts` par AST). */
function schemasCommuns(root: string): Map<string, string> {
  const sf = sourceCommune(root);
  const parSignature = new Map<string, string>();
  const visite = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      for (const lit of litterauxZod(node.initializer, sf)) {
        const sig = signature(lit.cles);
        if (sig && !parSignature.has(sig)) parSignature.set(sig, node.name.text);
      }
    }
    ts.forEachChild(node, visite);
  };
  visite(sf);
  return parSignature;
}

/** Nom de la propriété qui PORTE ce littéral (le champ, quand il y en a un). */
const champDuLitteral = (lit: ts.Node): string => {
  for (let n: ts.Node | undefined = lit.parent; n; n = n.parent) {
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) return n.name.text;
    if (ts.isVariableDeclaration(n)) return '';
  }
  return '';
};

/** Tous les littéraux d'objet argument d'un `z.object|strictObject|looseObject` sous `node`. */
function litterauxZod(node: ts.Node, sf: ts.SourceFile) {
  const out: Array<{ ligne: number; champ: string; cles: string[] }> = [];
  const visite = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ['object', 'strictObject', 'looseObject'].includes(n.expression.name.text) &&
      n.arguments.length &&
      ts.isObjectLiteralExpression(n.arguments[0])
    ) {
      const lit = n.arguments[0] as ts.ObjectLiteralExpression;
      out.push({
        ligne: sf.getLineAndCharacterOfPosition(lit.getStart(sf)).line + 1,
        champ: champDuLitteral(n),
        cles: lit.properties.flatMap((p) =>
          p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? [p.name.text] : [],
        ),
      });
    }
    ts.forEachChild(n, visite);
  };
  visite(node);
  return out;
}

type LitteralDef = { def: string; ligne: number; champ: string; cles: string[] };

/** Cache par racine : les `defs/*.ts` ne sont parsés qu'UNE fois par run. */
const CACHE_LITTERAUX = new Map<string, LitteralDef[]>();

/** Tous les littéraux d'objet zod des `defs/*.ts`, avec leur `def:ligne`, leur champ et leurs clés. */
function litterauxDefs(root: string): LitteralDef[] {
  const cache = CACHE_LITTERAUX.get(root);
  if (cache) return cache;
  const dir = join(root, 'src/data/schemas/defs');
  const out: LitteralDef[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort()) {
    const chemin = join(dir, f);
    const sf = sourceDe(chemin, () => readFileSync(chemin, 'utf8'));
    for (const lit of litterauxZod(sf, sf)) out.push({ def: f, ...lit });
  }
  CACHE_LITTERAUX.set(root, out);
  return out;
}

/**
 * Empreinte d'un concept dans les defs par critère SUPERSET de clés — indépendante du classement
 * ordonné : un littéral qui porte à la fois `min`/`max` et `book` compte dans les deux.
 */
export function empreintesDefs(root: string) {
  const lits = litterauxDefs(root);
  return CONCEPTS.filter((c) => c.noyau?.length).map((c) => {
    const hits = lits.filter((l) => c.noyau!.filter((k) => l.cles.includes(k)).length >= (c.noyauMin ?? c.noyau!.length));
    return {
      concept: c.id,
      noyau: c.noyau!.join(','),
      litteraux: hits.length,
      defs: [...new Set(hits.map((h) => h.def))].sort(),
    };
  });
}

export type Redeclaration = {
  def: string;
  ligne: number;
  champ: string;
  signature: string;
  concept: string;
  statut: string;
  commun: string;
};

/**
 * Classement d'un LITTÉRAL de schéma : aucune donnée à résoudre ici, donc une valeur par son noyau,
 * une référence par sa GRAPHIE exacte au lexique — jamais par projection (un schéma déclare ses
 * clés, il n'a pas de charge utile à replier).
 */
const classerLitteral = (sig: string, cles: readonly string[], champ: string): Classement | null => {
  const valeur = classerValeur(sig, cles, { champ, candidats: ['plage'] });
  if (valeur) return valeur;
  const hit = CONCEPT_REFERENCE.signatures.find((s) => s.sig === sig);
  return hit ? statutDe(CONCEPT_REFERENCE, sig) : null;
};

/** Redéclarations locales dans `src/data/schemas/defs/*.ts` (un seul walk des defs). */
export function scannerRedeclarations(root: string): { redeclarations: Redeclaration[]; totalLitteraux: number } {
  const communs = schemasCommuns(root);
  const lits = litterauxDefs(root);
  const out: Redeclaration[] = [];
  for (const lit of lits) {
    const sig = signature(lit.cles);
    if (!sig) continue;
    const cl = classerLitteral(sig, lit.cles, lit.champ);
    const commun = communs.get(sig);
    if (!cl && !commun) continue;
    out.push({
      def: lit.def,
      ligne: lit.ligne,
      champ: lit.champ,
      signature: cl?.signature ?? sig,
      concept: cl?.concept ?? '',
      statut: cl?.statut ?? 'hors lexique',
      commun: commun ?? '',
    });
  }
  return { redeclarations: out, totalLitteraux: lits.length };
}
