/** Le texte réduit à son CODE : commentaires (bloc et ligne), contenu des chaînes `'…'`/`"…"` et
 *  segments texte des gabarits blanchis en ESPACES — lignes ET colonnes préservées, longueur
 *  identique. Les substitutions `${ … }` d'un gabarit et les littéraux de regexp sont du code et
 *  restent intacts. Prérequis de toute garde LEXICALE : un commentaire est de la prose, une chaîne
 *  une donnée — les compter comme du code force une liste de sites tolérés. Contrat et couverture :
 *  en-tête de `codeSeul.mjs`. */
export function codeSeul(src: string): string;
