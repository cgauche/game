import type { CreatureDef } from '../types';

// Bœuf (EDOC 7 l.54, créature #611) — BÊTE DE TRAIT : masse basse et lourde portée sur des
// pattes-poteaux courtes, encolure COURTE et épaisse fondue dans un garrot bossu, tête large au
// mufle CARRÉ, fanon pendant, et surtout des CORNES en lyre largement écartées — l'identifiant
// n°1 à la vignette. Morphologie explicitement ≠ équine (ticket #630) : build 'ursine' (barillet
// profond, bosse d'épaule, arrière lourd) sur sabots, là où le Cheval est 'equine' haut sur
// pattes à longue encolure — les deux silhouettes se séparent à 40 px par la masse, le cou,
// la coiffe et la ligne de dos.
//
// CORNES : le gabarit expose bien un slot NATIF `headgear: 'cornes'` (quadParts.ts l.460-465),
// mais ses deux crochets montent DROIT au-dessus du crâne sur ~16 u d'envergure (±11) — c'est une
// corne de chèvre, pas la lyre bovine. Comme le Grand Cerf a écarté `headgear: 'bois'` au profit
// d'une ramure `deco.tete` (précédent du fichier voisin `GrandCerf.ts`), les cornes vivent ici en
// `deco.tete` PAR VUE : croissant balayé vers le dehors, envergure ~50 u (≈ 3,5× la largeur du
// crâne), à pointes sombres. `headgear` reste donc NON posé (les deux coiffes se superposeraient).
// Le canal `deco` est rendu dans le repère de l'art de l'os (`quadAnchor`) : ne reste ici que
// l'offset LOCAL — le `rotate(8)` du `<g>` de `headProfile` (quadParts l.528) pour la vue de
// profil, l'omettre décroche le mufle de son museau (mesuré à la ronde 1 : le mufle atterrissait
// en anneau sur la joue).
//
// VOLUME : les ombres se construisent au jeton QUASI NOIR `@corpsO` (#140c06) posé à l'OPACITÉ,
// jamais par une teinte dérivée claire — le recoloriage joueur (#632) redérive la famille depuis
// la base choisie et les creux survivent. Les surfaces éclairées sont de vraies PLAGES `@corpsH`
// qui SUIVENT le contour (ligne de dos, épaule, croupe, chanfrein, mufle), jamais des dalles à
// bord droit : sans surface éclairée un écart de luminance ne prouve rien (ancrage du contrat
// d'art #635), et une dalle rectangulaire lit « patch collé » (verdict de la ronde 1). Les
// hachures sont GROUPÉES et COURTES dans le sens du poil (épaule, flanc, cuisse), jamais semées.
const BL = 1.04; // = quad.bodyLen — les decos de tronc suivent le même étirement que barrel()/X()
const HS = 1.24; // = quad.headScale — tête LARGE de bovin (à 1,12 la face lisait « poney »)
const X = (n: number): string => (n * BL).toFixed(1);

