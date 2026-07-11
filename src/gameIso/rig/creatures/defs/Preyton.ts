import type { CreatureDef } from '../types';

// Preyton (ZI folio 60) — réf art : art-ref/zi/page063_full.png. Bête TORSE tapie : GRANDES
// ailes membraneuses de chauve-souris déchiquetées à griffes de poignet (wings 'membrane',
// wingSpan fort — elles dominent la silhouette), arrière-train léonin à griffes ('patte' via
// build 'feline' : haunches musclées) sur des antérieurs de cerf difforme (frontFoot 'sabot'),
// épaisse queue de reptile écailleuse qui boucle au sol (tail 'reptile' allongée). Gueule
// BÂILLANTE hérissée de rangées de crocs et regard furieux = tête 'dragon' (gueule ouverte
// dentée, œil fendu — la seule tête à mâchoire béante du vocabulaire), coiffée de ramures
// acérées NOIRCIES (headgear 'bois' teinté @cheveux quasi noir, comme l'épaisse toison
// hirsute d'encolure). Robe charbon-terreux de la gravure, serres couleur corne.
export const creature: CreatureDef = {
  name: 'Preyton',
  plan: 'winged',
  quad: {
    sl: 1.1, build: 'feline', girth: 1.08, bodyLen: 1.02, neckLen: 0.7, neckAngle: -30, legLen: 0.95,
    head: 'dragon', headScale: 1.08, headgear: 'bois', ears: 'pointues',
    foot: 'patte', frontFoot: 'sabot', tail: 'reptile', tailLen: 1.35,
    wings: 'membrane', wingSpan: 1.7, mane: 'hirsute', ridge: 'sans',
    stored: { corps: '#3b332c', corpsO: '#171310', corpsH: '#6e6152', cheveux: '#1a1512', cheveuxO: '#0b0907', cuir: '#8a7a5e' },
  },
};
