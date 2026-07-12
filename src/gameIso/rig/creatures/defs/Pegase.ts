import type { CreatureDef } from '../types';

// Pégase — fidélité à l'artwork officiel (art-ref/ldb/page325_img7829.png) : cheval à robe
// BLANC ARGENTÉ pommelée (markings 'taches', ombres gris-bleu), paire d'IMMENSES ailes
// emplumées BRUN/DORÉ nettement distinctes de la robe (@aile*), portées DRESSÉES vers le
// haut/arrière (wingPose 'dressees' + wingLift 26 : sur l'artwork les deux ailes balaient à
// ~65-70° — l'aile lointaine (base -26°) doit elle aussi MONTER, jamais couchée sur la croupe ;
// wingSpan ample),
// encolure arquée portée HAUTE tête entière dans le cadre (neckAngle court), crinière et
// queue fauves (@cheveux), COLLIER D'HARNAIS DORÉ clouté au poitrail (deco encolure, @accent*).
export const creature: CreatureDef = {
  name: 'Pégase',
  plan: 'winged',
  quad: {
    sl: 0.95, build: 'equine', girth: 0.98, bodyLen: 0.96, neckLen: 0.95, neckAngle: -28,
    legLen: 1.18, head: 'cheval', tail: 'crin', tailLen: 1.05, ears: 'courtes', foot: 'sabot',
    wings: 'plumes', wingSpan: 1.36, wingPose: 'dressees', wingLift: 26, mane: 'crin', markings: 'taches',
    deco: {
      // collier doré clouté à la base de l'encolure (repère local : base du cou = y 0..8)
      encolure: `<g data-deco="collier">` +
        `<path d="M-12.5 4.5 Q0 10.5 14 6 L13 0.5 Q0 5.5 -11.5 -0.5 Z" fill="@accent" stroke="@accentO" stroke-width="0.7"/>` +
        `<path d="M-11.8 1 Q0 7 13.2 2" fill="none" stroke="@accentH" stroke-width="0.6" opacity="0.7"/>` +
        `<circle cx="-8" cy="3.2" r="0.9" fill="#f2e3b2" stroke="@accentO" stroke-width="0.35"/>` +
        `<circle cx="-3" cy="5" r="0.9" fill="#f2e3b2" stroke="@accentO" stroke-width="0.35"/>` +
        `<circle cx="2" cy="5.8" r="0.9" fill="#f2e3b2" stroke="@accentO" stroke-width="0.35"/>` +
        `<circle cx="7" cy="4.9" r="0.9" fill="#f2e3b2" stroke="@accentO" stroke-width="0.35"/>` +
        `<circle cx="11.5" cy="3.2" r="0.9" fill="#f2e3b2" stroke="@accentO" stroke-width="0.35"/>` +
        `</g>`,
    },
    stored: {
      corps: '#e8eae4', corpsO: '#828b95', corpsH: '#ffffff', // robe blanc argenté pommelée, ombres gris-bleu
      cheveux: '#8d6e46', cheveuxO: '#4e3a22', // crinière/queue fauves
      aile: '#8a6a3e', aileO: '#48331c', aileH: '#c9a25e', // plumes brun/doré des ailes
      accent: '#c8963a', // or du collier
      cuir: '#4a4238', // sabots
    },
  },
};
