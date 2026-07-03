import type { IconFamily } from '../types';

/* Famille « voyage » (sélecteur de mode de la carte du monde + `vehicle.icon` de vehicles.json —
   remplace les emojis diligence/barge/barque/charrette/voilier/pied/monture/ancre). Charte de
   dessin : voir defs/action.ts. Pictogrammes de TRANSPORT clairs et reconnaissables (un bateau
   ressemble à un bateau) ; métaphores Renaissance-fantasy monochromes, pas de glyphe moderne. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'travel/coach',
    label: 'Diligence',
    // Caisse d'attelage fermée sur ses deux grandes roues à rayons, timon vers l'avant.
    svg:
      `<path ${K} d="M4.4 7.2 H15.6 C16.4 7.2 17 7.8 17 8.6 V13.4 H4.4 Z"/>` +
      `<path ${KF} d="M7.2 7.4 V13.2 M11.2 7.4 V13.2"/>` +
      `<path ${K} d="M17 10 L20.4 8.6"/>` +
      `<circle ${K} cx="7.2" cy="16.6" r="3.1"/>` +
      `<circle ${K} cx="14.4" cy="16.6" r="3.1"/>` +
      `<path ${KF} d="M7.2 13.7 V19.5 M4.3 16.6 H10.1 M14.4 13.7 V19.5 M11.5 16.6 H17.3"/>`,
  },
  {
    id: 'travel/barge',
    label: 'Barge',
    // Chaland fluvial à fond plat, cabine centrale et longue perche du batelier.
    svg:
      `<path ${K} d="M3 14.5 C3.6 17.3 6.3 19.2 9.4 19.2 H14.6 C17.7 19.2 20.4 17.3 21 14.5 Z"/>` +
      `<path ${K} d="M8.2 14.2 V9.4 H15.8 V14.2"/>` +
      `<path ${KF} d="M10.6 9.5 V14 M13.4 9.5 V14"/>` +
      `<path ${K} d="M17.6 6 L6.4 17"/>`,
  },
  {
    id: 'travel/rowboat',
    label: 'Barque à rames',
    // Coque de barque à clins, une rame croisée dans le tolet.
    svg:
      `<path ${K} d="M3.4 13.6 C4.4 16.6 7.4 18.6 12 18.6 C16.6 18.6 19.6 16.6 20.6 13.6 Z"/>` +
      `<path ${KF} d="M5.5 15.9 C9.5 17 14.5 17 18.5 15.9"/>` +
      `<path ${K} d="M9.6 13.4 L18.9 5.6"/>` +
      `<path ${KF} d="M17.8 4.3 L20.3 6.7"/>`,
  },
  {
    id: 'travel/cart',
    label: 'Charrette',
    // Plateau ouvert à ridelles sur une roue, brancard de trait vers l'avant.
    svg:
      `<path ${K} d="M5 9.4 H16.2 L15 14.2 H5 Z"/>` +
      `<path ${KF} d="M5.9 9.6 V13.9 M8.7 9.6 L8.2 13.9 M11.5 9.6 L11.5 13.9 M14.3 9.6 L13.7 13.9"/>` +
      `<path ${K} d="M16.2 9.4 L20.6 7.8"/>` +
      `<circle ${K} cx="9.6" cy="17.3" r="2.6"/>` +
      `<path ${KF} d="M9.6 14.9 V19.7 M7.2 17.3 H12"/>`,
  },
  {
    id: 'travel/sail-ship',
    label: 'Navire à voile',
    // Coque de haute mer, mât et grande voile gonflée, fanion en tête de mât.
    svg:
      `<path ${K} d="M3.2 15.5 C4.3 18.3 7.3 20 12 20 C16.7 20 19.7 18.3 20.8 15.5 Z"/>` +
      `<path ${K} d="M12 4 V15"/>` +
      `<path ${F} d="M12.9 4.7 C15.1 5.3 16.9 6.5 18.3 8.2 L12.9 8.2 Z"/>` +
      `<path ${F} d="M11.1 5.2 C8.6 6.3 6.9 8.2 6.1 10.9 C7.7 11.6 9.4 11.9 11.1 11.9 Z"/>` +
      `<path ${KF} d="M12 4 L15.4 4.6 L12 5.4"/>`,
  },
  {
    id: 'travel/foot',
    label: 'À pied',
    // Empreinte de pied nu : plante et cinq orteils (marche du groupe).
    svg:
      `<path ${F} d="M9.4 5.6 C11.9 5.6 13.6 7.8 13.6 11 C13.6 13.4 12.9 15.4 11.3 16.6 C10 17.6 8.6 17.9 7.3 17.4 C6 16.9 5.3 15.7 5.3 14 C5.3 12.6 5.6 11 6 9.3 C6.5 7 7.6 5.6 9.4 5.6 Z"/>` +
      `<circle ${F} cx="15.7" cy="8" r="1.5"/>` +
      `<circle ${F} cx="17.4" cy="10.9" r="1.35"/>` +
      `<circle ${F} cx="17.7" cy="14" r="1.25"/>` +
      `<circle ${F} cx="16.6" cy="16.7" r="1.15"/>`,
  },
  {
    id: 'travel/mount',
    label: 'En selle',
    // Cheval de profil : tête baissée museau tendu, encolure, dos, croupe et quatre jambes campées.
    svg:
      `<path ${F} d="M3.2 8.6 C3.8 7.9 4.7 7.6 5.7 7.9 C5.5 7.1 5.7 6.4 6.3 5.9 C6.5 6.6 6.9 7.1 7.6 7.4 C8.5 6.4 9.7 5.9 11.1 5.9 C12.2 5.9 13 5.5 13.6 4.7 C14.4 5.5 15.7 6 17.4 6 C18.9 6 20 6.9 20.6 8.6 C21 9.8 21 11.2 20.6 12.8 C20.2 14.4 19.4 15.7 18.3 16.6 L18.3 12.9 C17 13.6 15.5 14 13.8 14 C12.4 14 11.1 13.7 9.9 13.1 C8.4 12.4 7.2 11.3 6.4 9.9 C5.1 10.2 4 9.8 3.2 8.6 Z"/>` +
      `<path ${K} d="M7.3 13.9 V17.4 M10.6 14 V17.4 M14.9 14 V17.4 M18.3 14.4 V17.4"/>`,
  },
  {
    id: 'travel/anchor',
    label: 'En mer',
    // Ancre de marine : jas, tige et pattes recourbées, anneau en tête (traversée maritime).
    svg:
      `<circle ${K} cx="12" cy="5" r="1.9"/>` +
      `<path ${K} d="M12 6.9 V18.8"/>` +
      `<path ${K} d="M8.6 9.4 H15.4"/>` +
      `<path ${K} d="M5 12.4 C5 16.2 8.1 18.9 12 18.9 C15.9 18.9 19 16.2 19 12.4"/>` +
      `<path ${K} d="M5 12.4 L3.3 13.6 M5 12.4 L6.9 13.3 M19 12.4 L20.7 13.6 M19 12.4 L17.1 13.3"/>`,
  },
];
