/** Schéma du projet de campagne « Loup et Saumure » — chemin RELATIF à la racine `src/scenes`. */
export { projetSchema as schema } from './projet';
import { projetDoc } from './projet';

export const file = 'loup-et-saumure/loup-et-saumure-projet.json';
/** Famille, méta et exposition VIENNENT DU HANDLE (#1552) — un projet est UN document, déclaré
 *  une seule fois dans `./projet.ts` ; ce module n'en nomme que le fichier. */
export const famille = projetDoc.famille;
export const meta = projetDoc.meta;
export const exposition = projetDoc.exposition;
