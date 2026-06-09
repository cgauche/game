import { useGame, activeCombatant } from '../state/store';
import { isOutOfAction } from '../engine/conditions';
import { summarizeEffects, combatantFlags } from '../gameIso/effectIcons';
import { narrateLine } from '../gameIso/combatNarration';
import { campaign } from '../scenes/campaign';
import { RigPortrait } from './RigPortrait';
import { HERO_RING, ENEMY_RING, hpColor } from '../gameIso/teamColors';

/**
 * Colonne d'INFO de combat (droite) : bannière « Tour de… », ORDRE DE BATAILLE unifié
 * (tous les combattants en portraits + PV chiffrés + état clé) et journal de combat.
 * L'ordre remplace l'ancien « init-track » texte ET la colonne Groupe (cf. Lot 1).
 * Les ACTIONS du combattant actif sont dans le panneau Perso à gauche (cf. ActionBar).
 */
export function BattlePanel() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const startScene = useGame((s) => s.startScene);
  if (!battle) return null;

  const active = activeCombatant(battle);

  return (
    <section className="battle-panel">
      {!battle.over && active && (
        <div className={`turn-banner ${active.kind === 'hero' ? 'hero' : 'enemy'}`}>
          {active.kind === 'hero' ? <>🎮 À toi, <strong>{active.name}</strong></> : <>⚔️ Tour de l'ennemi — <strong>{active.name}</strong></>}
          <span className="turn-round">Round {battle.round}</span>
        </div>
      )}

      <div className="mini-title">Ordre de bataille</div>
      <div className="order-list">
        {battle.order.map((id, i) => {
          const c = battle.combatants.find((x) => x.id === id)!;
          const out = isOutOfAction(c);
          const isHero = c.kind === 'hero';
          const heroIdx = party.findIndex((h) => h.id === c.id);
          const ring = heroIdx >= 0 ? HERO_RING[heroIdx % HERO_RING.length] : ENEMY_RING;
          const ratio = c.wounds.max > 0 ? c.wounds.current / c.wounds.max : 0;
          const ko = c.dead || c.wounds.current <= 0 || c.conditions.some((x) => x.name === 'Inconscient');
          const fx = summarizeEffects(c.conditions, [], 3, combatantFlags(c)); // jusqu'à 3 icônes (États + postures/Frénésie)
          return (
            <div key={id} className={`ord-row ${isHero ? 'ally' : 'enemy'} ${i === battle.turn ? 'now' : ''} ${out ? 'out' : ''} ${ko ? 'ko' : ''}`}>
              <span className="ord-portrait">
                <RigPortrait combatant={c} size={32} ring={ring} />
                {ko && <span className="ko-cross">✕</span>}
              </span>
              <div className="ord-info">
                <div className="ord-top">
                  <b>{c.name}</b>
                  <span className="ord-pv">{c.dead ? '☠️' : `${c.wounds.current}/${c.wounds.max}`}</span>
                </div>
                <div className="ord-bar"><i style={{ width: `${Math.max(0, ratio) * 100}%`, background: hpColor(ratio) }} /></div>
              </div>
              {fx.visible.length > 0 && (
                <span className="ord-states">
                  {fx.visible.map((v) => (
                    <span key={v.key} title={v.count && v.count > 1 ? `${v.label} ×${v.count}` : v.label}>{v.icon}</span>
                  ))}
                  {fx.moreCount > 0 && <span className="ord-more">+{fx.moreCount}</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mini-title">Journal de combat</div>
      <div className="battle-log">
        {battle.log.slice(-9).map((l, i) => {
          const n = narrateLine(l, battle.combatants);
          return (
            <p key={i} className="jr-line">
              <span className="jr-ic">{n.icon}</span>
              <span className="jr-tx">
                {n.segments.map((s, j) =>
                  s.team ? (
                    <b key={j} className={s.team === 'ally' ? 'nm-ally' : 'nm-foe'}>{s.text}</b>
                  ) : (
                    <span key={j}>{s.text}</span>
                  ),
                )}
              </span>
            </p>
          );
        })}
      </div>

      {battle.over && (
        <div className={`battle-result ${battle.over}`}>
          <h2>{battle.over === 'victory' ? 'Victoire !' : 'Défaite…'}</h2>
          <button
            className="btn btn-primary"
            onClick={() => {
              const cur = useGame.getState().scene;
              if (cur) {
                useGame.setState({ mode: 'exploration', battle: null });
              } else {
                startScene(campaign[0].scene);
              }
            }}
          >
            {battle.over === 'victory' ? 'Continuer' : 'Reprendre'}
          </button>
        </div>
      )}
    </section>
  );
}
