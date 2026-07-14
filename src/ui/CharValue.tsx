import { CHAR_LABELS, type CharKey } from '../engine/types';
import { CHAR_ABR } from '../data';
import { CodexRef } from './compendium/CodexRef';
import type { StatGridSize } from './CharStatsGrid';

/**
 * Rendu UNIQUE d'une caractéristique isolée (« CC 45 ») — LOT 5, composants de donnée unifiés :
 * libellé COURT (CC/CT/F/…) portant le popover Codex de la caractéristique + valeur, `bonus`
 * optionnel (« B4 »). Tout panneau STATIQUE qui montre une carac à l'unité passe par ici ; les
 * lignes de jet restent sur `breakdown.ts` (testPending/optionPending — hors périmètre), la grille
 * complète reste `CharStatsGrid`. `size` (défaut `sm`) prend l'échelle NOMMÉE au lieu d'hériter du
 * contexte (CONTRAT `--stat-*` partagé avec `CharStatsGrid`, #418).
 */
export function CharValue({ charKey, value, bonus, size = 'sm' }: { charKey: CharKey; value: number | string; bonus?: number; size?: StatGridSize }) {
  return (
    <span className={`char-value char-value-${size}`}>
      <CodexRef category="characteristics" id={charKey} label={CHAR_LABELS[charKey]}>{CHAR_ABR[charKey]}</CodexRef>
      <b>{value}</b>
      {bonus != null && <em title={`Bonus de ${CHAR_LABELS[charKey]}`}>B{bonus}</em>}
    </span>
  );
}
