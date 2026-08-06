import type { CreatureDef } from '../types';
import { CHEVAL_PROFIL_COMPILE } from '../../quadruped/chevalProfilCompile';

// Cheval — fidélité à l'artwork officiel (art-ref/ldb/page316_img7313.png) : robe GRIS POMMELÉ
// (corps gris clair, ombres gris-bleu, pommelures), crinière/queue GRIS ARGENTÉ fournies, et
// HARNACHEMENT complet de profil : selle verte matelassée, caparaçon rouge liseré d'or, croupière
// à panneaux olive et médaillons dorés, sangle, étrivière + étrier doré, bretelle de poitrail,
// bride à ferret et anneau de mors.
//
// LE PROFIL EST UN DESSIN, PAS UNE COMPOSITION (étalon #1082, vague P1b-MASSE) : la bête entière
// est tracée d'un trait dans le repère du monde (`quadruped/atelier/cheval-profil.dessin.mts`) puis
// compilée par os (`chevalProfilCompile.ts`) — silhouette, robe, crinière, queue, harnachement et
// modelé des 16 os y vivent ensemble. Le harnachement n'est donc plus un CALQUE posé sur l'os
// encolure : il est peint DANS l'os qu'il chevauche (croupière et caparaçon sur le tronc, bride sur
// la tête), au bon plan, sans contre-transform à maintenir.
// FACE et DOS restent au socle, comme chez l'étalon bovin : seule la vue de PROFIL porte un dessin
// entier, et ces deux vues n'ont AUCUN décor propre.
export const creature: CreatureDef = {
  label: "Cheval",
  id: "cheval",
  plan: 'quadruped',
  quad: {
    sl: 0.9, build: 'equine', girth: 1.04, bodyLen: 1.05, neckLen: 1.12, neckAngle: -50,
    legLen: 1.2, head: 'cheval', tail: 'crin', tailLen: 1.55, mane: 'crin', ears: 'courtes',
    foot: 'sabot', markings: 'taches',
    viewArt: { profile: CHEVAL_PROFIL_COMPILE },
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
