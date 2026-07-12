import type { CreatureDef } from '../types';

// Preyton (ZI folio 60) — réf art : art-ref/zi/page063_full.png. Bête TORSE en gargouille
// ACCROUPIE : grandes ailes de chauve-souris déchiquetées portées DRESSÉES à demi-ouvertes
// (membrane + wingPose 'dressees' — elles dominent la silhouette, comme sur la gravure),
// avant-corps massif redressé (girth↑, encolure relevée neckAngle -40) sur pattes basses
// (legLen↓ = tapi), arrière-train léonin griffu (build 'feline', foot 'patte') et antérieurs
// de cerf difforme (frontFoot 'sabot'). Queue de reptile écailleuse : l'os 'reptile' file
// derrière + `deco` tronc = la BOUCLE annelée qui s'enroule au sol sous la bête (l'enroulement
// de l'artwork — le bout de queue traînant seul sortait du cadre, cf. basilic/hydre).
// Gueule bâillante à rangées de crocs et œil fendu = tête 'dragon' (seule mâchoire béante du
// vocabulaire), ramures acérées NOIRCIES (headgear 'bois' @cheveux quasi noir) sur l'épaisse
// toison hirsute d'encolure. Robe charbon-terreux de la gravure, serres couleur corne.
export const creature: CreatureDef = {
  name: 'Preyton',
  plan: 'winged',
  quad: {
    sl: 1.1, build: 'feline', girth: 1.15, bodyLen: 0.92, neckLen: 0.7, neckAngle: -35, legLen: 0.78,
    head: 'dragon', headScale: 1.05, headgear: 'bois', ears: 'pointues',
    foot: 'patte', frontFoot: 'sabot', tail: 'reptile', tailLen: 1.0,
    wings: 'membrane', wingSpan: 1.5, wingPose: 'dressees', mane: 'hirsute', ridge: 'sans',
    deco: {
      tronc:
        `<g data-deco="queue-lovee" transform="translate(0,-8)">` +
        `<path d="M-30 46 Q-41 52 -36 60 Q-24 66 -2 65.5 Q22 65 34 59 Q43 54.5 46 46 Q40 51 32 54.5 Q19 60 -2 60.5 Q-23 61 -30 56 Q-33.5 51.5 -27 46.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
        `<path d="M-32 50 l4.6 3.4 M-27 56.6 l2.6 4.4 M-18 58.8 l1 4.6 M-8 60 l0.6 4.8 M2 60.4 l0 4.8 M12 59.6 l-0.6 4.6 M22 57.6 l-1.2 4.4 M31 54.4 l-1.8 4 M39 49.6 l-2.6 3.4" stroke="@corpsO" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>` +
        `<path d="M44 47 Q48 42 49 37 Q45.5 40 43 44 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
        `</g>`,
    },
    stored: { corps: '#3b332c', corpsO: '#171310', corpsH: '#6e6152', cheveux: '#1a1512', cheveuxO: '#0b0907', cuir: '#8a7a5e' },
  },
};
