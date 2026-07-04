/**
 * Une paire d'AILES = un fichier `defs/<id>.ts`. Art SVG 3 vues (repère os `torse`) : ailes REPLIÉES
 * dans le dos, servies en DORSAL (dorsalOverlays) par le trait Vol et par monster.ailes. `back` a son
 * pli central propre (≠ front), donc les 3 vues sont explicites. Ajouter un type d'ailes = un fichier.
 */
export interface WingDef {
  id: string;      // 'plumes', 'cuir'… — référencé par monster.ailes (bool→plumes, 'cuir') / l'élément 'ailes'
  label: string;   // libellé FR
  front: string;   // vue de face (dépassent derrière les épaules)
  back: string;    // vue de dos (couvrent le dos, pli central)
  profile: string; // vue de profil (une seule aile vers l'arrière)
}