// ── CORNES ────────────────────────────────────────────────────────────────────────────────────
// Repère de l'ART de tête (quadAnchor pose l'échelle de vue). Le crâne de face
// tient dans x ±7 / y -17..16 : le croissant part du SOMMET du crâne (±5,-14), balaie vers le
// dehors jusqu'à x ±21, puis la pointe se redresse — lyre bovine.
const CORNE_FACE = (sx: number): string => {
  const P = (n: number) => (n * sx).toFixed(1);
  return `<g>` +
    // fût du croissant (bord haut : base → coude → pointe ; bord bas : retour vers la base)
    `<path d="M${P(4)} -15.2 Q${P(13)} -20 ${P(20.6)} -18 Q${P(25.6)} -16.8 ${P(25.2)} -27 ` +
    `Q${P(23.2)} -18 ${P(19.6)} -14.2 Q${P(12.6)} -11.4 ${P(6.8)} -10.4 Z" fill="@corne" stroke="@corneO" stroke-width="0.5"/>` +
    // arête ÉCLAIRÉE sur le dessus du fût (le volume du cône se lit là)
    `<path d="M${P(5)} -14.6 Q${P(13.2)} -18.8 ${P(20.2)} -17 Q${P(24.2)} -16 ${P(24.4)} -22.8" fill="none" stroke="@corneH" stroke-width="1.5" opacity="0.9" stroke-linecap="round"/>` +
    // dessous CREUSÉ au jeton quasi noir à l'opacité (pas une teinte dérivée claire)
    `<path d="M${P(7.6)} -11.6 Q${P(13.2)} -12.4 ${P(19.2)} -15 Q${P(22.8)} -16.6 ${P(24.2)} -20.8" fill="none" stroke="@corneO" stroke-width="1.7" opacity="0.55" stroke-linecap="round"/>` +
    // pointe sombre (la corne noircit au bout)
    `<path d="M${P(25.2)} -27 Q${P(24)} -21.8 ${P(23.4)} -19.6 Q${P(25.2)} -20 ${P(25.8)} -22.8 Z" fill="@corneO" opacity="0.95"/>` +
    `</g>`;
};
const CORNES_FACE = `<g data-deco="cornes">${CORNE_FACE(-1)}${CORNE_FACE(1)}</g>`;

