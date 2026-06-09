import { useGame, type RevealEntry } from '../state/store';
import { TeamPortrait } from './CombatantBadge';
import type { Combatant } from '../engine/types';

const ICON: Record<RevealEntry['kind'], string> = {
  miscast: '🌀',
  critical: '💥',
  assommante: '🌟',
  backstab: '🗡️',
  calme: '😱',
  round: '⏳',
};

/** Vue pure de la modale de révélation témoin (testable sans store). Montre le dé d'un jet subi /
 *  sur table / d'entretien ; pas de Chance (rien à décider) — on acquitte. Quand l'entrée désigne un
 *  combattant (`subject`), on affiche son portrait + nom (« on sait toujours à qui ça s'applique »). */
export function RevealModalView({ entry, subject, onDismiss }: { entry: RevealEntry; subject?: Combatant; onDismiss: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal test-modal">
        <h3>
          {ICON[entry.kind]} {entry.title}
        </h3>
        {subject && (
          <div className="modal-subject">
            <TeamPortrait combatant={subject} size={38} />
            <strong>{subject.name}</strong>
          </div>
        )}
        <div className="test-result fail">
          {entry.dice != null && <span className="dice">{entry.dice === 100 ? '00' : String(entry.dice).padStart(2, '0')}</span>}
          <span className="verdict">{entry.lines[0] ?? ''}</span>
        </div>
        {entry.lines.slice(1).map((l, i) => (
          <p key={i} className="rm-log">
            {l}
          </p>
        ))}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onDismiss}>
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}

/** File de révélation témoin : affiche le jet en tête, « Continuer » dépile (LDB — montrer le dé). */
export function RevealModal() {
  const reveals = useGame((s) => s.pendingReveals);
  const battle = useGame((s) => s.battle);
  const dismiss = useGame((s) => s.dismissReveal);
  if (!reveals.length) return null;
  const entry = reveals[0];
  const subject = entry.subjectId && battle ? battle.combatants.find((c) => c.id === entry.subjectId) : undefined;
  return <RevealModalView entry={entry} subject={subject} onDismiss={dismiss} />;
}
