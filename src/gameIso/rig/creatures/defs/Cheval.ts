import type { CreatureDef } from '../types';

// Cheval — fidélité à l'artwork officiel (art-ref/ldb/page316_img7313.png) : robe GRIS POMMELÉ
// (corps gris clair, ombres gris-bleu, taches + mouchetures claires), crinière/queue GRIS ARGENTÉ
// fournies et bouclées (@cheveux + surcouche de mèches en deco), et HARNACHEMENT complet de
// profil : selle verte matelassée à troussequin/pommeau, caparaçon rouge liseré d'or, sangle,
// étrivière + étrier doré, croupière à panneaux olive et médaillons dorés, bretelle de poitrail,
// bride décorée avec mors et rêne (deco tete). Le harnais vit sur l'os encolure (contre-transform
// vers le repère du tronc : pivot 28·bl,-12, angle 50°) — l'encolure n'ayant d'art qu'en PROFIL,
// les vues face/dos retombent proprement sur le cheval nu.
const TACK =
  // --- crinière ARGENTÉE bouclée, plus fournie (repère local de l'encolure, L = 33.6) ---
  `<g data-deco="criniere">` +
  `<path d="M-3 -36 Q-12 -34 -15 -28 q-4 2.4 -3 6.4 q-4 2 -2.6 6 q-4 2.4 -2.4 6.4 q-3.6 2.6 -1.8 6.6 Q-13.5 3.5 -9 6 L-6.5 5 Q-9 -4 -8.5 -14 Q-8 -25 -1.5 -34.5 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.55"/>` +
  `<path d="M-13.5 -25 q-2.4 5 -1.4 9.6 M-12.6 -14 q-2.2 4.8 -1 9.2 M-11.6 -4 q-2 4.4 -0.8 8.4" fill="none" stroke="@cheveuxO" stroke-width="0.7" opacity="0.7"/>` +
  `<path d="M-9.5 -28 q-1.8 4 -1 8 M-8.8 -17 q-1.6 4 -0.8 7.6" fill="none" stroke="@cheveuxH" stroke-width="0.6" opacity="0.7"/>` +
  `</g>` +
  // --- harnachement, dessiné dans le repère du TRONC (inverse du transform de l'os encolure) ---
  `<g data-deco="harnais" transform="rotate(-50) translate(-29.4 12)">` +
  // pommelures claires (croupe + épaule) sous le harnais
  `<g fill="@corpsH" opacity="0.45"><circle cx="-28" cy="-8" r="0.9"/><circle cx="-24" cy="-4" r="0.9"/><circle cx="-31" cy="-2" r="0.9"/><circle cx="-26" cy="2" r="0.9"/><circle cx="-21" cy="-9" r="0.9"/><circle cx="-34" cy="-7" r="0.9"/><circle cx="22" cy="-2" r="0.9"/><circle cx="26" cy="2" r="0.9"/><circle cx="19" cy="4" r="0.9"/><circle cx="25" cy="-6" r="0.9"/><circle cx="29" cy="-1" r="0.9"/></g>` +
  // croupière : bande sur le rein + 3 panneaux olive pendants à médaillons dorés (signature de l'artwork)
  `<path d="M-13 -18 Q-26 -18.5 -38 -14 L-38 -11.4 Q-26 -15.8 -13 -15.4 Z" fill="@sangle" stroke="@sangleO" stroke-width="0.5"/>` +
  `<path d="M-14.5 -16 L-19.5 -16.2 L-20 2 Q-17 3.8 -14 2 Z" fill="@sangle" stroke="@sangleO" stroke-width="0.6"/>` +
  `<path d="M-22.5 -15.8 L-27.5 -15.4 L-28 1 Q-25 2.8 -22 1 Z" fill="@sangle" stroke="@sangleO" stroke-width="0.6"/>` +
  `<path d="M-30.5 -15 L-35.5 -13.8 L-36 -1 Q-33 0.6 -30 -1 Z" fill="@sangle" stroke="@sangleO" stroke-width="0.6"/>` +
  `<path d="M-13.5 -7 L-37 -5 L-37 -2.6 L-13.5 -4.6 Z" fill="@cuir" opacity="0.9"/>` +
  `<g><circle cx="-17" cy="-5" r="2" fill="@accent" stroke="@accentO" stroke-width="0.5"/><circle cx="-17" cy="-5" r="0.8" fill="@accentO"/><circle cx="-25" cy="-4.2" r="2" fill="@accent" stroke="@accentO" stroke-width="0.5"/><circle cx="-25" cy="-4.2" r="0.8" fill="@accentO"/><circle cx="-33" cy="-3.4" r="2" fill="@accent" stroke="@accentO" stroke-width="0.5"/><circle cx="-33" cy="-3.4" r="0.8" fill="@accentO"/></g>` +
  // caparaçon rouge liseré d'or sous la selle, plis + emblème
  `<path d="M-6 -15 L14.5 -15 L15.5 8 Q14 10.5 11 11 L-4 12.5 Q-6.5 11 -6.8 8 Z" fill="@drap" stroke="@drapO" stroke-width="0.7"/>` +
  `<path d="M-4.8 10.8 L13.6 9.4 M14.2 -13.2 L14.9 7.6" fill="none" stroke="@accent" stroke-width="0.9" opacity="0.9"/>` +
  `<path d="M-1 -12 L-1.6 10.6 M9 -12 L9.4 9.8" fill="none" stroke="@drapO" stroke-width="0.8" opacity="0.5"/>` +
  `<circle cx="4" cy="3" r="1.6" fill="@accent" stroke="@accentO" stroke-width="0.4"/><path d="M4 0.2 L4 5.8 M1.2 3 L6.8 3" stroke="@accent" stroke-width="0.7"/>` +
  // sangle de ventre + bretelle de poitrail cloutée
  `<path d="M10.5 10.8 L14 10.4 L14.8 21.6 L11.6 22 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.4"/>` +
  `<path d="M14.5 -12 Q24 -8 31.5 -1.5 L30.5 1 Q23 -5 14 -9.5 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.4"/>` +
  `<circle cx="24" cy="-4.5" r="1.4" fill="@accent" stroke="@accentO" stroke-width="0.4"/>` +
  // quartier de selle + étrivière + étrier doré
  `<path d="M-2 -17.5 L12.5 -17.5 Q13.5 -12 11.5 -7 Q6 -5.5 1 -7 Q-1.5 -13 -2 -17.5 Z" fill="@drapO" stroke="#3a1a10" stroke-width="0.5"/>` +
  `<path d="M5.5 -8 L7.2 -8 L7.6 0.5 L5.9 0.5 Z" fill="@cuir"/>` +
  `<path d="M4.6 0.5 Q4.2 5.5 6.6 6.4 Q9 5.5 8.6 0.5 L7.4 0.5 Q7.6 4 6.6 4.6 Q5.6 4 5.9 0.5 Z" fill="@accent" stroke="@accentO" stroke-width="0.4"/>` +
  // selle matelassée VERTE : troussequin arrière + pommeau avant, capitonnage, liseré doré
  `<path d="M-3.5 -18 Q-5 -24 -2 -27.5 Q0 -29 1.5 -27 Q2.5 -24.5 5 -24 Q8 -24.2 9.5 -26.5 Q11 -28.5 13 -26.5 Q15 -23.5 14 -18.5 Q5 -22 -3.5 -18 Z" fill="@sangle" stroke="@sangleO" stroke-width="0.7"/>` +
  `<path d="M-2.5 -25.5 L12.5 -21.5 M-2.8 -22 L13 -24 M1 -26.8 L11 -19.6 M11.5 -27 L0 -19.4" fill="none" stroke="@sangleO" stroke-width="0.5" opacity="0.6"/>` +
  `<path d="M-2 -27.5 Q0 -29 1.5 -27 M9.5 -26.5 Q11 -28.5 13 -26.5" fill="none" stroke="@accent" stroke-width="0.8"/>` +
  `</g>`;