// Profil : la lyre est vue de bout — la corne PROCHE part du toupet, s'élève et balaie vers
// l'avant ; la LOINTAINE (dessinée d'abord, en teinte d'ombre) se décale derrière et plus bas.
const CORNE_PROFIL = (near: boolean): string => {
  const c = near ? '@corne' : '@corneO', dx = near ? 0 : -3.4, dy = near ? 0 : 2.8;
  return `<g transform="translate(${dx} ${dy})" opacity="${near ? 1 : 0.9}">` +
    `<path d="M-5.4 -6.8 Q-4.4 -15.4 0.8 -19.8 Q5.4 -23.4 8.8 -23 Q6.2 -19.6 2.6 -16 Q-0.8 -12.4 -0.6 -5.4 Z" fill="${c}" stroke="@corneO" stroke-width="0.5"/>` +
    (near
      ? `<path d="M-4.6 -8 Q-3.6 -15 1.2 -18.8 Q4.8 -21.8 7.6 -22.2" fill="none" stroke="@corneH" stroke-width="1.4" opacity="0.9" stroke-linecap="round"/>` +
        `<path d="M-1 -6.2 Q-0.4 -12.4 3 -15.8 Q5.8 -18.6 8.4 -21.4" fill="none" stroke="@corneO" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M8.8 -23 Q6.6 -21.6 4.8 -20 Q6.4 -18.8 8 -19.2 Q9.2 -20.8 8.8 -23 Z" fill="@corneO" opacity="0.95"/>`
      : '') +
    `</g>`;
};
// Mufle CARRÉ (le tell bovin après les cornes) : plaque large à narine ouverte, cerclée d'un
// bourrelet de poil clair — repeint PAR-DESSUS le museau fin du gabarit 'cheval' (x 10..19).
const MUFLE_PROFIL =
  `<g data-deco="mufle">` +
  // Plaque du mufle : MOUILLÉE (plus sombre que la robe), et non un anneau pâle épais — à la
  // ronde 2 le bourrelet clair trop large + son cœur presque noir lisaient « gueule béante ».
  // Le museau du gabarit 'cheval' est un aplat `@corpsO` (quadParts l.528) : avec un jeton d'ombre
  // QUASI NOIR il vire au TROU NOIR. La plaque se repose donc d'abord en teinte de BASE (elle
  // recouvre l'aplat), puis reçoit son modelé — jamais un simple voile d'ombre par-dessus du noir.
  `<path d="M10.4 9.2 Q18.2 10 20.6 15.4 Q21.2 21.2 15.6 22.4 Q10.8 21.8 10 16.6 Q9.6 12 10.4 9.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
  `<path d="M11.4 13.6 Q17.2 14.6 20.2 18 Q20.6 21.4 15.6 22.4 Q11.2 21.6 10.6 17.8 Z" fill="@corpsO" opacity="0.42"/>` + // dessous du mufle
  `<path d="M11 9.6 Q17.4 10.6 19.8 14.6" fill="none" stroke="@corpsH" stroke-width="1.5" opacity="0.7" stroke-linecap="round"/>` + // bourrelet clair du DESSUS seulement
  `<path d="M15.8 12.8 Q18.6 13.8 18.8 16.6 Q16.8 15.8 15.2 15 Z" fill="#0b0603"/>` + // narine ouverte
  `<path d="M12 18.6 Q15.6 20.2 18.8 19" fill="none" stroke="#0b0603" stroke-width="0.9" opacity="0.9" stroke-linecap="round"/>` + // fente de bouche
  `<path d="M2.4 -3.6 Q7.4 1.6 11.4 8.4" fill="none" stroke="@corpsH" stroke-width="2" opacity="0.5" stroke-linecap="round"/>` + // chanfrein éclairé
  `<path d="M-6.6 -4.6 Q-2.6 -7.4 1.6 -4.4" fill="none" stroke="@corpsO" stroke-width="1.4" opacity="0.5"/>` + // arcade lourde
  `</g>`;
const CORNES_PROFIL =
  `<g data-deco="cornes" transform="rotate(8)">` +
  `${CORNE_PROFIL(false)}${CORNE_PROFIL(true)}${MUFLE_PROFIL}</g>`;

// Face : mufle carré frontal (plaque pâle + narines en virgule) sous le chanfrein éclairé.
const MUFLE_FACE =
  `<g data-deco="mufle">` +
  `<path d="M-7 7 Q0 5.4 7 7 Q8 13.4 5.8 16.8 Q0 19.2 -5.8 16.8 Q-8 13.4 -7 7 Z" fill="@corpsH" opacity="0.9" stroke="@corpsO" stroke-width="0.5"/>` +
  `<path d="M-5.2 8.8 Q0 7.6 5.2 8.8 Q6 13.2 4.2 15.6 Q0 17.4 -4.2 15.6 Q-6 13.2 -5.2 8.8 Z" fill="@corpsO" opacity="0.82"/>` +
  `<path d="M-4 10.2 Q-2.2 9.6 -1.4 11.2 Q-2.4 12.4 -4 12.2 Z M4 10.2 Q2.2 9.6 1.4 11.2 Q2.4 12.4 4 12.2 Z" fill="#0b0603"/>` +
  `<path d="M-3.6 15.2 Q0 16.4 3.6 15.2" fill="none" stroke="#0b0603" stroke-width="0.8" opacity="0.85" stroke-linecap="round"/>` +
  `<path d="M-2.8 -9 Q0 -10.4 2.8 -9 Q3.2 -1 2.2 6.2 Q0 7.2 -2.2 6.2 Q-3.2 -1 -2.8 -9 Z" fill="@corpsH" opacity="0.55"/>` + // chanfrein éclairé
  `<path d="M-7.4 -6.8 Q-4.6 -8.6 -2.2 -6.6 M7.4 -6.8 Q4.6 -8.6 2.2 -6.6" fill="none" stroke="@corpsO" stroke-width="1.2" opacity="0.7"/>` + // arcades lourdes
  `<path d="M-9.4 -1 Q-11 4 -8.6 8 M9.4 -1 Q11 4 8.6 8" fill="none" stroke="@corpsO" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>` + // joues creusées
  `</g>`;

// ── FANON (encolure, PROFIL) ──────────────────────────────────────────────────────────────────
// L = 30 × neckLen = 12.6 : encolure COURTE. Le fanon pend de la gorge au poitrail en festons
// larges — le tell bovin de profil. L'os encolure n'a d'art qu'en profil : les vues de bout
// retombent proprement sur le nu (le fanon de face vit dans le deco de tronc).
const FANON =
  `<g data-deco="fanon">` +
  `<path d="M8.8 -12.4 Q13.6 -9.6 14.2 -4 Q17.8 -1.4 16.6 2.2 Q20.2 4.6 18.4 8.4 Q21 11.4 18.6 15.2 Q13.6 19.4 8 16.6 Q7.2 3.4 8 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
  `<path d="M10.4 -9.6 Q11.2 2.4 11.6 13.8" fill="none" stroke="@corpsO" stroke-width="1.6" opacity="0.5"/>` + // creux du pli
  `<path d="M13.6 -6.6 Q15.4 2.4 16 11.4" fill="none" stroke="@corpsH" stroke-width="2" opacity="0.65" stroke-linecap="round"/>` + // arête éclairée du fanon
  `<path d="M-9.8 -11.4 Q-11.6 -4 -11.2 3.4" fill="none" stroke="@corpsH" stroke-width="2.8" opacity="0.55" stroke-linecap="round"/>` + // crête d'encolure éclairée
  `<path d="M-5.6 -8.4 q1.8 2.2 1.6 5 M-2.8 -9.6 q1.8 2.4 1.6 5.2 M0 -10 q1.6 2.2 1.4 4.8" fill="none" stroke="@corpsO" stroke-width="0.8" opacity="0.32" stroke-linecap="round"/>` + // hachures groupées (sens du poil)
  `</g>`;

