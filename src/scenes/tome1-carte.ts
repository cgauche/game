/**
 * CAMPAGNE — Tome 1 : carte de voyage minimale (#T2), au schéma `WorldMap` (donnée, éditable
 * dans l'onglet « Monde » de l'éditeur — rien de codé en dur).
 *
 * Lieux = scènes EXISTANTES du Tome 1 : l'auberge-relais « La Diligence » (tome1-intro) et le
 * théâtre de l'embuscade sur la grand-route (tome1-route). Sourcé du scénario :
 *  - la diligence roule « guère plus de 3 kilomètres à l'heure ! » (EiS ch.1 l.284) → vitesse
 *    d'auteur `speed.diligence = 3` sur ce tronçon (au lieu du M6 RAW) ;
 *  - le scénario ne publie PAS la distance auberge → lieu de l'embuscade (« elle n'atteindra pas
 *    la prochaine auberge-relais avant la nuit », ch.1 l.284) → VALEUR D'AUTEUR : 12 km
 *    (cohérente : ~4 h de diligence à 3 km/h — l'après-midi y passe), paramétrable dans l'éditeur.
 *  - « Attaqués ! » (péripétie 10) cible la rencontre de la bande de Knud (`enc-bande`,
 *    tome1-route) — les mutants rôdent précisément sur ce tronçon (ch.2).
 */
import { WorldMap } from '../state/worldMap';

export const tome1Carte: WorldMap = {
  id: 'tome1-carte',
  nom: 'Le Reikland — Tome 1',
  places: [
    {
      id: 'lieu-auberge',
      label: 'Auberge « La Diligence »',
      pos: { x: 28, y: 58 },
      scene: 'tome1-intro',
      icon: '🏠',
    },
    {
      id: 'lieu-route',
      label: "La route d'Altdorf",
      pos: { x: 66, y: 38 },
      scene: 'tome1-route',
      entry: 'ouest',
      icon: '🌲',
    },
  ],
  routes: [
    {
      id: 'route-auberge-altdorf',
      a: 'lieu-auberge',
      b: 'lieu-route',
      km: 12, // valeur d'auteur (cf. en-tête — le scénario ne publie pas la distance)
      modes: ['pied', 'diligence'],
      speed: { diligence: 3 }, // « guère plus de 3 kilomètres à l'heure ! » (EiS ch.1 l.284)
      ambush: { scene: 'tome1-route', entry: 'ouest', encounter: 'enc-bande' },
    },
  ],
};
