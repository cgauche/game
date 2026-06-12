import type { Combatant } from '../engine/types';
import type { RollBreakdown } from '../engine/combat';
import { RollLine, PendingRollLine, type PendingRoll } from './RollLine';
import { TeamPortrait } from './TeamPortrait';

/**
 * LE panneau de jet unique — même géométrie AVANT et APRÈS le jet (l'avant-jet est le même bloc
 * que le résultat, pré-rempli). Une ligne par participant : portrait d'équipe · compétence ·
 * base+mods=cible · 🎲 dé · DR. Utilisé par TOUTES les modales de jet (attaque, défense, tests,
 * flux `RollFlowShell`…).
 *
 * - `d` rempli → `RollLine` ; sinon `pending` → `PendingRollLine` (dé/DR vides).
 * - Test opposé post-jet : `winnerIndex` accentue la ligne gagnante (`.rr-win`) et atténue la
 *   perdante (`.rr-lose`) — le vainqueur saute aux yeux ; `netSL` ajoute le badge « DR net ».
 */
export interface RollRowData {
  combatant?: Combatant;
  d?: RollBreakdown;
  pending?: PendingRoll;
}

export function RollPanel({
  rows,
  winnerIndex,
  netSL,
}: {
  rows: RollRowData[];
  /** Index de la ligne qui REMPORTE le Test opposé (post-jet) ; null/absent = pas d'opposition tranchée. */
  winnerIndex?: number | null;
  /** DR net du Test opposé — badge sous les lignes. */
  netSL?: number;
}) {
  const shown = rows.filter((r) => r.d || r.pending);
  if (!shown.length) return null;
  const withPortraits = shown.some((r) => r.combatant);
  return (
    <div className="roll-panel">
      {shown.map((r, i) => (
        <div
          key={i}
          className={`rr-row ${winnerIndex == null ? '' : winnerIndex === i ? 'rr-win' : 'rr-lose'}`}
        >
          {withPortraits && (
            <span className="rr-port">{r.combatant && <TeamPortrait combatant={r.combatant} size={28} />}</span>
          )}
          <div className="rr-line">{r.d ? <RollLine d={r.d} /> : <PendingRollLine p={r.pending!} />}</div>
        </div>
      ))}
      {winnerIndex != null && netSL != null && (
        <div className="rm-netsl" title="Différence de DR entre les deux jets : elle alimente les Dégâts (Test opposé)">
          DR net : {netSL >= 0 ? '+' : '−'}{Math.abs(netSL)}
        </div>
      )}
    </div>
  );
}