// ── TRONC ─────────────────────────────────────────────────────────────────────────────────────
// PROFIL : la lumière suit le CONTOUR du dos (garrot bossu → croupe) en bande feutrée (deux
// passes d'opacité, jamais une dalle à bord droit) ; le dessous du barillet et l'aine sont
// creusés au jeton quasi noir ; hanche et épaule prennent un bombé ELLIPTIQUE (une pointe de
// hanche en triangle plein lisait « épaulette collée » à la ronde 1).
const TRONC_PROFIL =
  `<g data-deco="dos">` +
  // Bande de LUMIÈRE le long du dos, calquée sur le bord supérieur de barrel() 'ursine'. Les deux
  // bouts se REJOIGNENT en pointe (lentille) : à la ronde 2 la bande était refermée par un
  // segment DROIT en plein flanc → elle lisait « planche clouée sur le dos ».
  `<path d="M${X(-40)} -9.2 Q${X(-26)} -17.2 ${X(-8)} -21.2 Q${X(4)} -25.2 ${X(15)} -21.8 Q${X(23)} -18.6 ${X(27.6)} -11.4 ` +
  `Q${X(22)} -15.4 ${X(13)} -18.2 Q${X(2)} -21 ${X(-9)} -16.8 Q${X(-25)} -12.6 ${X(-40)} -9.2 Z" fill="@corpsH" opacity="0.8"/>` +
  // seconde passe FEUTRÉE juste dessous (fond la bande dans la robe, pas d'arête franche)
  `<path d="M${X(-38)} -6.2 Q${X(-25)} -13.4 ${X(-9)} -17.4 Q${X(2)} -21.2 ${X(13)} -18 Q${X(20)} -15 ${X(25.6)} -8.6 ` +
  `Q${X(19)} -12.6 ${X(11)} -14.8 Q${X(1)} -17.4 ${X(-9)} -13.6 Q${X(-24)} -9.8 ${X(-38)} -6.2 Z" fill="@corpsH" opacity="0.3"/>` +
  // dessous du barillet CREUSÉ (@corpsO quasi noir à l'opacité) — croissant à pointes fondues,
  // calqué sur le bord inférieur (les ellipses-disques de la ronde 2 lisaient « rondelles »)
  `<path d="M${X(23)} 6.4 Q${X(3)} 16.6 ${X(-16)} 14.4 Q${X(-30)} 15 ${X(-37.6)} 8.6 ` +
  `Q${X(-28)} 11 ${X(-15)} 10.4 Q${X(3)} 12.8 ${X(23)} 6.4 Z" fill="@corpsO" opacity="0.62"/>` +
  // bombés ÉCLAIRÉS d'épaule et de cuisse (≥ 0,5 d'opacité : de vraies surfaces de lumière, pas
  // des voiles — sous 0,5 le mélange ne franchit pas le seuil clair de la palette)
  `<path d="M${X(14)} -19.6 Q${X(23)} -16.4 ${X(27)} -9.6 Q${X(26)} -1.4 ${X(21)} 3.6 Q${X(21.4)} -5.4 ${X(17)} -11.4 Q${X(14.6)} -15.4 ${X(14)} -19.6 Z" fill="@corpsH" opacity="0.55"/>` +
  `<path d="M${X(-34)} -13.6 Q${X(-25)} -14.6 ${X(-21)} -8.6 Q${X(-20)} 0 ${X(-24)} 6.4 Q${X(-24.6)} -1.6 ${X(-28)} -6.6 Q${X(-31)} -10.6 ${X(-34)} -13.6 Z" fill="@corpsH" opacity="0.55"/>` +
  `<path d="M${X(20)} 9.4 Q${X(2)} 16.4 ${X(-18)} 13.6 Q${X(-28)} 13.6 ${X(-34)} 9.4 Q${X(-26)} 11.6 ${X(-16)} 11.6 Q${X(1)} 14 ${X(20)} 9.4 Z" fill="@corpsO" opacity="0.32"/>` +
  `<path d="M${X(-20)} 2 Q${X(-17.6)} 8.4 ${X(-19.4)} 13.4" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.45" stroke-linecap="round"/>` + // pli de l'aine
  `<path d="M${X(26)} -6 Q${X(28.4)} 0 ${X(26.6)} 7.4" fill="none" stroke="@corpsO" stroke-width="1.2" opacity="0.4" stroke-linecap="round"/>` + // bord de poitrail
  // hachures GROUPÉES et COURTES dans le sens du poil : épaule, flanc, cuisse
  `<path d="M${X(17)} -13.6 q1.6 3.4 1.2 6.4 M${X(20)} -11.6 q1.6 3.4 1.2 6.4 M${X(22.8)} -9 q1.4 3.2 1 6" fill="none" stroke="@corpsO" stroke-width="0.85" opacity="0.34" stroke-linecap="round"/>` +
  `<path d="M${X(0)} -12 q0.8 3.2 0.4 6 M${X(4)} -13 q0.8 3.2 0.4 6 M${X(8)} -13.4 q0.8 3.2 0.4 6" fill="none" stroke="@corpsO" stroke-width="0.8" opacity="0.22" stroke-linecap="round"/>` +
  `<path d="M${X(-31)} -7.6 q-1.4 3.4 -1.2 6.4 M${X(-27.5)} -9.4 q-1.4 3.4 -1.2 6.6 M${X(-24)} -10.4 q-1.2 3.2 -1 6.2" fill="none" stroke="@corpsO" stroke-width="0.85" opacity="0.28" stroke-linecap="round"/>` +
  `</g>`;

