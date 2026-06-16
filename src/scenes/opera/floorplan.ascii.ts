/**
 * SOURCE ASCII de la carte de l'opéra (généré une fois depuis l'ancienne géométrie, puis ÉDITABLE ici).
 * 1 char = 1 case ; format box-drawing de `parseWalledAscii` (lignes/colonnes paires = ARÊTES).
 * Légende cases : ' '=vide (hors bâtiment) · ','=salle (dalle) · 'P'=parterre (parquet) · 'M'=foyer (marbre) ·
 *   'S'=scène (planches, +0.4) · 's'=fosse (planches, −0.4). Arêtes : '-'=mur (N) · '|'=mur (E) · ':'=PORTE.
 * L'élévation (S/s), les diagonales visuelles et les 2 escaliers sont rajoutés EN CODE par floorplan.ts.
 * Largeur de grille = 89 (= 2·44+1) ; les espaces de fin sont retirés → floorplan.ts re-complète.
 * Régénérable : `npx tsx scripts/qc/gen-opera-ascii.mts`.
 */
export const REZ_ASCII = String.raw`


   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  |, , , , , ,|, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , ,:

  |, , , , , ,|, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , ,|
   - - : - -               - - - - - - - - - - - - - - - - - -
  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S:, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,:, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,:, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|
                                                                           - : - - - -
  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,:, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|
   - - : - - - - - - - - - - - : - - - - - - - - - - - - : - - - - - - - - - - - : - -
  |, , , , , , , , , , , , , , , ,|s s s s s s s s s s s|, , , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , , ,|s s s s s s s s s s s|, , , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , , ,|s s s s s s s s s s s|, , , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , , ,|s s s s s s s s s s s|, , , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , , ,|s s s s s s s s s s s|, , , , , , , , , , , , , , ,|
                                   - - - - - : - - - - -
  |, , , , , , , , , , , , , , , ,|P P P P P P P P P P P|, , , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , , ,|P P P P P P P P P P P|, , , , , , , , , , , , , , ,|
                                 -                       -
  |, , , , , , , , , , , , , , ,|P P P P P P P P P P P P P|, , , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , , ,|P P P P P P P P P P P P P|, , , , , , , , , , , , , ,|
   - - : - - - - - - - - - - - -                           - - - - - - - - - - - : - -
  |, , , , , , , , , , , , , , ,|P P P P P P P P P P P P P|, , , , , , , , , , , , , ,|
                               -                           -
  |, , , , , , , , , , , , , ,|P P P P P P P P P P P P P P P|, , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , ,|P P P P P P P P P P P P P P P|, , , , , , , , , , , , ,|

  |, , , , , , , , , , , , , ,|P P P P P P P P P P P P P P P|, , , , , , , , , , , , ,|
                             -                               -
  |, , , , , , , , , , , , ,|P P P P P P P P P P P P P P P P P|, , , , , , , , , , , ,|

  |, , , , , , , , , , , , ,|P P P P P P P P P P P P P P P P P|, , , , , , , , , , , ,|

  |, , , , , , , , , , , , ,|P P P P P P P P P P P P P P P P P|, , , , , , , , , , , ,|
                           -                                   - - - - - - - - - : - -
  |, , , , , , , , , , , ,:P P P P P P P P P P P P P P P P P P P:, , , , , , , , , , ,|

  |, , , , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P|, , , , , , , , , , ,|
                         -                                       -
  |, , , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , , ,|
   - - : - - - - - - - -
  |, , , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , , ,|

  |, , , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , , ,|
                       -                                           -
  |, , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , ,|

  |, , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , ,|

  |, , , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , , ,|
                     -                                               -
  |, , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , ,|

  |, , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , ,|

  |, , , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , , ,|
                   -                                                   -
  |, , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , ,|

  |, , , , , , , ,|P P P P P P P P P P P P P P P P P P P P P P P P P P P|, , , , , , ,|
   - - : - - - - - : - - - - - - - - - - - - - - - - - - - - - - - - - : - - - - : - -
  |, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|

  |M M M M M M M M M M M M|M M M M M M M M M M M M M M M M M M|M M M M M M M M M M M M|
             - : -                                                   - : -
  |M M M M M|M M M|M M M M|M M M M M M M M M M M M M M M M M M|M M M|M M M|M M M M M M|

  |M M M M M|M M M|M M M M:M M M M M M M M M M M M M M M M M M:M M M|M M M|M M M M M M|

  |M M M M M|M M M|M M M M|M M M M M M M M M M M M M M M M M M|M M M|M M M|M M M M M M|
             - - -                                                   - - -
  |M M M M M M M M M M M M|M M M M M M M M M M M M M M M M M M|M M M M M M M M M M M M|

  |M M M M M M M M M M M M|M M M M M M M M M M M M M M M M M M|M M M M M M M M M M M M|
                           - : - -                       - : - -
  |M M M M M M M M M M M M|M M M M|M M M M M M M M M M M|M M M M|M M M M M M M M M M M|

  |M M M M M M M M M M M M|M M M M|M M M M M M M M M M M|M M M M|M M M M M M M M M M M|

  |M M M M M M M M M M M M|M M M M|M M M M M M M M M M M|M M M M|M M M M M M M M M M M|
                           - - - -                       - - - -
  |M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M|

  |M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M|
     - : -                                                                     - : -
  |M|M M M|M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M|M M M|M|

  |M|M M M|M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M|M M M|M|

  | |     |M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M|     | |
   - - - - - - - - - - - - - - - - : - - - - - - - - - : - - - - - - - - - - - - - - -


`;

