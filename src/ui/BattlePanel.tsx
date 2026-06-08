import { useGame, activeCombatant } from '../state/store';
import { isOutOfAction } from '../engine/conditions';
import { topImportantCondition } from '../gameIso/effectIcons';
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
          const key = topImportantCondition(c.conditions);
          return (
            <div key={id} className={`ord-row ${isHero ? 'ally' : 'enemy'} ${i === battle.turn ? 'now' : ''} ${out ? 'out' : ''}`}>
              <RigPortrait combatant={c} size={32} ring={ring} />
              <div className="ord-info">
                <div className="ord-top">
                  <b>{c.name}</b>
                  <span className="ord-pv">{c.wounds.current}/{c.wounds.max}</span>
                </div>
                <div className="ord-bar"><i style={{ width: `${Math.max(0, ratio) * 100}%`, background: hpColor(ratio) }} /></div>
              </div>
              {key && <span className="ord-st" title={key.count && key.count > 1 ? `${key.label} ×${key.count}` : key.label}>{key.icon}</span>}
            </div>
          );
        })}
      </div>

      <div className="mini-title">Journal de combat</div>
      <div className="battle-log">
        {battle.log.slice(-9).map((l, i) => (
          <p key={i}>{l}</p>
        ))}
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
