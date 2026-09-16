/**
 * SOURCE ASCII de la carte de l'opéra (généré une fois depuis l'ancienne géométrie, puis ÉDITABLE ici).
 * 1 char = 1 case ; format box-drawing de `parseWalledAscii` (lignes/colonnes paires = ARÊTES).
 * Légende cases : ' '=vide (hors bâtiment / PUITS de rampe) · ','=salle (dalle) · 'P'=parterre (parquet) ·
 *   'M'=foyer (marbre) · 'S'=scène (planches, +1 m) · 's'=fosse (planches, −1 m). Arêtes : '-'=mur (N) ·
 *   '|'=mur (E) · ':'=PORTE. Les 2 PUITS de rampe (angles du foyer, où la couche 0 monte 0→4 m rejoindre la
 *   galerie) sont TROUÉS ici même à l'étage (cases ' ' aux cols 6-8 / 35-37, rangées 46-49) — plus aucun
 *   perçage en code. Seule l'ÉLÉVATION MÉTRIQUE (S/s + rampes + galerie à 4 m) est posée par `floorplan.ts`
 *   (via `MapSpec.relief`), la donnée non exprimable en 1 char.
 * Largeur de grille = 89 (= 2·44+1) ; les espaces de fin sont retirés → `MapSpec.walled` re-complète.
 */
export const REZ_ASCII = String.raw`


   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  |, , , , , ,|, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , ,:

  |, , , , , ,|, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , ,|, , , , ,|
   - - : - - -             - - - - - - - - - - - - - - - - - -
  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S:, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,:, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,:, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|

  |, , , , , ,|, , , , , ,|S S S S S S S S S S S S S S S S S S|, , , , , , ,|, , , , ,|
                                                                             : - - - -
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
  |, , , , , , , , , , , ,|, , , , , , , , , , , , , , , , , ,|, , , , , , , , , , , ,|

  |M M M M M M M M M M M M|M M M M M M M M M M M M M M M M M M|M M M M M M M M M M M M|
                                                                     -
  |M M M M M|M M M M M M M|M M M M M M M M M M M M M M M M M M|M M M|M M M M M M M M M|

  |M M M M M|M M M M M M M:M M M M M M M M M M M M M M M M M M:M M M|M M M M M M M M M|

  |M M M M M|M M M M M M M|M M M M M M M M M M M M M M M M M M|M M M|M M M M M M M M M|
                                                                     -
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

  |P P P P P P P P P P P P P P P P P P               P P P P P P P P P P P P P P P P P|
     - - - - - - - - - - - - - - -                       - - - - - - - - - - - - - -
  |P|P P P P P P P P P P P P P P P                       P P P P P P P P P P P P P P|P|

  |P:P P P P P P P P P P P P P                               P P P P P P P P P P P P:P|

  |P|P P P P P P P P P P P P                                   P P P P P P P P P P P|P|
     - - - - - - - - - - -                                       - - - - - - - - - -
  |P|P P P P P P P P P P P                                       P P P P P P P P P P|P|

  |P|P P P P P P P P P P                                           P P P P P P P P P|P|

  |P:P P P P P P P P P                                               P P P P P P P P:P|

  |P|P P P P P P P P P                                               P P P P P P P P|P|
     - - - - - - - -                                                   - - - - - - -
  |P|P P P P P P P P                                                   P P P P P P P|P|

  |P|P P P P P P P P                                                   P P P P P P P|P|

  |P:P P P P P P P                                                       P P P P P P:P|

  |P|P P P P P P P                                                       P P P P P P|P|
     - - - - - - -                                                       - - - - - -
  |P|P P P P P P P                                                       P P P P P P|P|

  |P|P P P P P P P                                                       P P P P P P|P|

  |P:P P P P P P P                                                       P P P P P P:P|

  |P|P P P P P P P                                                       P P P P P P|P|
     - - - - - - -                                                       - - - - - -
  |P|P P P P P P P                                                       P P P P P P|P|

  |P|P P P P P P P                                                       P P P P P P|P|

  |P:P P P P P P P P                                                   P P P P P P P:P|

  |P|P P P P P P P P                                                   P P P P P P P|P|
     - - - - - - - -                                                   - - - - - - -
  |P|P P P P P P P P P                                               P P P P P P P P|P|

  |P|P P P P P P P P P                                               P P P P P P P P|P|

  |P:P P P P P P P P P P                                           P P P P P P P P P:P|

  |P|P P P P P P P P P P P                                       P P P P P P P P P P|P|
     - - - - - - - - - - -                                       - - - - - - - - - -
  |P|P P P P P P P P P P P P                                   P P P P P P P P P P P|P|

  |P|P P P P P P P P P P P P P                               P P P P P P P P P P P P|P|

  |P:P P P P P P P P P P P P P P P                       P P P P P P P P P P P P P P:P|

  |P|P P P P P P P P P P P P P P P P P               P P P P P P P P P P P P P P P P|P|
     - - - - - - - - - - - - - - - - -               - - - - - - - - - - - - - - - -
  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|

  |P P P P P       P P P P P P P P P P P P P P P P P P P P P P P P P P       P P P P P|

  |P P P P P       P P P P P P P P P P P P P P P P P P P P P P P P P P       P P P P P|

  |P P P P P       P P P P P P P P P P P P P P P P P P P P P P P P P P       P P P P P|

  |P P P P P       P P P P P P P P P P P P P P P P P P P P P P P P P P       P P P P P|

  |P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P|
   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


















`;

