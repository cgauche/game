import { useGame } from '../state/store';
import { Modal } from './Modal';
import { EmbeddedShell } from './RollShell';
import { ChoiceButtons } from './OptionChooser';
import { Coins } from './Coins';
import { canAfford } from '../engine/money';
import { partyMoneyTotal } from '../state/bourseFlow';
import { Icon } from './Icon';

/**
 * Prêtre de Manann (MDG 15 l.246, événement de port) : « Vous pouvez soit payer 1d10 CO plus la
 * Taille du navire en pistoles pour une bénédiction, soit réduire l'Humeur de Manann de 4d10. »
 * CHOIX du joueur — `resolveManannPriest` tranche.
 *
 * `embedded` (même patron que `ShoreLeaveBody`) : rendu SANS `Modal`, composé par l'onglet Escale du
 * hub de port (`PortView.EscaleTab`) — une SEULE prose de la décision, jamais une 2e copie divergente.
 */
export function ManannBody({ embedded = false }: { embedded?: boolean } = {}) {
  const p = useGame((s) => s.pendingManannPriest);
  const money = useGame((s) => partyMoneyTotal(() => s));
  const resolve = useGame((s) => s.resolveManannPriest);
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  if (!p) return null;
  const affordable = canAfford(money, p.cost);
  const title = <><Icon id="faith/church" size="sm" /> Un Prêtre de Manann s'avance…</>;
  const body = (
    <>
      <p className="rm-log">
        Il s'exclame que vous avez courroucé Manann par votre impiété et que votre bateau doit être
        purifié. Payez <Coins money={p.cost} /> pour une bénédiction, ou refusez et laissez l'Humeur
        de Manann chuter de 4d10.
      </p>
      <ChoiceButtons
        options={[
          { key: 'payer', label: <><Icon id="resource/gold-purse" size="sm" /> Payer (<Coins money={p.cost} />)</>, primary: true, disabled: isGuest || !affordable, onSelect: () => resolve(true), title: isGuest ? 'L\'hôte décide.' : affordable ? 'Payer la bénédiction' : 'La bourse ne suit pas' },
          { key: 'refuser', label: <><Icon id="faith/trident" size="sm" /> Refuser (−4d10 Humeur de Manann)</>, disabled: isGuest, onSelect: () => resolve(false), title: isGuest ? 'L\'hôte décide.' : 'Refuser la bénédiction — Manann reste courroucé' },
        ]}
      />
    </>
  );
  if (embedded) return <EmbeddedShell title={title}>{body}</EmbeddedShell>;
  // Fenêtre HORS jet (décision d'escale) : pas de géométrie de jet (voile allégé + ancrage haut).
  return <Modal title={title} variant="plain">{body}</Modal>;
}

export function ManannPriestModal() {
  return <ManannBody />;
}
