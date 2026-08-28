/**
 * Descriptions FR canoniques des qualités d'objet (Atouts/Défauts), pour l'affichage (fiche, marchand,
 * infobulles). RAW : Atouts d'arme **LDB 62 « Les armes »**, Défauts d'arme + Taille + Recharge
 * **LDB 63 « Armures »**, qualités d'artisanat **LDB 60 « Fabrication »**, magie **ADE II**. Aucune
 * invention : chaque texte résume fidèlement le passage cité. Le `type` (Atout/Défaut) vient du registre.
 */
import type { QualityInstance } from '../types';
import { qualityById } from '../../data';
import qualitiesJson from '../../data/qualities.json';

/** Descriptions issues de la DONNÉE app-owned (`qualities.json`) — SOURCE UNIQUE des qualités
 *  cataloguées (dont toutes les nouvelles : Aux Armes…). On ne re-hardcode plus leur desc ici. */
const DATA_DESC: Record<string, string> = Object.fromEntries(
  (qualitiesJson as { label: string; desc?: string }[]).filter((q) => q.desc).map((q) => [q.label, q.desc!]),
);

/** Description courte par clé canonique — PILOTÉE ENTIÈREMENT par `qualities.json` (app-owned).
 *  Toute qualité du registre y a son entrée (donnée) ; il n'y a plus de desc codée en dur ici. */
export const QUALITY_DESC: Record<string, string> = DATA_DESC;

export interface QualityInfo {
  /** Clé canonique du registre (ex. 'Solide'). */
  key: string;
  /** POLARITÉ : Atout (bénéfique) / Défaut (handicap) — id du registre ; undefined si non classée. */
  polarite?: 'atout' | 'defaut';
  /** Indice numérique éventuel (« Solide 3 » → 3, « Recharge 1 » → 1). */
  indice?: number;
  /** Libellé d'affichage (clé + Indice, ex. « Solide 3 »). */
  label: string;
  /** Description courte canonique (LDB), si connue. */
  desc?: string;
}

/** Décrit une `QualityInstance` runtime (`{id, value?}`) pour l'affichage : clé, type, Indice, desc.
 *  null si la qualité est inconnue du registre. Lecture PAR ID (plus de parse de chaîne). */
export function describeQuality(q: QualityInstance): QualityInfo | null {
  const data = qualityById.get(q.id);
  if (!data) return null;
  const key = data.label; // clé canonique = libellé FR du registre
  return {
    key,
    polarite: data.polarite === 'atout' || data.polarite === 'defaut' ? data.polarite : undefined,
    indice: q.value,
    label: q.value != null ? `${key} ${q.value}` : key,
    desc: QUALITY_DESC[key],
  };
}
