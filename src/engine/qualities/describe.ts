/**
 * Descriptions FR canoniques des qualités d'objet (Atouts/Défauts), pour l'affichage (fiche, marchand,
 * infobulles). RAW : Atouts d'arme **LDB 62 « Les armes »**, Défauts d'arme + Taille + Recharge
 * **LDB 63 « Armures »**, qualités d'artisanat **LDB 60 « Fabrication »**, magie **ADE II**. Aucune
 * invention : chaque texte résume fidèlement le passage cité. Le `type` (Atout/Défaut) vient du registre.
 */
import { parseQuality } from './normalize';
import { qualityByLabel } from '../../data';
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
  /** Atout (bénéfique) / Défaut (handicap) — du registre ; undefined si non classé. */
  type?: 'Atout' | 'Défaut';
  /** Indice numérique éventuel (« Solide 3 » → 3, « Recharge 1 » → 1). */
  indice?: number;
  /** Libellé d'affichage (clé + Indice, ex. « Solide 3 »). */
  label: string;
  /** Description courte canonique (LDB), si connue. */
  desc?: string;
}

/** Décrit une chaîne de qualité (« Recharge 1 », « précise ») pour l'affichage : clé, type, Indice, desc.
 *  null si la qualité est inconnue du registre. */
export function describeQuality(raw: string): QualityInfo | null {
  const p = parseQuality(raw);
  if (!p) return null;
  const type = qualityByLabel.get(p.key)?.type; // Atout/Défaut depuis la DONNÉE (registre = libellé seul)
  return {
    key: p.key,
    type: type === 'Atout' || type === 'Défaut' ? type : undefined,
    indice: p.indice,
    label: p.indice != null ? `${p.key} ${p.indice}` : p.key,
    desc: QUALITY_DESC[p.key],
  };
}
