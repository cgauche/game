import { useGame } from '../state/store';
import { Modal } from './Modal';
import { ChoiceButtons } from './OptionChooser';

/**
 * Déstabilisante (Aux Armes p.89) : le héros a touché avec une arme Déstabilisante et dispose des
 * Avantages requis. Il choisit de les dépenser pour tenter un Test opposé Force/Athlétisme qui, gagné,
 * met l'adversaire À Terre — ou de renoncer (rien n'est dépensé).
 */
export function KnockdownModal() {
  const pk = useGame((s) => s.pendingKnockdown);
  const battle = useGame((s) => s.battle);
  const resolve = useGame((s) => s.knockdownResolve);
  if (!pk || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pk.attackerId);
  const target = battle.combatants.find((c) => c.id === pk.targetId);
  if (!attacker || !target) return null;
  return (
    <Modal title="🤜 Déstabilisante" variant="test">
      <p className="rm-log">
        <b>{attacker.name}</b> touche <b>{target.name}</b> avec <b>{pk.weaponName}</b> et peut chercher à le renverser.
      </p>
      <p className="rm-log">
        Renverser : dépenser <b>{pk.advantageCost} Avantages</b> puis Test opposé de <b>Force/Athlétisme</b>. Victoire →{' '}
        {target.name} subit l'État <b>{pk.condition}</b> ; échec → rien (les Avantages sont tout de même dépensés).
      </p>
      <ChoiceButtons
        options={[
          { key: 'no', label: 'Renoncer', onSelect: () => resolve(false), title: 'Ne pas dépenser d’Avantages' },
          { key: 'yes', label: `🤜 Renverser (${pk.advantageCost} Av)`, primary: true, onSelect: () => resolve(true), title: 'Dépenser les Avantages et tenter le renversement (Test opposé)' },
        ]}
      />
    </Modal>
  );
}
