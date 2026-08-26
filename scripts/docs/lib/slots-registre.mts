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
import { nomDeDocument, type FormeObservee } from './structures-scan.mjs';

/**
 * Les defs des DEUX racines, keyées comme le scan key ses documents : par BASENAME. Les defs de
 * `src/scenes` déclarent un CHEMIN RELATIF (`arene/arene-projet.json`) là où `listerDocuments` rend
 * un basename — sans cette normalisation la jointure déclaré × observé serait VIDE sur les scènes.
 */
export function defsDeDocument(): SchemaDef[] {
  return [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES].map((d) => ({ ...d, file: nomDeDocument(d.file) }));
}

/**
 * PROJECTION d'un path de slot sur le CHAMP que le scan mesure : le déclaré est un chemin
 * (`[].curated[]`, `narratif.presetsPnj[].base`), l'observé est plat (le champ porteur = la clé du
 * parent). La projection retient le DERNIER segment-clé du path, marqueurs de descente retirés.
 * Un path sans aucun segment-clé (`[]`, `|0`) porte sur l'entrée elle-même : `(racine)`.
 * (Ce que la projection ne voit pas est dit à `ANGLES_MORTS_SLOTS`.)
 */
export function champDuPath(path: string): string {
  const segments = path.split('.').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const cle = segments[i].replace(/\[\]|\{\}|\[\d+\]|\|\d+/g, '');
    if (cle) return cle;
  }
  return '(racine)';
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

/** Valeurs de chaîne posées au PATH d'un slot dans un document JSON, à leur chemin de lecture. */
export function valeursAuPath(document: unknown, path: string): { chemin: string; valeur: string }[] {
  const out: { chemin: string; valeur: string }[] = [];
  const segments = [...path.matchAll(/\[\]|\{\}|\[\d+\]|\|\d+|\.?[A-Za-z_$][\w$]*/g)].map((m) => m[0]);
  const descendre = (noeud: unknown, i: number, chemin: string): void => {
    if (noeud === undefined || noeud === null) return;
    if (i === segments.length) {
      if (typeof noeud === 'string') out.push({ chemin, valeur: noeud });
      return;
    }
    const s = segments[i];
    if (s === '[]' || /^\[\d+\]$/.test(s)) {
      if (Array.isArray(noeud)) noeud.forEach((v, j) => descendre(v, i + 1, `${chemin}[${j}]`));
      return;
    }
    if (s === '{}') {
      if (typeof noeud === 'object') for (const [k, v] of Object.entries(noeud)) descendre(v, i + 1, `${chemin}.${k}`);
      return;
    }
    // `|N` : angle mort déclaré (`ANGLES_MORTS_SLOTS`).
    if (/^\|\d+$/.test(s)) return descendre(noeud, i + 1, chemin);
    const cle = s.replace(/^\./, '');
    if (typeof noeud === 'object' && !Array.isArray(noeud)) descendre((noeud as Record<string, unknown>)[cle], i + 1, `${chemin}.${cle}`);
  };
  descendre(document, 0, '');
  return out;
}

/** Un (dataset, champ) qui porte des références OBSERVÉES sans qu'aucun slot ne le DÉCLARE. */
export type ChampSansSlot = { dataset: string; champ: string; occurrences: number };

/**
 * COUVERTURE : les (dataset, champ) porteurs de références OBSERVÉES (strate `Référence` du scan)
 * que le déclaré n'atteint par AUCUN slot. C'est la dette d'ADOPTION du registre — elle se solde
 * concept par concept en L2/L3 (#1473), jamais en retirant une ligne seule. Stock
 * `SLOTS_SANS_DECLARATION` ; ce que la mesure ne voit pas est dit à `ANGLES_MORTS_SLOTS`.
 */
export function champsSansSlot(formes: readonly FormeObservee[], slots: readonly Slot[]): ChampSansSlot[] {
  const declares = new Set(slots.map((s) => `${s.dataset} | ${champDuPath(s.path)}`));
  const observes = new Map<string, ChampSansSlot>();
  for (const f of formes) {
    if (f.strate !== 'Référence') continue;
    const cle = `${f.dataset} | ${f.champ}`;
    if (declares.has(cle)) continue;
    const vu = observes.get(cle) ?? { dataset: f.dataset, champ: f.champ, occurrences: 0 };
    vu.occurrences += f.occurrences;
    observes.set(cle, vu);
  }
  return [...observes.values()].sort((a, b) => a.dataset.localeCompare(b.dataset) || a.champ.localeCompare(b.champ));
}

/** Les (dataset, champ) porteurs de références observées ET déclarés par un slot — la JOINTURE. */
export function champsJoints(formes: readonly FormeObservee[], slots: readonly Slot[]): string[] {
  const declares = new Set(slots.map((s) => `${s.dataset} | ${champDuPath(s.path)}`));
  return [...new Set(formes.filter((f) => f.strate === 'Référence').map((f) => `${f.dataset} | ${f.champ}`))]
    .filter((k) => declares.has(k))
    .sort();
}
