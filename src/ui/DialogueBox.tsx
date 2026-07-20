import { useMemo } from 'react';
import { useGame } from '../state/store';
import { evalCondition, conditionCtx } from '../state/flow';
import { partyMoneyTotal } from '../state/bourseFlow';
import { canAfford, toMoney } from '../engine/money';
import { Coins } from './Coins';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import { SpeakerBanner } from './SpeakerBanner';

export function DialogueBox() {
  const dialogue = useGame((s) => s.dialogue);
  const flags = useGame((s) => s.flags);
  const gameTime = useGame((s) => s.gameTime);
  const party = useGame((s) => s.party);
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]); // affordabilité/condition = somme des bourses du groupe
  const scene = useGame((s) => s.scene);
  const choose = useGame((s) => s.chooseDialogue);
  if (!dialogue) return null;
  const node = dialogue.dialogue.nodes.find((n) => n.id === dialogue.nodeId);
  if (!node) return null;

  // Portrait de l'interlocuteur (l'entité avec qui on parle) — résolu par SpeakerBanner (pickBackend).
  const speakerEnt = dialogue.speakerId ? scene?.entities.find((e) => e.id === dialogue.speakerId) : undefined;
  const speakerName = node.speaker ?? speakerEnt?.label;

  const visible = node.choices
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.when || evalCondition(c.when, conditionCtx({ flags, gameTime, party, money })));

  return (
    <SpeakerBanner ent={speakerEnt} label={speakerName} variant="dialogue" choices={visible.map(({ c, i }) => {
      // Option payante : affiche le prix et se désactive si on ne peut pas payer (répétable sinon).
      const cost = c.cost && toMoney(c.cost);
      const affordable = !cost || canAfford(money, cost);
      return (
        <button
          key={i}
          className="btn dlg-choice"
          disabled={!affordable}
          title={!affordable ? 'Pas assez d’argent' : undefined}
          onClick={() => choose(i)}
        >
          {c.icon && <Icon id={c.icon as IconIdInput} size="sm" />}
          <span className="dlg-choice-text">{c.text}</span>
          {cost && <span className="dlg-choice-cost"><Coins money={cost} /></span>}
        </button>
      );
    })}>
      {node.text}
    </SpeakerBanner>
  );
}
