import { useGame } from '../state/store';
import { combatValue } from '../engine/combat';
import { canReroll } from '../engine/fortune';
import { InfluenceRow } from './InfluenceRow';
import { ResilienceButton } from './ResilienceButton';
import { OptionChooser } from './OptionChooser';
import { RollPanel } from './RollPanel';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { Modal } from './Modal';
import { testBreakdown } from './breakdown';

/**
 * Modale « Au Contact » (LDB 62 l.176, Option « Longueur d'arme »). Calque de la modale de
 * Désengagement (phase 'esquive') :
 * - phase 'roll' : Test opposé de Corps à corps sur le panneau unique — le jet du foe est FIGÉ
 *   (ligne adverse), seul le jet du mover se (re)joue (« Lancer » → Chance/+1 DR/Pacte/Résilience
 *   → « Appliquer »).
 * - phase 'choice' : le VAINQUEUR (héros) tranche via `OptionChooser` (« Au contact » / « Combat
 *   normal »). Un foe IA gagnant tranche en amont (pas de phase de choix montrée).
 */
export function AuContactModal() {
  const pd = useGame((s) => s.pendingAuContact);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.auContactRoll);
  const reroll = useGame((s) => s.auContactReroll);
  const bonusSL = useGame((s) => s.auContactBonusSL);
  const darkPact = useGame((s) => s.auContactDarkPact);
  const force = useGame((s) => s.auContactForceSuccess);
  const confirm = useGame((s) => s.auContactConfirm);
  const choose = useGame((s) => s.auContactChoose);
  const cancel = useGame((s) => s.auContactCancel);
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const rerollable = !!pd.def && !pd.def.success && canReroll(!pd.def.success, !!pd.rerolled);
  const outcome =
    pd.result === 'success' ? `${mover.name} l'emporte — à toi de choisir.`
    : pd.result === 'failure' ? `${foe.name} l'emporte et choisit.`
    : 'Égalité parfaite : le combat se poursuit normalement.';

  return (
    <Modal title="Au contact" onClose={pd.phase === 'roll' && !pd.def ? cancel : undefined}>
      <VsHeader actor={mover} target={foe} label="entrer dans la longueur d'arme" verb="🤜" />

      {pd.phase === 'choice' ? (
        <>
          <p className="rm-log">Tu l'emportes : choisis comment se poursuit le corps à corps.</p>
          <OptionChooser
            layout="actions"
            options={[
              { key: 'contact', label: '🤜 Au contact', primary: true, onSelect: () => choose('contact'), title: 'Entrer dans la longueur d’arme : toute arme plus longue que Courte est traitée comme une Arme improvisée (les deux camps)' },
              { key: 'normal', label: '⚔️ Combat normal', onSelect: () => choose('normal'), title: 'Le combat se poursuit à distance d’arme normale' },
            ]}
          />
        </>
      ) : (
        <>
          {/* Test opposé : Corps à corps du foe (figé) vs Corps à corps du mover. */}
          <RollPanel
            rows={[
              { combatant: foe, d: pd.atk ? testBreakdown('Corps à corps', combatValue(foe, 'melee'), pd.atk) : undefined },
              { combatant: mover, d: pd.def ? testBreakdown('Corps à corps', combatValue(mover, 'melee'), pd.def) : undefined },
            ]}
            winnerIndex={pd.result === 'success' ? 1 : pd.result === 'failure' ? 0 : null}
          />
          {pd.def && (
            <JournalLine
              className="rm-journal"
              event={ev(pd.result === 'success' ? 'dodge' : 'attack', outcome, mover.id, foe.id)}
              combatants={battle.combatants}
            />
          )}
          {!pd.def ? (
            <>
              <div className="rm-influence">
                {/* Résilience AVANT le jet (LDB 17 l.73) : Corps à corps forcé à l'emporter. */}
                <ResilienceButton resilience={mover.resilience ?? 0} show={(mover.resilience ?? 0) > 0} onForce={() => { roll(); force(); }} />
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={cancel}>
                  Renoncer
                </button>
                <button className="btn btn-primary" onClick={roll}>
                  Lancer
                </button>
              </div>
            </>
          ) : (
            <>
              <InfluenceRow
                actor={mover}
                rerollable={rerollable}
                onReroll={reroll}
                onBonusSL={bonusSL}
                darkPactable={mover.kind === 'hero' && !pd.def.success}
                onDarkPact={darkPact}
                onForce={force}
                forceShow={pd.result !== 'success'}
              />
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={confirm}>
                  Appliquer
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
