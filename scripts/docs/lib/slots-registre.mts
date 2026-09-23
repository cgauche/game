// VOLET SLOTS du doc `docs/structures-donnees.md` (#1466 L1a, volet A) — le côté DÉCLARÉ des
// références, croisé au côté OBSERVÉ du scan. Lib PURE : deux consommateurs, le générateur
// `scripts/docs/build-structures.mts` et la garde `src/data/slots-contrat.test.ts`.
//
// MANDAT et ANGLES MORTS de ce volet : SOURCES UNIQUES `MANDAT_SLOTS` / `ANGLES_MORTS_SLOTS`
// (`scripts/docs/lib/structures-lexique.mts`) — ils ne se reformulent nulle part.
import { SCHEMA_DEFS } from '../../../src/data/schemas/_registry.generated';
import { SCHEMA_DEFS_SCENES } from '../../../src/data/schemas/_registry-scenes.generated';
import type { SchemaDef } from '../../../src/data/schemas/types';
import { slotsDe, type Slot } from '../../../src/data/schemas/grammaire/slots';
import { IDS_PAR_DATASET } from '../../../src/data/schemas/_ids.generated';
import { TYPES, type TypeEntite } from '../../../src/data/schemas/grammaire/ref';
import { nomDeDocument, type OccurrenceDeReference, type ReferencesParPorteur } from './structures-scan.mjs';
import { parUnitesDeCode } from '../../guards/lib/lister.mjs';

/**
 * Les defs des DEUX racines, keyées comme le scan key ses documents : par BASENAME. Les defs de
 * `src/scenes` déclarent un CHEMIN RELATIF (`arene/arene-projet.json`) là où `listerDocuments` rend
 * un basename — sans cette normalisation la jointure déclaré × observé serait VIDE sur les scènes.
 */
export function defsDeDocument(): SchemaDef[] {
  return [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES].map((d) => ({ ...d, file: nomDeDocument(d.file) }));
}

/** Tous les slots déclarés par les schémas des deux racines, à leur path exact. */
export function slotsDeclares(defs: readonly SchemaDef[] = defsDeDocument()): Slot[] {
  return defs.flatMap((d) => slotsDe(d.root, d.file, d.schema));
}

/** Le slot vise-t-il un type d'entité du registre `_ids.generated` (donc une FK résoluble) ? */
export const estTypeDuRegistre = (type: string | undefined): type is TypeEntite =>
  type !== undefined && Object.prototype.hasOwnProperty.call(TYPES, type);

/** Ids qui font autorité pour un type d'entité (registre généré). */
export const idsDuType = (type: TypeEntite): readonly string[] => IDS_PAR_DATASET[TYPES[type].dataset] ?? [];

/**
 * Une valeur de chaîne lue au PATH d'un slot : son chemin de lecture, et sa CASE dans le document
 * parsé — le `porteur` (objet ou liste, par identité) et la `cle` (clé ou indice) qui la posent.
 */
export type ValeurAuPath = { chemin: string; valeur: string; porteur: object; cle: string | number };

/** Valeurs de chaîne posées au PATH d'un slot dans un document JSON, à leur chemin de lecture. */
export function valeursAuPath(document: unknown, path: string): ValeurAuPath[] {
  const out: ValeurAuPath[] = [];
  const segments = [...path.matchAll(/\[\]|\{\}|\[\d+\]|\|\d+|\.?[A-Za-z_$][\w$]*/g)].map((m) => m[0]);
  const descendre = (noeud: unknown, i: number, chemin: string, porteur: object | null, cleDansPorteur: string | number): void => {
    if (noeud === undefined || noeud === null) return;
    if (i === segments.length) {
      if (typeof noeud === 'string' && porteur) out.push({ chemin, valeur: noeud, porteur, cle: cleDansPorteur });
      return;
    }
    const s = segments[i];
    if (s === '[]' || /^\[\d+\]$/.test(s)) {
      if (Array.isArray(noeud)) noeud.forEach((v, j) => descendre(v, i + 1, `${chemin}[${j}]`, noeud, j));
      return;
    }
    if (s === '{}') {
      if (typeof noeud === 'object') for (const [k, v] of Object.entries(noeud)) descendre(v, i + 1, `${chemin}.${k}`, noeud, k);
      return;
    }
    // `|N` : angle mort déclaré (`ANGLES_MORTS_SLOTS`).
    if (/^\|\d+$/.test(s)) return descendre(noeud, i + 1, chemin, porteur, cleDansPorteur);
    const cle = s.replace(/^\./, '');
    if (typeof noeud === 'object' && !Array.isArray(noeud)) descendre((noeud as Record<string, unknown>)[cle], i + 1, `${chemin}.${cle}`, noeud, cle);
  };
  descendre(document, 0, '', null, '');
  return out;
}

const cleDeCouple = (c: { dataset: string; champ: string }) => `${c.dataset} | ${c.champ}`;

/** Ce que la jointure lit du scan : les documents PARSÉS et les occurrences keyées par leur case. */
export type ScanDesReferences = {
  brutParNom: ReadonlyMap<string, unknown>;
  referencesParPorteur: ReferencesParPorteur;
  occurrencesDeReference: readonly OccurrenceDeReference[];
};

/** Les CASES `(porteur, clé)` inscrites par le scan où tombe une valeur lue au path d'un slot. */
function casesTouchees(scan: ScanDesReferences, slot: Slot): Map<object, Set<string | number>> {
  const touchees = new Map<object, Set<string | number>>();
  if (!scan.brutParNom.has(slot.dataset)) return touchees;
  for (const v of valeursAuPath(scan.brutParNom.get(slot.dataset), slot.path)) {
    if (!scan.referencesParPorteur.get(v.porteur)?.has(v.cle)) continue;
    if (!touchees.has(v.porteur)) touchees.set(v.porteur, new Set());
    touchees.get(v.porteur)!.add(v.cle);
  }
  return touchees;
}

