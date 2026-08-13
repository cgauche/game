/**
 * BACKEND VOLUMIQUE des marques DYNAMIQUES (#1176, P3-0d) — le pendant three des trois repères que la
 * voie affine trace à la frame (`stage/tokens.dynamicHighlightObjs`) : lien d'ENGAGEMENT, contour de
 * l'unité ACTIVE, repère de position du GROUPE — plus l'ANNEAU D'ÉQUIPE aux pieds de chaque jeton
 * (P3-0e), que l'affine peint DANS son jeton (`BodyToken`). Même partage que `highlightMeshes.ts` : le
 * MONTAGE est ici, la POSE par frame vit dans `stage/dynamicMarkPose.ts`.
 *
 * QUATRE POOLS de capacité FIXE, montés une fois pour la vie de l'écran. Contrairement aux marques
 * statiques, la capacité ne suit même pas des paliers : ces marques se réécrivent SOIXANTE FOIS PAR
 * SECONDE (elles suivent la glisse de marche), et un pool qui se redimensionne dans la boucle de rendu
 * est un pool qui alloue dans la boucle de rendu.
 *
 * LE LIEN EST FAIT DE QUADS, pas d'une ligne, et c'est mesuré :
 *  - `LineBasicMaterial.linewidth` part à `gl.lineWidth`, que la quasi-totalité des pilotes WebGL
 *    borne à 1 (`ALIASED_LINE_WIDTH_RANGE`) — l'épaisseur 2 de la voie affine n'y serait pas rendue ;
 *  - `LineSegments.computeLineDistances()`, qu'exige `LineDashedMaterial` à chaque changement de
 *    géométrie, RECONSTRUIT son tableau et son `Float32BufferAttribute` à chaque appel
 *    (`three/src/objects/LineSegments.js`) — donc une allocation par frame de marche.
 * Un pointillé de quads n'a ni l'une ni l'autre limite : l'épaisseur est une échelle d'instance, et la
 * pose ne fait que réécrire des matrices. Le COÛT est borné par la nature de l'engagement : deux
 * combattants Engagés sont en CONTACT de mêlée, donc le lien fait environ une case — au pas de
 * pointillé de la voie affine (7 px, pour un pas de case qui se projette sur 35,78 px, cf.
 * `builders/dynamicMarks`), six quads pour un lien d'une case.
 */
import * as THREE from 'three';
import { ACTIVE_HALO_TINT, ENGAGE_TINT } from '../../highlightTints';
import { RING_FRAME_K, tileFrameGeometry, tileQuadGeometry } from './highlightMeshes';
import { SPECKLE_LIFT_M } from './groundAccents';

/** Un pool de marques dynamiques. */
export type DynMarkSlot = 'tether' | 'actif' | 'groupe' | 'anneau';

/** Les quatre pools, dans l'ordre de RANG croissant. */
export const DYN_MARK_SLOTS: readonly DynMarkSlot[] = ['actif', 'groupe', 'anneau', 'tether'];

/** RANG de superposition, dans la MÊME échelle que les marques statiques (`highlightMeshes.SLOT_RANK`,
 *  qui s'arrête à 8) : ces quatre-là passent AU-DESSUS de toutes les marques de case, comme en affine où
 *  elles sont émises après le builder. L'ANNEAU d'équipe passe au-dessus du contour d'actif et du repère
 *  de groupe : la voie affine le peint DANS le jeton (profondeur `+0.5`, `stage/tokens.combatantObjs`)
 *  quand elle pose ces deux-là sous les jetons (`+0.25`, `dynamicHighlightObjs`).
 *
 *  LE LIEN D'ENGAGEMENT EST AU SOMMET (correctif du juge vision, 2026-08-13) : sous le contour d'actif,
 *  son dernier tiers disparaissait dans la bande or de la case active — un cadre d'opacité 1, large de
 *  `RING_FRAME_K` de case, que le lien traverse pour rejoindre le centre de cette case. Un lien amputé
 *  se lit comme un lien PLUS COURT, donc comme une autre situation de mêlée. Le rang 13 appartient déjà
 *  aux halos d'interaction (`interactHaloMeshes.HALO_SLOT_RANK`) : le bloc dynamique reste borné à 12. */
export const DYN_SLOT_RANK: Record<DynMarkSlot, number> = { actif: 9, groupe: 10, anneau: 11, tether: 12 };

