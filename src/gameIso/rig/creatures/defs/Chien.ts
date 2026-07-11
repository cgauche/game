import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Chien",
  plan: 'quadruped',
  // Molosse de guerre (LDB 78 l.29-32) — calé sur l'artwork officiel (art-ref/ldb/page317_img7361.png) :
  // bouledogue MASSIF et BAS sur pattes, harnaché d'une armure de guerre. build 'suid' = bosse d'épaule
  // haute + arrière-main fine + membres courts et forts (la charge du molosse, pas le lévrier) ; tête
  // 'loup' très grossie (crâne large, stop marqué), oreilles courtes tombantes, queue fouet. Le HARNAIS
  // vit dans le langage du gabarit : ridge 'plaques' = disques rivetés sur le haut du flanc (plastron
  // segmenté), et les tokens @cheveux/@cheveuxO portent l'ACIER de l'artwork (crête cloutée d'épaule,
  // liseré de nuque, rebords des plaques) sur la robe fauve/brune.
  quad: {
    sl: 0.78, build: 'suid', girth: 1.25, bodyLen: 0.88, neckLen: 0.34, neckAngle: -4, legLen: 0.45,
    head: 'loup', headScale: 1.5, tail: 'fouet', tailLen: 0.85, ears: 'courtes', foot: 'patte',
    mane: 'sans', ridge: 'plaques', markings: 'sans',
    stored: {
      corps: '#8a5f3a', corpsO: '#43301e', corpsH: '#ad8455', // robe fauve/brune de l'artwork
      cheveux: '#9198a0', cheveuxO: '#d6d9dd', // aciers du harnais (crête/liserés/rebords de plaques)
      cuir: '#241c14',
    },
  },
};
