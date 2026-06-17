import { useGame } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { harvestProfileFor } from '../engine/harvest';
import { Coins } from './Coins';
import { TeamPortrait } from './TeamPortrait';
import { GearAssignList } from './GearAssignList';

/**
 * Écran de VICTOIRE plein écran (demande utilisateur) : récapitulatif de fin de combat — XP gagnée, or
 * récupéré, ennemis vaincus, et butin d'ÉQUIPEMENT assignable à un héros (`assignVictoryGear` applique
 * le `giveTrapping` de la rencontre sur le portrait choisi, qualités préservées).
 * « Continuer » revient à l'exploration. Ne s'affiche que sur `battle.over === 'victory'`.
 * COOP : écran SYNCHRONISÉ — chacun n'attribue le butin qu'à SES héros ; « Continuer » = ✓ de son
 * siège (portraits + ✓), l'hôte ferme à l'unanimité (spec §4bis).
 */
export function VictoryScreen() {
  const battle = useGame((s) => s.battle);
  const pv = useGame((s) => s.pendingVictory);
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const assignGear = useGame((s) => s.assignVictoryGear);
  const harvest = useGame((s) => s.harvestCreature);
  const appraiseGear = useGame((s) => s.appraiseGear);
  const dismiss = useGame((s) => s.dismissVictory);
  const victoryReady = useGame((s) => s.victoryReady);
  const state = useGame();
  if (!battle || battle.over !== 'victory') return null;
  const online = net.mode !== 'local';
  const ready = pv?.readyBySeat ?? {};
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  const assignable = online ? party.filter((h) => ownsLocally(state, h.id)) : party;

  const xp = pv?.xp ?? 0;
  const gold = pv?.gold ?? { gold: 0, silver: 0, brass: 0 };
  const gear = pv?.gear ?? [];
  const defeated = pv?.defeated ?? [];

  return (
    <div className="victory-overlay">
      <div className="victory-screen">
        <h1 className="victory-title">Victoire</h1>
        <div className="rule-fleur" aria-hidden>⚜</div>

        {/* #9 : messages de journal de la victoire (ex. annonce de l'arène) affichés ICI. */}
        {(pv?.messages?.length ?? 0) > 0 && (
          <div className="victory-messages">
            {pv!.messages!.map((m, i) => <p key={i} className="victory-msg">{m}</p>)}
          </div>
        )}

        <div className="victory-rewards">
          <div className="victory-stat"><span className="vs-ico">✨</span> <b>{xp}</b> <span className="vs-unit">PX</span></div>
          <div className="victory-stat"><span className="vs-ico">💰</span> <Coins money={gold} /></div>
        </div>

        {defeated.length > 0 && (
          <div className="victory-section">
            <h3>Ennemis vaincus</h3>
            <div className="victory-defeated">
              {defeated.map((d) => {
                const canHarvest = !!harvestProfileFor(d.creatureId) && net.mode !== 'guest';
                const done = (pv?.harvested ?? []).includes(d.creatureId ?? '');
                return (
                  <span key={d.name} className="victory-foe">
                    {d.name}{d.count > 1 ? ` ×${d.count}` : ''}
                    {canHarvest && (
                      <button
                        className="btn btn-ghost victory-harvest"
                        disabled={done}
                        onClick={() => harvest(d.creatureId!)}
                        title="Récolter les pièces de monstre (Test de Savoir (Bêtes))"
                      >
                        {done ? '✓ récolté' : '🔪 Récolter'}
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {gear.length > 0 && (
          <div className="victory-section">
            <h3>Équipement — qui l'emporte&nbsp;?</h3>
            <GearAssignList
              gear={gear}
              assignable={assignable}
              onAssign={assignGear}
              onAppraise={net.mode === 'guest' ? undefined : (i, mode) => appraiseGear('victory', i, mode)}
            />
          </div>
        )}

        {online ? (
          <>
            <div className="ready-row">
              {seats.map(({ seat, name }) => {
                const h = party.find((x) => !x.dead && (net.ownership[x.id] ?? 0) === seat);
                return (
                  <span key={seat} className={`ready-chip${ready[seat] ? ' ok' : ''}`} title={name}>
                    {h ? <TeamPortrait combatant={h} size={28} /> : <span className="ready-noportrait">👤</span>}
                    {ready[seat] ? '✓' : '…'}
                  </span>
                );
              })}
            </div>
            <button className="btn btn-primary victory-continue" disabled={!!ready[net.mySeat]} onClick={() => victoryReady(net.mySeat)}>
              {ready[net.mySeat] ? '⏳ En attente des autres…' : 'Continuer'}
            </button>
          </>
        ) : (
          <button className="btn btn-primary victory-continue" onClick={dismiss}>Continuer</button>
        )}
      </div>
    </div>
  );
}
