import { useGame } from '../state/store';
import { evalCondition } from '../state/flow';
import { canAfford, formatMoney, toMoney } from '../engine/money';
import { pickBackend } from '../gameIso/pickBackend';

export function DialogueBox() {
  const dialogue = useGame((s) => s.dialogue);
  const flags = useGame((s) => s.flags);
  const gameTime = useGame((s) => s.gameTime);
  const money = useGame((s) => s.money);
  const scene = useGame((s) => s.scene);
  const choose = useGame((s) => s.chooseDialogue);
  if (!dialogue) return null;
  const node = dialogue.dialogue.nodes.find((n) => n.id === dialogue.nodeId);
  if (!node) return null;

  // Portrait de l'interlocuteur (l'entité avec qui on parle) — cadrage visage, même brique que le HUD.
  const speakerEnt = dialogue.speakerId ? scene?.entities.find((e) => e.id === dialogue.speakerId) : undefined;
  const portrait = speakerEnt ? pickBackend({ kind: 'sceneEntity', ent: speakerEnt }, 'top') : null;
  const speakerName = node.speaker ?? speakerEnt?.label;

  const visible = node.choices
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.when || evalCondition(c.when, { flags, gameTime }));

  return (
    <div className="dialogue-box">
      <div className="dlg-head">
        {portrait && (
          <span className="dlg-portrait">
            <svg viewBox={portrait.portraitBox} preserveAspectRatio="xMidYMid slice">
              {portrait.body}
            </svg>
          </span>
        )}
        <div className="dlg-body">
          {speakerName && <div className="dlg-speaker">{speakerName}</div>}
          <p className="dlg-text">{node.text}</p>
        </div>
      </div>
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
              <span className="dlg-choice-text">{c.text}</span>
              {cost && <span className="dlg-choice-cost">{formatMoney(cost)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
