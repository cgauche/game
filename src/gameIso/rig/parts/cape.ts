/**
 * Cape/manteau PORTÉ (emplacement Cape de la fiche — purement cosmétique, aucun effet de règles).
 * Appendice DORSAL accroché aux épaules : os `torse` (pivot taille — épaules ≈ y −28, ourlet sous
 * les hanches ≈ y +46, cf. PART-CONTRACT). Les règles de vue/profondeur sont codifiées par
 * `dorsalOverlays` : derrière TOUT le corps de face, devant tout de dos, drapée sur le bord du
 * dos (−x) de profil. Laine de voyage sobre (vert lodén) — distincte du cuir d'armure.
 */
export const CAPE_ART = {
  // FACE (plan fond) : seule la silhouette déborde du corps — épaules un peu plus larges que le
  // torse (±17) et ourlet sous les hanches. Pas de plis : le corps couvre l'intérieur.
  front:
    '<g data-equip="cape">'
    + '<path d="M-15 -29 Q0 -34 15 -29 L18.5 36 Q11 46 0 47 Q-11 46 -18.5 36 Z" fill="#566044" stroke="#39402c" stroke-width="0.9"/>'
    + '<path d="M-18.5 36 Q11 46 0 47 Q-11 46 -18.5 36 L-17.6 32 Q0 42.5 17.6 32 L18.5 36" fill="#454e36" opacity="0.85"/>'
    + '</g>',
  // DOS (plan avant) : la cape couvre tout le dos — col rabattu, plis tombants, ourlet éclairci.
  back:
    '<g data-equip="cape">'
    + '<path d="M-15 -30 Q0 -35 15 -30 L18.5 36 Q11 46 0 47 Q-11 46 -18.5 36 Z" fill="#566044" stroke="#39402c" stroke-width="0.9"/>'
    + '<path d="M-15 -30 Q0 -36 15 -30 L13.4 -24 Q0 -29 -13.4 -24 Z" fill="#454e36" stroke="#39402c" stroke-width="0.7"/>'
    + '<path d="M-8 -22 Q-10 8 -9.5 38" stroke="#454e36" stroke-width="1" fill="none" opacity="0.8"/>'
    + '<path d="M0 -21 Q-0.5 10 0 41" stroke="#454e36" stroke-width="1" fill="none" opacity="0.8"/>'
    + '<path d="M8 -22 Q10 8 9.5 38" stroke="#454e36" stroke-width="1" fill="none" opacity="0.8"/>'
    + '<path d="M-17 33 Q0 44 17 33 L18.5 36 Q11 46 0 47 Q-11 46 -18.5 36 Z" fill="#616b4c" opacity="0.7"/>'
    + '</g>',
  // PROFIL : le dos est à −x — drapé ancré à l'épaule, tombant le long du dos, ourlet qui flotte.
  profile:
    '<g data-equip="cape">'
    + '<path d="M1 -29 Q-9 -27 -12 -16 Q-16 4 -15 22 Q-14.5 36 -10 45 Q-4 47 0 43 Q-3 20 -3 -6 Q-3 -23 1 -29 Z" fill="#566044" stroke="#39402c" stroke-width="0.9"/>'
    + '<path d="M-9 -20 Q-12 5 -10.5 38" stroke="#454e36" stroke-width="0.9" fill="none" opacity="0.8"/>'
    + '<path d="M-14.7 30 Q-13 40 -10 45 Q-4 47 0 43 L-0.5 40 Q-6 43 -10 41.5 Q-13 37 -14 30 Z" fill="#454e36" opacity="0.85"/>'
    + '</g>',
};