// Bride décorée (repère de la tête de PROFIL : même scale 1.3 + rotate 8 que l'art du gabarit) :
// têtière/montant le long de la joue, frontal à ferret doré, muserolle, anneau de mors + rêne.
const BRIDLE = `<g data-deco="bride" transform="scale(1.3) rotate(8)">` +
  `<path d="M12.5 21 Q4 19 -4 14.5 Q-7 12.5 -9 10" fill="none" stroke="@cuir" stroke-width="1.2" opacity="0.95"/>` +
  `<path d="M-2.5 -4 Q2 0 6 5.5 Q8.5 8.8 10.6 12.6" fill="none" stroke="@cuir" stroke-width="1.7"/>` +
  `<path d="M-4.5 -5.5 Q-1 -7.5 2.5 -6" fill="none" stroke="@cuir" stroke-width="1.4"/>` +
  `<circle cx="-1" cy="-6.7" r="0.7" fill="@accent"/>` +
  `<path d="M6 3 Q11 6.5 14.5 12" fill="none" stroke="@cuir" stroke-width="1.5"/>` +
  `<circle cx="3" cy="1.5" r="0.6" fill="@accent"/><circle cx="7" cy="7" r="0.6" fill="@accent"/>` +
  `<circle cx="12.5" cy="19.5" r="2.1" fill="none" stroke="@accent" stroke-width="0.9"/>` +
  `</g>`;

export const creature: CreatureDef = {
  label: "Cheval",
  plan: 'quadruped',
  quad: {
    sl: 0.9, build: 'equine', girth: 1.04, bodyLen: 1.05, neckLen: 1.12, neckAngle: -50,
    legLen: 1.2, head: 'cheval', tail: 'crin', tailLen: 1.55, mane: 'crin', ears: 'courtes',
    foot: 'sabot', markings: 'taches',
    deco: { encolure: TACK, tete: BRIDLE },
    stored: {
      corps: '#c6cac5', corpsO: '#7b838c', corpsH: '#f1f2ef', // gris pommelé, ombres gris-bleu
      cheveux: '#878d93', cheveuxO: '#43484e', // crinière/queue gris argenté
      cuir: '#3c322a', // sabots + cuirs de bride/sangle
      drap: '#7e3424', // caparaçon rouge
      sangle: '#6f6d33', // selle matelassée + panneaux de croupière olive
      accent: '#c1953e', // or des médaillons, liserés, mors, étrier
    },
  },
};