export const ETAGE_ASCII = String.raw`


   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  |P P P P P P P P P P P P P P P P P|M M M M M M M M M|P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P:M M M M M M M M M|P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P|M M M M M M M M M:P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P|M M M M M M M M M|P P P P P P P P P P P P P P P P|
                                     - - - - : - - - -
  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P|             |P P P P P P P P P P P P P P P P P|

  |P|P P P P P P P P P P P P P P P|                     |P P P P P P P P P P P P P P|P|

  |P:P P P P P P P P P P P P P|                             |P P P P P P P P P P P P:P|

  |P|P P P P P P P P P P P P|                                 |P P P P P P P P P P P|P|
     - - - - - - - - - - -                                       - - - - - - - - - -
  |P|P P P P P P P P P P P|                                     |P P P P P P P P P P|P|

  |P|P P P P P P P P P P|                                         |P P P P P P P P P|P|

  |P:P P P P P P P P P|                                             |P P P P P P P P:P|

  |P|P P P P P P P P P|                                             |P P P P P P P P|P|
     - - - - - - - -                                                   - - - - - - -
  |P|P P P P P P P P|                                                 |P P P P P P P|P|

  |P|P P P P P P P P|                                                 |P P P P P P P|P|

  |P:P P P P P P P|                                                     |P P P P P P:P|

  |P|P P P P P P P|                                                     |P P P P P P|P|
     - - - - - - -                                                       - - - - - -
  |P|P P P P P P P|                                                     |P P P P P P|P|

  |P|P P P P P P P|                                                     |P P P P P P|P|

  |P:P P P P P P P|                                                     |P P P P P P:P|

  |P|P P P P P P P|                                                     |P P P P P P|P|
     - - - - - - -                                                       - - - - - -
  |P|P P P P P P P|                                                     |P P P P P P|P|

  |P|P P P P P P P|                                                     |P P P P P P|P|

  |P:P P P P P P P P|                                                 |P P P P P P P:P|

  |P|P P P P P P P P|                                                 |P P P P P P P|P|
     - - - - - - - - -                                               - - - - - - - -
  |P|P P P P P P P P P|                                             |P P P P P P P P|P|

  |P|P P P P P P P P P|                                             |P P P P P P P P|P|

  |P:P P P P P P P P P P|                                         |P P P P P P P P P:P|

  |P|P P P P P P P P P P P|                                     |P P P P P P P P P P|P|
     - - - - - - - - - - - -                                   - - - - - - - - - - -
  |P|P P P P P P P P P P P P|                                 |P P P P P P P P P P P|P|

  |P|P P P P P P P P P P P P P|                             |P P P P P P P P P P P P|P|

  |P:P P P P P P P P P P P P P P P|                     |P P P P P P P P P P P P P P:P|

  |P|P P P P P P P P P P P P P P P P P|             |P P P P P P P P P P P P P P P P|P|
                                       - - - - - - -
  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|
   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


















`;
