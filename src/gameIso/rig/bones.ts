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
  | 'tete' | 'bras' | 'torse' | 'jambes' | 'pied' | 'main'
  | 'arme' | 'bouclier';

/** Os porteur(s) d'un slot. Le 2e os d'une paire (…D) est rendu en miroir. */
export const SLOT_BONES: Record<Slot, BoneId[]> = {
  visage: ['tete'], cheveux: ['tete'], tete: ['tete'],
  torse: ['torse'],
  bras: ['epauleG', 'epauleD'],
  jambes: ['cuisseG', 'cuisseD'],
  pied: ['piedG', 'piedD'],
  main: ['mainG', 'mainD'], // mains : agrippent l'arme/le bouclier (sinon l'arme « flotte »)
  arme: ['arme'], bouclier: ['bouclier'],
};

/** Ordre de calque d'un slot À L'INTÉRIEUR d'un même os (petit = dessous). */
export const SLOT_LAYER: Record<Slot, number> = {
  jambes: 0, torse: 1, bras: 2, pied: 0, main: 0,
  visage: 0, cheveux: 1, tete: 2,
  bouclier: 0, arme: 0,
};

/** Calque cosmétique additionnel attaché à un os (mutations, accessoires).
 *  Rendu PAR-DESSUS les parts, dans le repère local (échellé) de l'os. */
export interface RigOverlay {
  bone: BoneId;
  svg: string;
  /** dessiné DERRIÈRE la part de l'os (cornes derrière la tête, queue derrière le bassin,
   *  ventre derrière le torse) au lieu de par-dessus. */
  behind?: boolean;
  /** calque limité à une vue (détail de visage : groin, langue pendante… — de dos il
   *  flotterait sur la nuque). Absent = toutes vues. */
  view?: import('./facing').View;
  /** REMPLACE la part de l'os au lieu de se superposer (membre muté : bras → tentacule).
   *  `svg` vide = efface la part (le poing au bout d'un tentacule). */
  replace?: boolean;
  /** PLAN dédié dans le tri du peintre, dans le repère de l'os hôte : `fond` = derrière TOUT
   *  le corps (ailes de face — sinon le z inégal des bras en cache une), `avant` = devant tout
   *  (ailes vues de dos). Ignore `behind`/`replace`. */
  plane?: 'fond' | 'avant';
  /** id du registre APPENDAGES (cornes/queue MULTI-VUES) — quand présent, REMPLACE `svg`, résolu
   *  par vue via pickView. Même source/résolution que les features et monsterInjection. */
  appendage?: string;
}
