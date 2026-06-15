import type { HitLocation, Difficulty } from '../engine/types';
import type { TraumaKind, TraumaSeverity } from '../engine/trauma';
import criticalsJson from './criticals.json';

/**
 * Tables de Blessures critiques — Livre de base, « Traumatisme » (Source/Warhammer v4 - Livre de
 * base version corrigée/18 - Traumatisme.md), transcrites verbatim. `00` est encodé `max: 100`.
 *
 * La DONNÉE vit dans `criticals.json` (éditable, comme `creatures.json`) ; ce module n'est que le
 * TYPE + le chargement + le mapping des Localisations. 4 tables UNIQUES (bras gauche = bras droit,
 * jambe gauche = jambe droite) projetées sur les 6 Localisations. Ajouter/régler un Critique = éditer
 * le JSON, jamais ce fichier.
 *
 * Champs COMBAT : `wounds` (PB perdus, ignore BE+PA, l.62), `conditions` (États immédiats),
 * `resist` (« réussir un Test de Résistance ou gagner l'État X », auto-résolu par le moteur),
 * `lethal` (résultat « Mort »). `note` = texte canon des effets LONG TERME (amputation/fracture/
 * déchirure/pénalités permanentes), journalisé mais NON simulé. Les valeurs « 1d10 États » du canon
 * sont encodées en valeur fixe représentative (indiqué en note).
 */
export interface CritEntry {
  min: number;
  max: number;
  name: string;
  wounds: number;
  lethal?: boolean;
  conditions?: { name: string; value: number }[];
  resist?: { difficulty: Difficulty; onFail: { name: string; value: number }[] };
  note: string;
  /** Traumatismes posés (LDB 18) — la localisation vient de la table. Transcrit des `note` verbatim. */
  traumas?: { kind: TraumaKind; severity: TraumaSeverity }[];
}
export type CritTable = CritEntry[];

const T = criticalsJson as { tete: CritTable; bras: CritTable; corps: CritTable; jambe: CritTable };

export const CRITICAL_TABLES: Record<HitLocation, CritTable> = {
  tete: T.tete,
  brasG: T.bras,
  brasD: T.bras,
  corps: T.corps,
  jambeG: T.jambe,
  jambeD: T.jambe,
};
