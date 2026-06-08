import { useGame } from '../state/store';
import { RigPortrait } from './RigPortrait';
import { EffectChips } from './EffectChips';
import { HERO_RING, hpColor } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/**
 * Panneau GROUPE détaillé (colonne gauche) — affiché EN COMBAT comme HORS COMBAT.
 * Pour chaque allié : portrait (vu de face), PB chiffrés + barre couleur, carrière, Avantage,
 * arme active (équipement) et la liste des effets (États + buffs). But : suivre l'état de SON
 * groupe d'un coup d'œil, même quand l'ordre de bataille déborde d'ennemis.
 */
function GroupRow({ c, ring, active, onOpen }: { c: Combatant; ring: string; active: boolean; onOpen?: (id: string) => void }) {
  const ratio = c.wounds.max > 0 ? c.wounds.current / c.wounds.max : 0;
  const ko = c.dead || c.wounds.current <= 0 || c.conditions.some((x) => x.name === 'Inconscient');
  const weapon = c.weapons?.[0]?.name;
  return (
    <div className={`grp-card ${active ? 'active' : ''} ${ko ? 'ko' : ''}`} onClick={() => onOpen?.(c.id)} title="Voir la fiche / l'équipement">
      <span className="grp-portrait">
        <RigPortrait combatant={c} size={42} ring={ring} />
        {ko && <span className="ko-cross">✕</span>}
      </span>
      <div className="grp-main">
        <div className="grp-top">
          <b>{c.name}</b>
          <span className="grp-pv">{c.dead ? '☠️' : `${c.wounds.current}/${c.wounds.max}`}</span>
        </div>
        <div className="grp-bar"><i style={{ width: `${Math.max(0, ratio) * 100}%`, background: hpColor(ratio) }} /></div>
        <div className="grp-meta">
          {c.career ?? ''}
          {c.advantage > 0 && <span className="adv"> Av+{c.advantage}</span>}
          {weapon && <span className="grp-wpn"> · {weapon}</span>}
        </div>
        <EffectChips conditions={c.conditions} effects={c.activeEffects} frenzied={c.frenzied} max={6} />
      </div>
    </div>
  );
}

export function GroupPanel({ onOpen }: { onOpen?: (id: string) => void }) {
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const activeId = battle && !battle.over ? battle.order[battle.turn] : null;
  return (
    <div className="group-panel">
      <div className="mini-title">Groupe</div>
      {party.map((h, idx) => {
        const c = battle?.combatants.find((x) => x.id === h.id) ?? h; // version « vivante » en combat (PB/effets à jour)
        return <GroupRow key={h.id} c={c} ring={HERO_RING[idx % HERO_RING.length]} active={c.id === activeId} onOpen={onOpen} />;
      })}
    </div>
  );
}
