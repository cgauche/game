/**
 * Cadre VISIBLE (boîte de tuiles) publié par IsoStage à chaque rendu (caméra / zoom / pan) et lu
 * par les hooks d'animation dans leur rAF pour CULLER les acteurs hors-champ : un acteur hors du
 * cadre ne paie plus son travail d'animation par frame (resolveRig + re-rendu). Découplé via un
 * simple module (PAS de prop ni de subscription React) → ne casse ni la mémoïsation des tokens ni
 * ne déclenche de re-rendu ; chaque hook lit le cadre courant au moment de son tick rAF.
 */
let bounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;

export function setVisibleTileBounds(b: { minX: number; maxX: number; minY: number; maxY: number }): void {
  bounds = b;
}

/**
 * La tuile (x,y) est-elle dans le cadre visible ? `margin` (en tuiles) couvre les corps HAUTS
 * (dessinés ~150 px au-dessus de leur tuile) et les empreintes multi-cases, pour ne jamais figer
 * un acteur dont le corps déborde dans le cadre. Défaut SÛR = visible tant qu'aucun cadre n'a été
 * publié (avant le 1er rendu d'IsoStage).
 */
export function isTileVisible(x: number, y: number, margin = 4): boolean {
  if (!bounds) return true;
  return x >= bounds.minX - margin && x <= bounds.maxX + margin && y >= bounds.minY - margin && y <= bounds.maxY + margin;
}
