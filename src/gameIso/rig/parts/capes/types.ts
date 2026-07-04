/**
 * Une CAPE/manteau porté = un fichier `defs/<id>.ts`. Appendice DORSAL (os `torse`), art 3 vues
 * (règles de vue/profondeur codifiées par `dorsalOverlays`). Purement cosmétique (slot Cape de la
 * fiche). Ajouter un type de cape = déposer un fichier.
 */
export interface CapeDef {
  id: string;      // 'voyage'… — référencé par l'emplacement Cape (equip.cape)
  label: string;   // libellé FR
  front: string;   // vue de face (plan fond : silhouette derrière le corps)
  back: string;    // vue de dos (plan avant : couvre le dos, plis)
  profile: string; // vue de profil (drapé ancré à l'épaule, tombant sur le dos −x)
}