// FACE : le poitrail du gabarit (demi-largeur 17 pour une tête 'cheval') est trop ÉTROIT pour une
// bête de trait — la masse est ÉLARGIE ici en une épaule pleine (±22) refermée sur le bréchet,
// puis remodelée : sternum éclairé, flancs enroulés dans l'ombre profonde, FANON pendant sous la
// gorge (le tell bovin de face). Le poitrail élargi REPEINT celui du gabarit, il ne s'y ajoute pas.
const TRONC_FACE =
  `<g data-deco="poitrail">` +
  `<path d="M-22 -6 Q-23.4 -22 -10.4 -28.6 Q0 -31 10.4 -28.6 Q23.4 -22 22 -6 Q21 10.4 11 19 Q0 24.6 -11 19 Q-21 10.4 -22 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
  // flancs enroulés en arrière (rondeur du barillet) — le droit plus creusé (loin de la lumière)
  `<path d="M-22 -6 Q-23.4 -22 -10.4 -28.6 L-11.4 -23 Q-18.4 -18 -19.4 -6 Q-19.4 8 -12.6 17.4 L-11 19 Q-21 10.4 -22 -6 Z" fill="@corpsO" opacity="0.62"/>` +
  `<path d="M22 -6 Q23.4 -22 10.4 -28.6 L11.4 -23 Q18.4 -18 19.4 -6 Q19.4 8 12.6 17.4 L11 19 Q21 10.4 22 -6 Z" fill="@corpsO" opacity="0.8"/>` +
  // ligne d'épaule ÉCLAIRÉE, calquée sur le haut du poitrail élargi
  `<path d="M-13.6 -25.4 Q-6.4 -29.6 0 -30.2 Q6.4 -29.6 13.6 -25.4 L12 -21.4 Q6 -25.4 0 -26 Q-6 -25.4 -12 -21.4 Z" fill="@corpsH" opacity="0.78"/>` +
  // sternum bombé (surface éclairée franche, pas un filet)
  `<ellipse cx="-1.4" cy="-6" rx="8.4" ry="15.6" fill="@corpsH" opacity="0.42"/>` +
  // FANON : pend sous la gorge (la tête couvre le poitrail jusqu'à y≈-7). LARGE et COURT, à
  // festons ronds — à la ronde 2 il était étroit, long et à pointes : il lisait « barbe/gland »
  // pendu au menton, pas un pli de peau de bœuf.
  `<path d="M-13 -11.6 Q0 -14.6 13 -11.6 Q14.2 -3 12.4 4.6 Q12.8 9.4 9 12.4 Q4.6 14.6 0 14.8 Q-4.6 14.6 -9 12.4 Q-12.8 9.4 -12.4 4.6 Q-14.2 -3 -13 -11.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
  `<path d="M-7.4 -11.4 Q0 -13.4 7.4 -11.4 Q8.4 -3 7 4.4 Q7.2 8.4 4.4 10.6 Q0 12.2 -4.4 10.6 Q-7.2 8.4 -7 4.4 Q-8.4 -3 -7.4 -11.4 Z" fill="@corpsH" opacity="0.6"/>` +
  `<path d="M-10.4 -10.4 Q-11.4 0 -9.6 9 M10.4 -10.4 Q11.4 0 9.6 9" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.5"/>` +
  `<path d="M-8.6 12 Q-4.4 14.4 0 14.8 Q4.4 14.4 8.6 12" fill="none" stroke="@corpsO" stroke-width="1" opacity="0.45"/>` + // ourlet bas du pli
  // hachures groupées (poil du poitrail qui descend vers le bréchet)
  `<path d="M-16.4 -14 q-0.8 3.6 -0.4 6.8 M-17 -6.6 q-0.6 3.6 -0.2 6.8 M15.4 -14 q0.8 3.6 0.4 6.8" fill="none" stroke="@corpsO" stroke-width="0.85" opacity="0.3" stroke-linecap="round"/>` +
  `</g>`;

