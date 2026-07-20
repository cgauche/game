import type { CreatureDef } from '../types';
import { lateralPair } from '../../parts/parallax';
import { feat } from '../../parts/elements';
import { GRIFFES_ART } from '../../parts/elements/defs/griffes';

// Slenderthigh Whiptongue — PRINCE DÉMON DE SLAANESH (creatures.json : LDB 84 p.336 ; traits
// Cornes +15, Taille (Grande), Terreur 3, Perturbant). Calé sur l'ILLUSTRATION LDB 85 p.338 :
// HUMANOÏDE massif et musclé (→ plan biped, comme ses frères démons Sanguinaire/Démonette,
// PAS le jabberslythe insectoïde — aucune aile dans l'art) ; peau crème pâle ; crâne haut et
// conique cerclé d'une COURONNE de cornes rouges annelées ; bras gauche fini en énorme PINCE
// de crabe rouge sombre ; main droite griffue ; jambes digitigrades fines à sabots
// (« Slenderthigh ») aux tibias plaqués de rouge ; LANGUE-FOUET grise démesurée terminée
// par un fléau à pointes (« Whiptongue ») ; pagne sombre ceinturé. L'épée courbe de
// l'illustration = ÉQUIPEMENT de scène (trait Arme +16), comme la Lame des Enfers du
// Sanguinaire — jamais dessinée dans le rig.
const HORN = { fill: '#a13440', stroke: '#571219' };
// Couronne de cornes annelées (vue de face/dos) : 2 cornes par côté, évasées puis recourbées.
const OV_CORNES_FRONT =
  `<path d="M4.6 -1 Q13.5 -2.5 15.8 5 Q17 10.5 12.4 13.4 Q15 8.6 12.6 3.8 Q10.6 0.2 3.8 1.6 Z" fill="${HORN.fill}" stroke="${HORN.stroke}" stroke-width="0.5"/>`
  + `<path d="M-4.6 -1 Q-13.5 -2.5 -15.8 5 Q-17 10.5 -12.4 13.4 Q-15 8.6 -12.6 3.8 Q-10.6 0.2 -3.8 1.6 Z" fill="${HORN.fill}" stroke="${HORN.stroke}" stroke-width="0.5"/>`
  + `<path d="M3.4 -7.6 Q10.2 -11.5 11 -18.6 Q11.3 -23 8.2 -25.2 Q10 -20 8.2 -15 Q6.4 -10.6 2 -8.8 Z" fill="${HORN.fill}" stroke="${HORN.stroke}" stroke-width="0.5"/>`
  + `<path d="M-3.4 -7.6 Q-10.2 -11.5 -11 -18.6 Q-11.3 -23 -8.2 -25.2 Q-10 -20 -8.2 -15 Q-6.4 -10.6 -2 -8.8 Z" fill="${HORN.fill}" stroke="${HORN.stroke}" stroke-width="0.5"/>`
  // anneaux (cornes annelées de l'illustration)
  + `<path d="M13.2 1.6 q2.2 1.2 3 3.2 M14.6 7.4 q1.4 1 1.2 2.8 M-13.2 1.6 q-2.2 1.2 -3 3.2 M-14.6 7.4 q-1.4 1 -1.2 2.8" stroke="${HORN.stroke}" stroke-width="0.55" fill="none" opacity="0.8"/>`
  + `<path d="M8.8 -12.4 q1.8 -1.4 2.1 -3.4 M-8.8 -12.4 q-1.8 -1.4 -2.1 -3.4" stroke="${HORN.stroke}" stroke-width="0.55" fill="none" opacity="0.8"/>`;
// Profil : cornes balayées haut-arrière (exemplaire proche + lointain).
const OV_CORNES_PROFILE = lateralPair(
  `<path d="M3.5 -7 Q-4.5 -10 -8.5 -16.5 Q-11 -21.5 -8.6 -25 Q-9.4 -19.5 -6 -14.5 Q-2.6 -10 4.4 -8.6 Z" fill="${HORN.fill}" stroke="${HORN.stroke}" stroke-width="0.5"/>`
  + `<path d="M4.5 -1.5 Q-3 -1 -7.5 4 Q-10.5 7.8 -9 12 Q-8.6 7 -4.6 3.8 Q-1 1.2 5 0.4 Z" fill="${HORN.fill}" stroke="${HORN.stroke}" stroke-width="0.5"/>`
  + `<path d="M-7.4 -16 q-1.6 -1.4 -2 -3.2 M-7.8 6 q-1.4 1.2 -1.6 3" stroke="${HORN.stroke}" stroke-width="0.55" fill="none" opacity="0.8"/>`,
  { dx: 4 },
);
// Crâne HAUT et conique, pâle, clouté sur l'avant (sommet caractéristique de l'illustration).
const OV_CRANE_FRONT =
  `<path d="M-5.4 -7 Q-2.6 -12 0 -25 Q2.6 -12 5.4 -7 Q0 -9.6 -5.4 -7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
  + `<circle cx="0" cy="-20" r="0.8" fill="@peauO"/><circle cx="0" cy="-16.5" r="0.9" fill="@peauO"/><circle cx="0" cy="-13" r="1" fill="@peauO"/>`;
const OV_CRANE_PROFILE =
  `<path d="M-4 -7.5 Q-3 -12 -1.6 -24 Q3.4 -12 6 -6.5 Q1 -9.4 -4 -7.5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
  + `<circle cx="0.4" cy="-19" r="0.8" fill="@peauO"/><circle cx="1.4" cy="-15" r="0.9" fill="@peauO"/><circle cx="2.2" cy="-11.5" r="1" fill="@peauO"/>`;
