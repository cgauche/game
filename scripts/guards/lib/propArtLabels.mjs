/**
 * Extraction du `label` d'une def d'ART de décor (`src/gameIso/catalog/decor/defs/<id>.ts`,
 * déclaration `export const prop: PropViz`). FOYER UNIQUE partagé par la migration
 * `2026-08-28-l1b-10a-props-labels.mjs` (qui DÉRIVE le label de donnée) et par la garde de parité
 * `src/data/props-label-parite.test.ts` (qui vérifie qu'il n'a pas divergé) : une seule extraction,
 * donc aucun moyen que la dérivation et sa vérification s'écartent.
 *
 * Le fichier d'art porte le MÊME nom que l'id de l'entrée `props.json` (mesuré 78/78).
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/** Répertoire des defs d'art de décor, relatif à la racine du dépôt. */
export const DECOR_DEFS_DIR = 'src/gameIso/catalog/decor/defs';

/** `label: "…"` / `label: '…'` — la seule graphie du contrat `PropViz` (`src/gameIso/catalog/types.ts`). */
const LABEL_RE = /\blabel:\s*(["'])((?:[^\\]|\\.)*?)\1/g;

/** Chemin absolu de la def d'art d'un id de décor. */
export function cheminDefArt(racine, id) {
  return path.join(racine, DECOR_DEFS_DIR, `${id}.ts`);
}

/**
 * Label d'art d'un id de décor. FAIL-FAST (throw) si le fichier manque, ou si la déclaration ne porte
 * pas EXACTEMENT un `label:` — un 0 comme un 2+ rendraient une dérivation arbitraire.
 */
export function labelDArt(racine, id) {
  const p = cheminDefArt(racine, id);
  if (!existsSync(p)) throw new Error(`${id} : aucune def d'art (${DECOR_DEFS_DIR}/${id}.ts absent)`);
  const trouves = [...readFileSync(p, 'utf8').matchAll(LABEL_RE)].map((m) => m[2]);
  if (trouves.length !== 1) {
    throw new Error(`${id} : ${trouves.length} déclaration(s) \`label:\` dans ${DECOR_DEFS_DIR}/${id}.ts (1 attendue)${trouves.length ? ` — ${trouves.map((t) => JSON.stringify(t)).join(', ')}` : ''}`);
  }
  return trouves[0];
}
