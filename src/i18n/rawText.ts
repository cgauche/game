/**
 * FOSSILE DE TRANSITION (#1318 V8a₀) — INSCRIT AU REGISTRE DES FOSSILES du ticket-mère #1318 à sa
 * création, avec sa mort planifiée : les vagues V8a₁ (migration de masse des sites vers `t()` et les
 * gabarits) puis V8b/V8c éteignent ses appels un fichier à la fois, et le module est SUPPRIMÉ au
 * commit qui ramène le compteur à 0.
 *
 * Ce que c'est : le SEUL passage par lequel un texte déjà écrit en dur au call-site entre dans
 * `PlayerText` sans être passé par un minteur. Ce n'est pas un minteur — c'est le GEL du stock du
 * jour, rendu VISIBLE et DÉCROISSANT. Le cliquet nominatif `state/player-text-ratchet.test.ts` fige
 * le compte PAR FICHIER : toute apparition au-delà du gel est rouge, la cible est 0.
 *
 * Pourquoi il existe : murer le champ pilote et migrer ses 54 sites dans le même geste mêlerait le
 * verrou (mesurable) et la traduction (arbitrage de forme, texte par texte). Le verrou passe seul ;
 * le stock reste lisible au compteur.
 */
import type { PlayerText } from './playerText';

/** Gèle un texte déjà écrit au call-site (cf. JSDoc — fossile, mort planifiée V8a₁/V8b/V8c). */
// eslint-disable-next-line no-restricted-syntax -- FOSSILE #1318 V8a₀ : l'unique cast licite vers `PlayerText`, gelé et compté (`player-text-ratchet.test.ts`).
export const rawText = (s: string): PlayerText => s as PlayerText;
