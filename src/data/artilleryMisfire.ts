import artilleryMisfireJson from './artillery-misfire.json';

/**
 * Incidents de Tir d'Artillerie par Salve — Aux Armes « Salve » (AA l.3940-3946), transcrits
 * verbatim. Table DISTINCTE de l'Incident de tir GÉNÉRIQUE (LDB, `oups.json`/`OUPS_MISFIRE`) et de la
 * table de Critiques de Structure (`structure-criticals.json`) : elle ne se tire QU'EN PLUS, quand une
 * arme dotée de l'Atout *Salve* subit un Incident de tir (AA l.3936).
 *
 * Champs :
 *  - `location` : `brasPrincipal` (lignes 1-4) ou `random` (lignes 5-10).
 *  - `perSalveIndex` : l'effet se répète une fois PAR Indice de Salve restant (lignes 8-10).
 *  - `destroyed` : la pièce d'artillerie est détruite (lignes 1-9).
 *  - `strayFire` : ligne 10, « tir perdu » — pas de Dégâts directs à l'équipe, effet sur le terrain
 *    (journalisé verbatim en `note`, comme les effets sur les PERSONNES de `structure-criticals.json`).
 */
export interface ArtilleryMisfireEntry {
  min: number;
  max: number;
  /** id STABLE (slug) — toute réf passe par lui, jamais le `name`. */
  id: string;
  name: string;
  location: 'brasPrincipal' | 'random';
  perSalveIndex: boolean;
  destroyed: boolean;
  strayFire?: boolean;
  note: string;
}

export const ARTILLERY_MISFIRE = (artilleryMisfireJson as { entries: ArtilleryMisfireEntry[] }).entries;
