/**
 * BATTERIE TONNERRE DE FEU (`batterie-tonnerre-de-feu`) — pièce à salve : banc de NEUF tubes courts de
 * fonte (3 rangées de 3) sur affût de campagne à roues. Art de l'engin (3 vues), routé par l'id d'espèce
 * `batterie-tonnerre-de-feu`. Signature de silhouette : la GRILLE de bouches multiples (≠ le tube unique
 * long du canon) + tubes courts et trapus empilés vus de profil.
 */
import { type EnginArtDef, wheelFace, wheelEdge } from '../artkit';

function profile(): string {
  return '<g>'
    // Affût : flasque de bois haut sous le banc de tubes, crosse descendant au sol vers l'arrière.
    + '<path d="M16 -36 L28 -34 L28 -18 L-46 -2 L-50 -9 L6 -36 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-50 -9 L-46 -2" stroke="@fer" stroke-width="2"/>' // sabot de crosse ferré
    // Banc de TROIS tubes COURTS empilés (les rangées vues de chant), bouches à droite, longueurs étagées.
    + '<path d="M-20 -62 L34 -63 L34 -55 L-20 -54 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-20 -52 L38 -53 L38 -45 L-20 -44 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-20 -42 L34 -43 L34 -35 L-20 -34 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<ellipse cx="34" cy="-59" rx="1.6" ry="3.4" fill="#0c0c10"/>' // âmes (bouches) étagées
    + '<ellipse cx="38" cy="-49" rx="1.6" ry="3.4" fill="#0c0c10"/>'
    + '<ellipse cx="34" cy="-39" rx="1.6" ry="3.4" fill="#0c0c10"/>'
    + '<line x1="8" y1="-63" x2="8" y2="-34" stroke="@fonteH" stroke-width="3"/>' // cerclage médian du banc
    + '<line x1="-14" y1="-63" x2="-14" y2="-34" stroke="@fonteH" stroke-width="3"/>' // cerclage de culasse
    // Plaque de culasse commune + manivelle de mise à feu à l'arrière.
    + '<path d="M-20 -64 L-26 -64 L-26 -33 L-20 -33 Z" fill="@fer" stroke="@ferH" stroke-width="1"/>'
    + '<circle cx="-30" cy="-48" r="4" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-30 -48 l-6 5" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>'
    + `<g transform="translate(10,-22)">${wheelFace(22)}</g>` // grande roue (côté proche), au sol
    + '</g>';
}

function front(): string {
  return '<g>'
    + `<g transform="translate(-34,-21)">${wheelEdge(42)}</g>` // roues de bout (flanquantes)
    + `<g transform="translate(34,-21)">${wheelEdge(42)}</g>`
    + '<path d="M-22 -4 L22 -4 L16 -32 L-16 -32 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // corps d'affût
    + '<path d="M-19 -14 L19 -14" stroke="@boisO" stroke-width="2"/>'
    // Cadre de fer du banc + GRILLE 3x3 de bouches (LA signature de la pièce à salve).
    + '<rect x="-24" y="-70" width="48" height="42" rx="4" fill="@fonte" stroke="@fer" stroke-width="2"/>'
    + '<rect x="-24" y="-70" width="48" height="42" rx="4" fill="none" stroke="@fonteH" stroke-width="1.5"/>'
    + '<g fill="#0c0c10" stroke="@fonteH" stroke-width="1.2">'
    + '<circle cx="-13" cy="-62" r="5"/><circle cx="0" cy="-62" r="5"/><circle cx="13" cy="-62" r="5"/>'
    + '<circle cx="-13" cy="-49" r="5"/><circle cx="0" cy="-49" r="5"/><circle cx="13" cy="-49" r="5"/>'
    + '<circle cx="-13" cy="-36" r="5"/><circle cx="0" cy="-36" r="5"/><circle cx="13" cy="-36" r="5"/>'
    + '</g>'
    + '<circle cx="-14.5" cy="-63.5" r="1.5" fill="#26242a"/>' // reflets d'âme (coin haut-gauche)
    + '<circle cx="-1.5" cy="-50.5" r="1.5" fill="#26242a"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    + `<g transform="translate(-34,-21)">${wheelEdge(42)}</g>`
    + `<g transform="translate(34,-21)">${wheelEdge(42)}</g>`
    + '<path d="M-7 -6 L7 -6 L4 -46 L-4 -46 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // flèche d'affût fuyante
    + '<path d="M-20 -6 L20 -6 L15 -30 L-15 -30 Z" fill="@boisO" stroke="@fer" stroke-width="1.5"/>' // corps d'affût (dos)
    // Plaque de culasse commune : cadre de fer + 3x3 boutons de culasse + lumières de mise à feu.
    + '<rect x="-22" y="-66" width="44" height="38" rx="4" fill="@fonteO" stroke="@fer" stroke-width="2"/>'
    + '<g fill="@fonteH" stroke="@fer" stroke-width="1">'
    + '<circle cx="-12" cy="-59" r="3.5"/><circle cx="0" cy="-59" r="3.5"/><circle cx="12" cy="-59" r="3.5"/>'
    + '<circle cx="-12" cy="-47" r="3.5"/><circle cx="0" cy="-47" r="3.5"/><circle cx="12" cy="-47" r="3.5"/>'
    + '<circle cx="-12" cy="-35" r="3.5"/><circle cx="0" cy="-35" r="3.5"/><circle cx="12" cy="-35" r="3.5"/>'
    + '</g>'
    + '<circle cx="-12" cy="-63.5" r="1.2" fill="#0c0c10"/><circle cx="0" cy="-63.5" r="1.2" fill="#0c0c10"/><circle cx="12" cy="-63.5" r="1.2" fill="#0c0c10"/>' // lumières (rangée haute)
    // Manivelle de mise à feu vers le spectateur (on sert la pièce depuis l'arrière).
    + '<path d="M22 -45 l8 6 l-5 5" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'batterie-tonnerre-de-feu', front, profile, back };