// DOS : croupe LARGE (±26 comme l'ursidé, contre 22 par défaut avec une tête 'cheval'), dessus
// éclairé qui suit le dôme, hanches en bombés ELLIPTIQUES (les triangles pleins de la ronde 1
// lisaient « épaulettes »), sillon creusé et dessous de croupe dans l'ombre profonde.
const TRONC_DOS =
  `<g data-deco="croupe">` +
  `<path d="M-26 -4 Q-27.2 -18 -12 -22.4 Q0 -24.6 12 -22.4 Q27.2 -18 26 -4 Q26 12.6 13 23 Q0 27.4 -13 23 Q-26 12.6 -26 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
  // Dessus de croupe éclairé : ARC qui suit le dôme et se referme en pointes sur les hanches
  // (à la ronde 2 ses bouts coupés droit lisaient « épaulettes » posées sur les angles).
  `<path d="M-21.6 -8.6 Q-19.4 -19.4 0 -23.4 Q19.4 -19.4 21.6 -8.6 Q17.4 -16.4 0 -19.4 Q-17.4 -16.4 -21.6 -8.6 Z" fill="@corpsH" opacity="0.82"/>` +
  `<path d="M-20.4 -4.4 Q-17.6 -15.4 0 -19 Q17.6 -15.4 20.4 -4.4 Q15.6 -12.4 0 -15 Q-15.6 -12.4 -20.4 -4.4 Z" fill="@corpsH" opacity="0.34"/>` +
  // hanches bombées (ellipses) — la gauche plus éclairée
  `<ellipse cx="-13.4" cy="-1" rx="10.4" ry="15.6" fill="@corpsH" opacity="0.58"/>` +
  `<ellipse cx="13.4" cy="-1" rx="10.4" ry="15.6" fill="@corpsH" opacity="0.34"/>` +
  // sillon central creusé + flancs enroulés + dessous de croupe
  `<path d="M0 -20 Q2.2 0 0 22 Q-2.2 0 0 -20 Z" fill="@corpsO" opacity="0.45"/>` +
  `<path d="M0 -19 Q1.5 1 0 21" fill="none" stroke="@corpsO" stroke-width="1.2" opacity="0.6"/>` +
  `<path d="M-26 -4 Q-26 12.6 -13 23 L-14.6 19.4 Q-23.4 10.4 -23.6 -3 Z" fill="@corpsO" opacity="0.5"/>` +
  `<path d="M26 -4 Q26 12.6 13 23 L14.6 19.4 Q23.4 10.4 23.6 -3 Z" fill="@corpsO" opacity="0.7"/>` +
  `<ellipse cx="0" cy="21.4" rx="16.4" ry="5.6" fill="@corpsO" opacity="0.45"/>` +
  `<path d="M-17 -7 q-1.2 4.4 -0.8 8.4 M-11.6 -5 q-0.8 4.6 -0.4 8.6 M11.6 -5 q0.8 4.6 0.4 8.6 M17 -7 q1.2 4.4 0.8 8.4" fill="none" stroke="@corpsO" stroke-width="0.85" opacity="0.3" stroke-linecap="round"/>` +
  `</g>`;

export const creature: CreatureDef = {
  label: 'Bœuf',
  id: 'boeuf',
  plan: 'quadruped',
  quad: {
    sl: 1.06,
    build: 'ursine', // masse profonde + bosse d'épaule + arrière lourd — la silhouette NON équine
    girth: 1.2, bodyLen: BL, neckLen: 0.42, neckAngle: -8, legLen: 0.84,
    head: 'cheval', headScale: HS, tail: 'touffe-basse', tailLen: 1.05, mane: 'sans',
    ears: 'courtes', foot: 'sabot',
    deco: {
      // DE FACE, deux fragments de plans OPPOSÉS sur le même os : les cornes naissent au sommet du
      // crâne et balaient en arrière-plan, le mufle est la partie la plus proche de l'œil.
      'tete#front': [{ svg: CORNES_FACE, plan: -0.25 }, { svg: MUFLE_FACE, plan: 0.25 }],
      // DE DOS, la lyre part du front, à l'OPPOSÉ de l'œil : elle passe DERRIÈRE le crâne, seules
      // les pointes qui débordent de la calotte restent visibles (plan relatif négatif).
      'tete#back': [{ svg: CORNES_FACE, plan: -0.25 }],
      'tete#profile': CORNES_PROFIL,
      encolure: FANON,
      'tronc#profile': TRONC_PROFIL,
      'tronc#front': TRONC_FACE,
      'tronc#back': TRONC_DOS,
    },
    stored: {
      corps: '#6b4526', corpsO: '#140c06', corpsH: '#c99a5c', // robe brune, ombre QUASI NOIRE, lumière franche
      cheveux: '#33210f', cheveuxO: '#0f0904', // touffe de queue sombre
      cuir: '#241a12', // sabots
      corne: '#cfc0a0', corneO: '#2a2013', corneH: '#efe6cd', // corne crème à pointe sombre
    },
  },
};
