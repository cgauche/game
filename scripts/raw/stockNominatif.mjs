// LECTURE DISQUE des stocks nominatifs de `scripts/raw` (#1711), dont la forme est
// `{ quoi, entrees: [{ famille?, fichier, ref, occurrence, lot, date }] }` — celle de
// `reconciliation-stock.json`.
// Tout le RAISONNEMENT vit dans `guards/lib/stock.mjs`, une seule définition pour TOUT stock
// nominatif du dépôt (JSON de `scripts/raw` comme `.mjs` de garde) : la FORME d'entrée
// (`cleDeSite`, `sitesEnEntrees`), le calcul d'écart (`ecartsDeStock`) et le REMÈDE
// (`ecartDuVolet`). Ici, rien que le fichier — et le PLAFOND nulle part, il vit dans le test de
// chaque garde.
// Consommateurs : `check-code-refs.mjs` (dead-code-refs, empty-line-code-refs),
// `citation-graphy-guard.mjs` (graphy), `reanchor.mjs` (reanchor-low), `check-refs.mjs` (dead-refs).
import { readFileSync } from 'node:fs'

/** Contenu JSON d'un fichier de stock, ou `{}` s'il est ABSENT (mode ZÉRO-TOLÉRANCE : rien de toléré,
 *  l'écart fait le reste). Lecteur partagé : `reconcile.mjs` en tire ses `trous`. */
export function lireStockJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

/** Les ENTRÉES d'un fichier de stock (fichier absent, ou stock vide : aucune entrée). */
export function readStock(path) {
  return lireStockJson(path).entrees ?? []
}

/** Le TEXTE d'un fichier de stock — seule ÉCRITURE du dépôt pour la forme `{ quoi, entrees }`, en
 *  regard de `lireStockJson` : tout régénérateur rend le même octet. */
export const texteDeStock = (quoi, entrees) => `${JSON.stringify({ quoi, entrees }, null, 2)}\n`

