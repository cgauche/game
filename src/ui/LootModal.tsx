import { useGame } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { Modal } from './Modal';
import { Coins } from './Coins';
import { GearAssignList } from './GearAssignList';
import { Icon } from './Icon';

/**
 * Fenêtre de BUTIN hors combat (fouille d'un décor, branche de Test, dialogue, trigger) — même
 * brique d'attribution que l'écran de victoire : texte d'ambiance au-dessus, argent trouvé (déjà
 * crédité à la bourse commune), équipement à attribuer par portrait, révélation (Évaluer /
 * Détecter) AVANT d'attribuer. « Continuer » : le non-attribué va au 1er héros (même contrat que
 * la victoire). En coop, chacun n'attribue qu'à SES héros ; la révélation reste à l'hôte.
 */
export function LootModal() {
  const pl = useGame((s) => s.pendingLoot);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const assign = useGame((s) => s.assignLootGear);
  const appraise = useGame((s) => s.appraiseGear);
  const dismiss = useGame((s) => s.dismissLoot);
  const appraising = useGame((s) => !!s.pendingAppraise);
  const state = useGame();
  if (!pl || battle) return null; // un combat a éclaté : la fenêtre réapparaîtra après (Ramasser/victoire ont leurs flux)
  const online = net.mode !== 'local';
  const assignable = online ? party.filter((h) => ownsLocally(state, h.id)) : party;
  return (
    <Modal title={pl.title} variant="plain" className="loot-modal" onClose={appraising ? undefined : dismiss}>
      {(pl.messages?.length ?? 0) > 0 && (
        <div className="loot-messages">
          {pl.messages!.map((m, i) => <p key={i} className="victory-msg">{m}</p>)}
        </div>
      )}
      {pl.gold && (
        <div className="victory-rewards">
          <div className="victory-stat"><span className="vs-ico"><Icon id="resource/gold-purse" size="sm" /></span> <Coins money={pl.gold} /></div>
        </div>
      )}
      {pl.gear.length > 0 && (
        <div className="victory-section">
          <h3>Équipement — qui l'emporte&nbsp;?</h3>
          <GearAssignList
            gear={pl.gear}
            assignable={assignable}
            onAssign={assign}
            onAppraise={net.mode === 'guest' ? undefined : (i, mode) => appraise('loot', i, mode)}
          />
        </div>
      )}
      <button className="btn btn-primary victory-continue" onClick={dismiss}>Continuer</button>
    </Modal>
  );
}
