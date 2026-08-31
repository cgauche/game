/** Schéma du projet de campagne « Barge du sel » — chemin RELATIF à la racine `src/scenes`. */
export { projetSchema as schema } from './projet';
import { projetDoc } from './projet';

export const file = 'barge-du-sel/barge-du-sel-projet.json';
/** Famille, méta et exposition VIENNENT DU HANDLE (#1552) — un projet est UN document, déclaré
 *  une seule fois dans `./projet.ts` ; ce module n'en nomme que le fichier. */
export const famille = projetDoc.famille;
export const meta = projetDoc.meta;
export const exposition = projetDoc.exposition;
