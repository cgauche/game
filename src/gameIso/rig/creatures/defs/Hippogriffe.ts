import type { CreatureDef } from '../types';

// Hippogriffe (artwork LDB p.323) : AVANT-TRAIN D'AIGLE — tête et encolure BLANCHES à bec crochu
// jaune, poitrail brun-doré moucheté (foreCoat, robe des ailes), serres et tarses JAUNES — sur un
// ARRIÈRE-TRAIN DE CHEVAL BLANC (robe claire pommelée, sabots sombres, queue de crin blanche) ;
// grandes ailes de rapace brunes (famille `aile`, comme le pégase).
export const creature: CreatureDef = {
  name: "Hippogriffe",
  plan: 'winged',
  quad: {
    sl: 1.08, build: 'equine', girth: 1, bodyLen: 1.02, neckLen: 0.9, neckAngle: -44, legLen: 1.05,
    head: 'aigle', tail: 'crin', ears: 'courtes', foot: 'sabot', frontFoot: 'serre',
    wings: 'plumes', wingSpan: 1.3, mane: 'hirsute', foreCoat: 'plumes',
    headScale: 1.2, tailLen: 1.2, markings: 'taches',
    stored: {
      corps: '#ddd7c9', corpsO: '#8d8672', corpsH: '#f5f2e9',
      cheveux: '#e9e4d7', cheveuxO: '#a7a08c',
      cuir: '#4b4138',
      aile: '#8a5a2e', aileO: '#4e3013', aileH: '#c99b58',
      cuirAv: '#d8a832',
    },
  },
};
