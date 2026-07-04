/**
 * Une PROTHÈSE / amputation = un fichier `defs/<id>.ts`. Art SVG (déjà enveloppé `<g data-injury=…>`)
 * dans le repère local de l'os visé (main = poignet ; tête = visage (0,7) ; cuisse = hanche). Posé
 * par la machinerie de blessures (`injuryOverlaysFor`) selon les traumas + objets portés. Ajouter une
 * prothèse = déposer un fichier.
 */
export interface ProsthesisDef {
  id: string;    // 'moignon','crochet','main-mecanique','jambe-de-bois','cecite','nez-ampute','nez-dore'
  label: string; // libellé FR
  art: string;   // SVG enveloppé <g data-injury="<id>">…</g>
}