/** Décollement (m) d'un pool au-dessus de la surface qui le porte. */
export function dynSlotLiftM(slot: DynMarkSlot): number {
  return (DYN_SLOT_RANK[slot] + 1) * SPECKLE_LIFT_M;
}

/** Opacités de la voie affine, à l'identique (ni le contour de l'actif ni l'anneau d'équipe n'y portent
 *  d'`opacity`) — SAUF le lien d'engagement.
 *
 *  LIEN : la parité d'EFFET PERÇU prime sur la parité de valeur (correctif du juge vision, 2026-08-13).
 *  La scène volumique est trois fois plus claire que l'affine (luminance de sol mesurée 73 contre 24) ;
 *  `ENGAGE_TINT` valant 137,7 de luminance, le lien détache 68,3 de son sol en affine à 0,6, mais 38,8
 *  seulement en volumique à la même valeur — il s'y lisait plus sombre que l'anneau d'équipe ennemi qu'il
 *  rejoint. À pleine
 *  opacité il en détache 64,7, l'écart de l'affine à 5 % près. */
export const DYN_SLOT_OPACITY: Record<DynMarkSlot, number> = { tether: 1, actif: 1, groupe: 0.5, anneau: 1 };

/** Teintes — le MÊME catalogue que la voie affine (`highlightTints`). `null` = teinte PAR INSTANCE :
 *  l'anneau d'équipe porte celle de son combattant (`builders/dynamicMarks.teamRingDecor`). */
export const DYN_SLOT_TINT: Record<DynMarkSlot, string | null> = {
  tether: ENGAGE_TINT,
  actif: ACTIVE_HALO_TINT,
  groupe: ACTIVE_HALO_TINT,
  anneau: null,
};

/** Épaisseur du cadre du repère de GROUPE : la MOITIÉ de celle du contour d'actif — le rapport exact
 *  des deux traits de la voie affine (1,5 px contre 3). */
export const PARTY_FRAME_K = RING_FRAME_K / 2;

/** Capacité FIXE de chaque pool. `tether` : une dizaine de quads par lien, donc de l'ordre de vingt
 *  liens simultanés ; `actif` : l'empreinte de la plus grande unité (5×5 = 25) ; `groupe` : le repère
 *  est unique ; `anneau` : une trentaine de cordes par anneau (le trait plein en demande plus que le
 *  pointillé), donc de l'ordre de vingt jetons postés simultanément. Au-delà, la pose écrit ce qu'elle
 *  peut et s'arrête à la capacité — elle ne réalloue jamais dans la boucle de rendu. */
export const DYN_SLOT_CAPACITY: Record<DynMarkSlot, number> = { tether: 256, actif: 32, groupe: 4, anneau: 768 };

/** Pool d'un slot : géométrie du slot (quad plein pour un tiret de lien ou d'anneau, cadre pour un
 *  contour), matériau NON éclairé — un repère de jeu ne s'assombrit pas la nuit — et NON EMBRUMÉ
 *  (`fog: false`) : cette marque est du chrome d'interface, pas de la matière du monde. La brume du POV
 *  (`applyFogGamma`, `sceneMeshes.ts`) mangerait sinon l'opacité que le slot porte au titre de la
 *  lisibilité — à 26 cases, la courbe extérieure en retire 71 % (#1176 P3-1c). Un slot dont la teinte
 *  est `null` la porte PAR INSTANCE (`instanceColor` alloué dès la construction, comme
 *  `buildHighlightMesh`) : l'anneau d'équipe change de couleur d'un combattant à l'autre. */
export function buildDynamicMarkMesh(slot: DynMarkSlot, capacity = DYN_SLOT_CAPACITY[slot]): THREE.InstancedMesh {
  const teinte = DYN_SLOT_TINT[slot];
  const geo = slot === 'tether' || slot === 'anneau' ? tileQuadGeometry() : tileFrameGeometry(slot === 'groupe' ? PARTY_FRAME_K : RING_FRAME_K);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(teinte ?? 0xffffff),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: DYN_SLOT_OPACITY[slot],
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  if (!teinte) {
    const blanc = new THREE.Color(1, 1, 1);
    for (let i = 0; i < capacity; i++) mesh.setColorAt(i, blanc);
  }
  mesh.name = `marquesDyn:${slot}`;
  mesh.frustumCulled = false; // ces marques suivent l'action : la sphère du pool vaudrait la scène
  mesh.count = 0;
  return mesh;
}
