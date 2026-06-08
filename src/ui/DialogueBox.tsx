import { useGame } from '../state/store';
import { condMet } from '../state/scene';
import { canAfford, formatMoney, toMoney } from '../engine/money';

export function DialogueBox() {
  const dialogue = useGame((s) => s.dialogue);
  const flags = useGame((s) => s.flags);
  const money = useGame((s) => s.money);
  const choose = useGame((s) => s.chooseDialogue);
  if (!dialogue) return null;
  const node = dialogue.dialogue.nodes.find((n) => n.id === dialogue.nodeId);
  if (!node) return null;

  const visible = node.choices
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.condition || condMet(c.condition, flags));

  return (
    <div className="dialogue-box">
      {node.speaker && <div className="dlg-speaker">{node.speaker}</div>}
      <p className="dlg-text">{node.text}</p>
      <div className="dlg-choices">
        {visible.map(({ c, i }) => {
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
              {c.text}
              {cost && ` — ${formatMoney(cost)}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