/**
 * Les occurrences de référence OBSERVÉES qu'un slot TOUCHE : celles dont une case au moins reçoit une
 * valeur lue à son path. Toucher n'est pas atteindre : une occurrence n'est ATTEINTE que si TOUTES
 * ses cases le sont, par l'ensemble des slots (`couplesDeReference`).
 */
export function occurrencesTouchees(scan: ScanDesReferences, slot: Slot): Set<OccurrenceDeReference> {
  const touchees = new Set<OccurrenceDeReference>();
  for (const [porteur, cles] of casesTouchees(scan, slot))
    for (const k of cles) touchees.add(scan.referencesParPorteur.get(porteur)!.get(k)!);
  return touchees;
}

/** Les couples des occurrences qu'un slot touche (colonne « Couples touchés » du doc §6.1) — vide s'il n'en touche aucune. */
export function couplesTouches(scan: ScanDesReferences, slot: Slot): string[] {
  return [...new Set([...occurrencesTouchees(scan, slot)].map(cleDeCouple))].sort();
}

/** Un couple `(dataset, champ)` de la strate `Référence` : ses occurrences OBSERVÉES, et celles que le déclaré ATTEINT. */
export type CoupleDeReference = { dataset: string; champ: string; occurrences: number; atteintes: number };

/**
 * Tous les couples observés, avec leur compte d'occurrences et la part ATTEINTE : une occurrence l'est
 * quand elle a au moins une case et que chacune reçoit une valeur d'un slot, quel qu'il soit.
 */
export function couplesDeReference(scan: ScanDesReferences, slots: readonly Slot[]): CoupleDeReference[] {
  const touchees = new Map<object, Set<string | number>>();
  for (const s of slots)
    for (const [porteur, cles] of casesTouchees(scan, s)) {
      if (!touchees.has(porteur)) touchees.set(porteur, new Set());
      for (const k of cles) touchees.get(porteur)!.add(k);
    }
  const avecCase = new Set<OccurrenceDeReference>();
  const manquees = new Set<OccurrenceDeReference>();
  for (const [porteur, cases] of scan.referencesParPorteur)
    for (const [k, o] of cases) {
      avecCase.add(o);
      if (!touchees.get(porteur)?.has(k)) manquees.add(o);
    }
  const couples = new Map<string, CoupleDeReference>();
  for (const o of scan.occurrencesDeReference) {
    const cle = cleDeCouple(o);
    if (!couples.has(cle)) couples.set(cle, { dataset: o.dataset, champ: o.champ, occurrences: 0, atteintes: 0 });
    const c = couples.get(cle)!;
    c.occurrences += 1;
    if (avecCase.has(o) && !manquees.has(o)) c.atteintes += 1;
  }
  return [...couples.values()].sort((a, b) => parUnitesDeCode(a.dataset, b.dataset) || parUnitesDeCode(a.champ, b.champ));
}

/**
 * COUVERTURE : les couples porteurs de références OBSERVÉES (strate `Référence` du scan) dont une
 * occurrence au moins n'est pas ATTEINTE (une de ses cases ne reçoit aucune valeur déclarée). C'est la dette d'ADOPTION du registre — elle se
 * solde concept par concept en L2/L3 (#1473), jamais en retirant une ligne seule. Stock
 * `SLOTS_SANS_DECLARATION`, keyé par le compte OBSERVÉ total ; ce que la mesure ne voit pas est dit
 * à `ANGLES_MORTS_SLOTS`.
 */
export function champsSansSlot(scan: ScanDesReferences, slots: readonly Slot[]): CoupleDeReference[] {
  return couplesDeReference(scan, slots).filter((c) => c.atteintes < c.occurrences);
}

/** Un couple et le compte de ses occurrences INATTEIGNABLES. */
export type CoupleInatteignable = { dataset: string; champ: string; occurrences: number };

/**
 * INATTEIGNABLES : par couple, les occurrences dont AUCUNE case ne porte de chaîne — aucune valeur lue
 * à un path déclaré ne peut y tomber, quel que soit le schéma. Stock `SLOTS_INATTEIGNABLES`.
 */
export function occurrencesInatteignables(scan: ScanDesReferences): CoupleInatteignable[] {
  const atteignables = new Set<OccurrenceDeReference>();
  for (const [porteur, cases] of scan.referencesParPorteur)
    for (const [k, o] of cases) if (typeof (porteur as Record<string | number, unknown>)[k] === 'string') atteignables.add(o);
  const couples = new Map<string, CoupleInatteignable>();
  for (const o of scan.occurrencesDeReference) {
    if (atteignables.has(o)) continue;
    const cle = cleDeCouple(o);
    if (!couples.has(cle)) couples.set(cle, { dataset: o.dataset, champ: o.champ, occurrences: 0 });
    couples.get(cle)!.occurrences += 1;
  }
  return [...couples.values()].sort((a, b) => parUnitesDeCode(a.dataset, b.dataset) || parUnitesDeCode(a.champ, b.champ));
}

/** Les couples dont TOUTES les occurrences observées sont ATTEINTES — la JOINTURE. */
export function champsJoints(scan: ScanDesReferences, slots: readonly Slot[]): string[] {
  return couplesDeReference(scan, slots)
    .filter((c) => c.atteintes === c.occurrences)
    .map(cleDeCouple)
    .sort();
}