// Langue-fouet grise démesurée pendant de la gueule, fléau à pointes au bout.
const OV_LANGUE_FRONT =
  `<path d="M-0.8 12.5 Q-4 21 0.6 30 Q4.6 37.5 1.4 46" stroke="#9aa0a4" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
  + `<path d="M-0.8 12.5 Q-4 21 0.6 30 Q4.6 37.5 1.4 46" stroke="#5c6066" stroke-width="0.5" fill="none" opacity="0.7"/>`
  + `<circle cx="1.2" cy="47.6" r="1.9" fill="#4a4e54" stroke="#26282c" stroke-width="0.4"/>`
  + `<path d="M1.2 44.8 l0 -1.4 M-1.4 46.6 l-1.2 -0.8 M3.8 46.6 l1.2 -0.8 M-1 49.4 l-1 1 M3.4 49.4 l1 1 M1.2 50.4 l0 1.4" stroke="#26282c" stroke-width="0.6"/>`;
const OV_LANGUE_PROFILE =
  `<path d="M8.6 11.5 Q19 18 17.6 27 Q16.4 34 19.4 41" stroke="#9aa0a4" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
  + `<path d="M8.6 11.5 Q19 18 17.6 27 Q16.4 34 19.4 41" stroke="#5c6066" stroke-width="0.5" fill="none" opacity="0.7"/>`
  + `<circle cx="19.7" cy="42.6" r="1.9" fill="#4a4e54" stroke="#26282c" stroke-width="0.4"/>`
  + `<path d="M19.7 39.8 l0 -1.4 M17.1 41.6 l-1.2 -0.8 M22.3 41.6 l1.2 -0.8 M19.7 45.4 l0 1.4" stroke="#26282c" stroke-width="0.6"/>`;
// Plaque rouge annelée sur le tibia (les jambières striées de l'illustration).
const OV_TIBIA_ROUGE =
  `<path d="M-2.4 27 L-3 43 L0.4 43 L-0.2 27 Z" fill="#8e2a34" opacity="0.85"/>`
  + `<path d="M-2.6 31 l2.6 0.2 M-2.7 35 l2.7 0.2 M-2.8 39 l2.8 0.2" stroke="#571219" stroke-width="0.5" opacity="0.8"/>`;

export const creature: CreatureDef = {
  label: 'Slenderthigh Whiptongue',
  plan: 'biped',
  perso: {
    tenue: 'sanguinaire', // pagne loqueteux ceinturé — recoloré sombre (illustration : pagne noir)
    sex: 'M',
    gabarit: 'elance', // silhouette étirée aux jambes fines (« Slenderthigh ») ; la masse vient du torse musclé
    scale: 1.15, // nuance intra-Grande : un prince démon domine un Grande standard
    monster: { tete: 'demon', brasG: 'griffe', jambes: 'chevre' },
    colors: { peau: '#dcd0c0', cheveux: '#8e2a34', vet1: '#3a3742', cuir: '#2c2231' },
    features: [
      ...feat('muscles-torse'),
      { bone: 'tete', svg: OV_CORNES_FRONT, layer: -2, view: 'front' },
      { bone: 'tete', svg: OV_CORNES_FRONT, layer: -2, view: 'back' },
      { bone: 'tete', svg: OV_CORNES_PROFILE, layer: -2, view: 'profile' },
      { bone: 'tete', svg: OV_CRANE_FRONT, layer: -1, view: 'front' },
      { bone: 'tete', svg: OV_CRANE_FRONT, layer: -1, view: 'back' },
      { bone: 'tete', svg: OV_CRANE_PROFILE, layer: -1, view: 'profile' },
      { bone: 'tete', svg: OV_LANGUE_FRONT, layer: 55, view: 'front' },
      { bone: 'tete', svg: OV_LANGUE_PROFILE, layer: 55, view: 'profile' },
      { bone: 'mainD', svg: GRIFFES_ART },
      { bone: 'cuisseG', svg: OV_TIBIA_ROUGE, layer: 10 },
      { bone: 'cuisseD', svg: OV_TIBIA_ROUGE, layer: 10 },
    ],
  },
};