/** CALQUE de ZONES du REZ (`MapSpec.zoneMap.z0`) — 1 char = 1 case, MÊMES dimensions que la grille
 *  (44×60), `.` = aucune pièce déclarée. Une pièce = une entrée de la LÉGENDE du plan officiel
 *  (NADJ 08 folio 39 — légende du plan (image)) ; la légende char→id/label vit dans `floorplan.ts`.
 *  Les aires du box-drawing ne recoupent pas toujours le cloisonnement du plan : là où une aire close
 *  porte DEUX pièces de la légende (13 sous 14, 10 sous 15, 27 sous 26, 20 dans la bande des coulisses,
 *  8/9 dans le salon), c'est ce calque qui tranche — il est LIBRE, aucun mur ne s'invente dans l'ASCII. */
export const REZ_ZONES_ASCII = String.raw`
............................................
.AAAAAABBBBBBDDDDDDDDDDDDDDDDDCCCCCCCCPPPPP.
.AAAAAABBBBBBDDDDDDDDDDDDDDDDDCCCCCCCCPPPPP.
.AAAAAABBBBBBDDDDDDDDDDDDDDDDDCCCCCCCCPPPPP.
.AAAAAABBBBBBDDDDDDDDDDDDDDDDDCCCCCCCCPPPPP.
.AAAAAABBBBBBEEEEEEEEEEEEEEEEEECCCCCCCPPPPP.
.AAAAAABBBBBBEEEEEEEEEEEEEEEEEECCCCCCCPPPPP.
.AAAAAABBBBBBEEEEEEEEEEEEEEEEEECCCCCCCPPPPP.
.AAAAAABBBBBBEEEEEEEEEEEEEEEEEECCCCCCCPPPPP.
.AAAAAABBBBBBEEEEEEEEEEEEEEEEEECCCCCCCPPPPP.
.AAAAAABBBBBBEEEEEEEEEEEEEEEEEECCCCCCCQQQQQ.
.AAAAAABBBBBBEEEEEEEEEEEEEEEEEECCCCCCCQQQQQ.
.AAAAAABBBBBBEEEEEEEEEEEEEEEEEECCCCCCCQQQQQ.
.AAAAAABBBBBBEEEEEEEEEEEEEEEEEECCCCCCCQQQQQ.
.AAAAAABBBBBBEEEEEEEEEEEEEEEEEECCCCCCCQQQQQ.
.HHHHHHHHHHHHHHHHFFFFFFFFFFFLLLLLLLLLLLLLLL.
.HHHHHHHHHHHHHHHHFFFFFFFFFFFLLLLLLLLLLLLLLL.
.HHHHHHHHHHHHHHHHFFFFFFFFFFFLLLLLLLLLLLLLLL.
.HHHHHHHHHHHHHHHHFFFFFFFFFFFLLLLLLLLLLLLLLL.
.HHHHHHHHHHHHHHHHFFFFFFFFFFFLLLLLLLLLLLLLLL.
.HHHHHHHHHHHHHHHHGGGGGGGGGGGLLLLLLLLLLLLLLL.
.HHHHHHHHHHHHHHHHGGGGGGGGGGGLLLLLLLLLLLLLLL.
.HHHHHHHHHHHHHHHGGGGGGGGGGGGGLLLLLLLLLLLLLL.
.HHHHHHHHHHHHHHHGGGGGGGGGGGGGLLLLLLLLLLLLLL.
.IIIIIIIIIIIIIIIGGGGGGGGGGGGGMMMMMMMMMMMMMM.
.IIIIIIIIIIIIIIGGGGGGGGGGGGGGGMMMMMMMMMMMMM.
.IIIIIIIIIIIIIIGGGGGGGGGGGGGGGMMMMMMMMMMMMM.
.IIIIIIIIIIIIIIGGGGGGGGGGGGGGGMMMMMMMMMMMMM.
.IIIIIIIIIIIIIGGGGGGGGGGGGGGGGGMMMMMMMMMMMM.
.IIIIIIIIIIIIIGGGGGGGGGGGGGGGGGMMMMMMMMMMMM.
.IIIIIIIIIIIIIGGGGGGGGGGGGGGGGGMMMMMMMMMMMM.
.IIIIIIIIIIIIGGGGGGGGGGGGGGGGGGGNNNNNNNNNNN.
.IIIIIIIIIIIIGGGGGGGGGGGGGGGGGGGNNNNNNNNNNN.
.IIIIIIIIIIIGGGGGGGGGGGGGGGGGGGGGNNNNNNNNNN.
.JJJJJJJJJJJGGGGGGGGGGGGGGGGGGGGGNNNNNNNNNN.
.JJJJJJJJJJJGGGGGGGGGGGGGGGGGGGGGOOOOOOOOOO.
.JJJJJJJJJJGGGGGGGGGGGGGGGGGGGGGGGOOOOOOOOO.
.JJJJJJJJJJGGGGGGGGGGGGGGGGGGGGGGGOOOOOOOOO.
.JJJJJJJJJJGGGGGGGGGGGGGGGGGGGGGGGOOOOOOOOO.
.JJJJJJJJJGGGGGGGGGGGGGGGGGGGGGGGGGOOOOOOOO.
.KKKKKKKKKGGGGGGGGGGGGGGGGGGGGGGGGGOOOOOOOO.
.KKKKKKKKKGGGGGGGGGGGGGGGGGGGGGGGGGOOOOOOOO.
.KKKKKKKKGGGGGGGGGGGGGGGGGGGGGGGGGGGOOOOOOO.
.KKKKKKKKGGGGGGGGGGGGGGGGGGGGGGGGGGGOOOOOOO.
.RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.
.RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.
.RRRRRSSSRRRRRRRRRRRRRRRRRRRRRRRRRTTTTRRRRR.
.RRRRRSSSRRRRRRRRRRRRRRRRRRRRRRRRRTTTTRRRRR.
.RRRRRSSSRRRRRRRRRRRRRRRRRRRRRRRRRTTTTRRRRR.
.RRRRRSSSRRRRRRRRRRRRRRRRRRRRRRRRRRTTTRRRRR.
.RRRRRSSSRRRRRRRRRRRRRRRRRRRRRRRRRRTTTRRRRR.
.RRRRRRRRRRRRUUUURRRRRRRRRRRVVVVRRRRRRRRRRR.
.RRRRRRRRRRRRUUUURRRRRRRRRRRVVVVRRRRRRRRRRR.
.RRRRRRRRRRRRUUUURRRRRRRRRRRVVVVRRRRRRRRRRR.
.RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.
.RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.
.RXXXRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRYYYR.
.RXXXRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRYYYR.
.....RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.....
............................................
`;

/** CALQUE de ZONES de l'ÉTAGE (`MapSpec.zoneMap.z1`) — même contrat que `REZ_ZONES_ASCII`. */
export const ETAGE_ZONES_ASCII = String.raw`
............................................
..................ZZZZZZZZZ.................
..................ZZZZZZZZZ.................
..................ZZZZZZZZZ.................
..................ZZZZZZZZZ.................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
............................................
`;
