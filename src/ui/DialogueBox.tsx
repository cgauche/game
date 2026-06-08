import { useGame } from '../state/store';
import { condMet } from '../state/scene';

export function DialogueBox() {
  const dialogue = useGame((s) => s.dialogue);
  const flags = useGame((s) => s.flags);
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
        {visible.map(({ c, i }) => (
          <button key={i} className="btn dlg-choice" onClick={() => choose(i)}>
            {c.text}
          </button>
        ))}
      </div>
    </div>
  );
}

