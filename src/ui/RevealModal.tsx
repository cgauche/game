import { useGame, type RevealEntry } from '../state/store';
import { Modal } from './Modal';
import { Dice } from './Dice';
import { CombatantBadge } from './CombatantBadge';
import { conditionMeta } from '../gameIso/effectIcons';
import type { Combatant } from '../engine/types';

const ICON: Record<RevealEntry['kind'], string> = {
  miscast: '🌀',
  critical: '💥',
  assommante: '🌟',
  backstab: '🗡️',
  calme: '😱',
  round: '⏳',
};

/**
 * Corps riche d'un Coup Critique (qui inflige → arme → victime, le dé, la localisation FR, les Blessures
 * ignorant BE+PA, les États, et chaque effet AVEC son explication RAW). PARTAGÉ par la révélation témoin
 * ET la modale de déviation (même rendu — la déviation fusionne choix Dévier/Subir et révélation).
 */
export function CriticalBody({ entry, actor, subject }: { entry: RevealEntry; actor?: Combatant; subject?: Combatant }) {
  return (
    <>
      {(actor || subject) && (
        <div className="rm-vs">
          {actor && <CombatantBadge combatant={actor} />}
          <span className="rm-vs-arrow">
            <span className="rm-weapon">{entry.weapon ?? 'Mains nues'}</span>
            <br />→
          </span>
          {subject && <CombatantBadge combatant={subject} />}
        </div>
      )}

      <div className="test-result fail">
        {entry.dice != null && <span className="dice"><Dice roll={entry.dice} /></span>}
        <span className="verdict">{entry.lines[0] ?? ''}</span>
      </div>

      {entry.crit && (
        <div className="crit-stats">
          <span className="crit-stat" title="Blessures du Coup Critique : elles ignorent l'Endurance ET l'Armure (LDB 18 l.30).">
            💥 {entry.crit.woundsLost} Blessure{entry.crit.woundsLost > 1 ? 's' : ''}
          </span>
          {entry.crit.conditions?.map((c) => (
            <span key={c.name} className="crit-cond" title={`État ${c.name}`}>
              {conditionMeta(c.name).icon} {c.name}
              {c.value > 1 ? ` ×${c.value}` : ''}
            </span>
          ))}
        </div>
      )}

      {entry.details && entry.details.length > 0 ? (
        <div className="crit-effects">
          <div className="mini-title">Effets &amp; séquelles</div>
          {entry.details.map((d, i) => (
            <div key={i} className="crit-effect">
              <span className="ce-text">{d.text}</span>
              {d.note && <span className="ce-note">{d.note}</span>}
            </div>
          ))}
        </div>
      ) : (
        entry.lines.slice(1).map((l, i) => (
          <p key={i} className="rm-log">
            {l}
          </p>
        ))
      )}
    </>
  );
}

/**
 * Modale de révélation témoin (jet subi / sur table / d'entretien) — cadre + sujet via `Modal`.
 * Pour un COUP CRITIQUE, panneau COMPLET via `CriticalBody`.
 */
export function RevealModalView({ entry, subject, actor, onDismiss }: {
  entry: RevealEntry;
  subject?: Combatant;
  actor?: Combatant;
  onDismiss: () => void;
}) {
  const isCrit = entry.kind === 'critical';
  return (
    <Modal title={<>{ICON[entry.kind]} {entry.title}</>} subject={isCrit ? undefined : subject} variant="test">
      {isCrit ? (
        <CriticalBody entry={entry} actor={actor} subject={subject} />
      ) : (
        <>
          <div className="test-result fail">
            {entry.dice != null && <span className="dice"><Dice roll={entry.dice} /></span>}
            <span className="verdict">{entry.lines[0] ?? ''}</span>
          </div>
          {entry.lines.slice(1).map((l, i) => (
            <p key={i} className="rm-log">
              {l}
            </p>
          ))}
        </>
      )}

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onDismiss}>
          Continuer
        </button>
      </div>
    </Modal>
  );
}

/** File de révélation témoin : affiche le jet en tête, « Continuer » dépile (LDB — montrer le dé). */
export function RevealModal() {
  const reveals = useGame((s) => s.pendingReveals);
  const battle = useGame((s) => s.battle);
  const dismiss = useGame((s) => s.dismissReveal);
  if (!reveals.length) return null;
  const entry = reveals[0];
  const find = (id?: string) => (id && battle ? battle.combatants.find((c) => c.id === id) : undefined);
  return <RevealModalView entry={entry} subject={find(entry.subjectId)} actor={find(entry.actorId)} onDismiss={dismiss} />;
}
