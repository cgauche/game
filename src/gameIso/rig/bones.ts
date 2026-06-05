/** Os du squelette humanoïde (boîte locale 120×150, pieds en (60,150)). */
export type BoneId =
  | 'bassin' | 'torse' | 'cou' | 'tete'
  | 'epauleG' | 'avantBrasG' | 'mainG'
  | 'epauleD' | 'avantBrasD' | 'mainD'
  | 'cuisseG' | 'tibiaG' | 'piedG'
  | 'cuisseD' | 'tibiaD' | 'piedD'
  | 'arme' | 'bouclier';

export const BONE_IDS: BoneId[] = [
  'bassin', 'torse', 'cou', 'tete',
  'epauleG', 'avantBrasG', 'mainG',
  'epauleD', 'avantBrasD', 'mainD',
  'cuisseG', 'tibiaG', 'piedG',
  'cuisseD', 'tibiaD', 'piedD',
  'arme', 'bouclier',
];

export interface Bone {
  id: BoneId;
  parent: BoneId | null;
  /** attache dans le repère LOCAL du parent. */
  pivot: { x: number; y: number };
  /** longueur/épaisseur (morphologie). */
  length: number;
  thickness: number;
  /** angle au repos (degrés), surchargé par la Pose. */
  angle: number;
  /** tri inter-os (peintre) : plus grand = devant. */
  z: number;
}

export type Skeleton = Record<BoneId, Bone>;

/** Parts visuelles interchangeables. */
export type Slot =
  | 'visage' | 'cheveux'
  | 'tete' | 'bras' | 'torse' | 'jambes' | 'pied'
  | 'arme' | 'bouclier';

/** Os porteur(s) d'un slot. Le 2e os d'une paire (…D) est rendu en miroir. */
export const SLOT_BONES: Record<Slot, BoneId[]> = {
  visage: ['tete'], cheveux: ['tete'], tete: ['tete'],
  torse: ['torse'],
  bras: ['epauleG', 'epauleD'],
  jambes: ['cuisseG', 'cuisseD'],
  pied: ['piedG', 'piedD'],
  arme: ['arme'], bouclier: ['bouclier'],
};

/** Ordre de calque d'un slot À L'INTÉRIEUR d'un même os (petit = dessous). */
export const SLOT_LAYER: Record<Slot, number> = {
  jambes: 0, torse: 1, bras: 2, pied: 0,
  visage: 0, cheveux: 1, tete: 2,
  bouclier: 0, arme: 0,
};

/** Calque cosmétique additionnel attaché à un os (mutations, accessoires).
 *  Rendu PAR-DESSUS les parts, dans le repère local (échellé) de l'os. */
export interface RigOverlay {
  bone: BoneId;
  svg: string;
}
