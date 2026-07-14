import { CHAR_KEYS, CharKey, CHAR_LABELS } from '../engine/types';
import { CHAR_ABR } from '../data';
import { CodexRef } from './compendium/CodexRef';

/** Échelle NOMMÉE (patron `CHAR_SIZE_PX` de `PortraitTile`) : `sm` = densité fiche/codex, `md` =
 *  écran plein type Race, `lg` = allocation créateur. Pilote les tokens `--stat-*` (base.css). */
export type StatGridSize = 'sm' | 'md' | 'lg';

export interface CharStatsGridProps {
  /** Valeur affichée d'une caractéristique. */
  value: (k: CharKey) => number | string;
  /** Classe(s) ajoutée(s) à la VALEUR (coloration talent/boost) — ex. 'ok-text', 'warn-text', 'boost'. */
  valClass?: (k: CharKey) => string | undefined;
  /** Infobulle native sur la VALEUR (modificateur base/effectif) — JAMAIS sur le libellé, qui porte
   *  déjà le popover Codex de la caractéristique (évite le double-tooltip). */
  note?: (k: CharKey) => string | undefined;
  size?: StatGridSize;
  className?: string;
}

/** Grille UNIFIÉE des caractéristiques (CC, CT, …) — source UNIQUE du markup `.char-stats`/`.stat`
 *  (plaque Atelier : libellé small-caps gravé + valeur en grand, cadre laiton discret), consommée
 *  par la fiche (CharacterSheet) et le récap créateur (CreatorSummary). Chaque libellé porte le
 *  popover Codex de sa caractéristique (CodexRef « characteristics » → desc verbatim de
 *  characteristics.json). */
export function CharStatsGrid({ value, valClass, note, size = 'sm', className }: CharStatsGridProps) {
  return (
    <div className={`char-stats char-stats-${size}${className ? ` ${className}` : ''}`}>
      {CHAR_KEYS.map((k) => (
        <div className="stat" key={k}>
          <span className="stat-label">
            <CodexRef category="characteristics" id={k} label={CHAR_LABELS[k]}>{CHAR_ABR[k]}</CodexRef>
          </span>
          <span className={`stat-val${valClass?.(k) ? ` ${valClass(k)}` : ''}`} title={note?.(k)}>{value(k)}</span>
        </div>
      ))}
    </div>
  );
}
