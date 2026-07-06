import { useGame } from '../state/store';
import { Modal } from './Modal';
import { ChoiceButtons } from './OptionChooser';
import { Coins } from './Coins';
import { canAfford } from '../engine/money';

/**
 * Prêtre de Manann (MDG ch.15 l.246, événement de port) : « Vous pouvez soit payer 1d10 CO plus la
 * Taille du navire en pistoles pour une bénédiction, soit réduire l'Humeur de Manann de 4d10. »
 * CHOIX du joueur — `resolveManannPriest` tranche.
 */
export function ManannPriestModal() {
  const p = useGame((s) => s.pendingManannPriest);
  const money = useGame((s) => s.money);
  const resolve = useGame((s) => s.resolveManannPriest);
  if (!p) return null;
  const affordable = canAfford(money, p.cost);
  return (
    <Modal title="⛪ Un Prêtre de Manann s'avance…" variant="test">
      <p className="rm-log">
        Il s'exclame que vous avez courroucé Manann par votre impiété et que votre bateau doit être
        purifié. Payez <Coins money={p.cost} /> pour une bénédiction, ou refusez et laissez l'Humeur
        de Manann chuter de 4d10.
      </p>
      <ChoiceButtons
        options={[
          { key: 'payer', label: <>⚓ Payer (<Coins money={p.cost} />)</>, primary: true, disabled: !affordable, onSelect: () => resolve(true), title: affordable ? 'Payer la bénédiction' : 'La bourse ne suit pas' },
          { key: 'refuser', label: '🔱 Refuser (−4d10 Humeur de Manann)', onSelect: () => resolve(false), title: 'Refuser la bénédiction — Manann reste courroucé' },
        ]}
      />
    </Modal>
  );
}
