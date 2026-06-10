import type { RollBreakdown } from '../engine/combat';
import { Dice } from './Dice';

/** Une ligne de jet : base + modificateurs = cible · d100 · DR (✓/✗), + le détail étiqueté
 *  des modificateurs (« Courte portée +40 », « Viser +20 »…) quand il réconcilie le total. */
export function RollLine({ d }: { d: RollBreakdown }) {
  const mod = d.modifier === 0 ? '' : ` ${d.modifier > 0 ? '+' : '−'}${Math.abs(d.modifier)}`;
  const mods = d.mods ?? [];
  const showMods = mods.length > 0 && mods.reduce((s, m) => s + m.value, 0) === d.modifier;
  return (
    <div className="rm-roll-block">
      <div className={`rm-roll ${d.success ? 'ok' : 'fail'}`}>
        <span className="rm-roll-label">{d.label}</span>
        <span className="rm-roll-calc" title="Compétence de base + modificateurs détaillés ci-dessous = cible à ne pas dépasser">
          {d.base}
          {mod} = <b>{d.target}</b>
        </span>
        <span className="rm-roll-dice">
          🎲 <b><Dice roll={d.roll} /></b>
        </span>
        <span className="rm-roll-sl">
          {d.success ? '✓' : '✗'} {d.sl >= 0 ? '+' : '−'}
          {Math.abs(d.sl)} DR
        </span>
      </div>
      {showMods && (
        <div className="rm-roll-mods">
          {mods.map((m, i) => (
            <span key={i} className={`rm-mod ${m.value >= 0 ? 'pos' : 'neg'}`}>
              {m.value >= 0 ? '+' : '−'}
              {Math.abs(m.value)} {m.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
