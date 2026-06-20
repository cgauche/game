import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Loup",
  plan: 'quadruped',
  // Loup gris : silhouette LONGUE SUR PATTES (≠ molosse trapu du Chien), poitrail profond, ligne
  // de dos qui plonge vers une croupe basse, fraise de fourrure au garrot, longue queue touffue.
  quad: {"sl":0.82,"build":"canine","girth":0.95,"bodyLen":0.98,"neckLen":0.66,"neckAngle":-15,"legLen":0.98,"head":"loup","tail":"touffe","ears":"pointues","foot":"patte","mane":"hirsute","headScale":1.14,"tailLen":1.5,"stored":{"corps":"#6b7074","corpsO":"#3c4144","corpsH":"#949a9e","cheveux":"#2c3135","cheveuxO":"#1b1f22","cuir":"#26282a"}},
};
