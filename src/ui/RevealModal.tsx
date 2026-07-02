import { useEffect, useState } from 'react';
import { useGame, type RevealEntry } from '../state/store';
import { Modal } from './Modal';
import { TableRollLine } from './RollLine';
import { VsHeader } from './VsHeader';
import { conditionMeta } from '../gameIso/effectIcons';
import { Icon } from './Icon';
import type { IconId } from './icons';
import type { Combatant } from '../engine/types';

/** Auto-fermeture des révélations INFORMATIVES (arbitrage 2026-06-11) : délai court pour le
 *  mineur, long AVEC barre de temps pour le grave (critique/mutation d'un héros) — un clic
 *  ferme toujours avant. */
const AUTO_CLOSE_MS: Record<NonNullable<RevealEntry['severity']>, number> = { minor: 3500, grave: 9000 };

const ICON: Record<RevealEntry['kind'], IconId> = {
  miscast: 'nav/dice', // tirage sur la Table des Imparfaites
  critical: 'journal/critical',
  assommante: 'condition/stunned',
  backstab: 'action/attack',
  calme: 'flag/fear',
  round: 'journal/round',
  mutation: 'nav/mutation',
  effet: 'journal/info', // effet d'AUTEUR (scénario) : Blessure Critique / maladie infligée
  sceneEntry: 'nav/entry-point', // entrée de zone : mise en contexte narrative (N1 — « le Journal n'est pas lu »)
};

/** Nom de la table tirée pour la rangée d100 (présentation canonique `TableRollLine`). */
const TABLE_LABEL: Partial<Record<RevealEntry['kind'], string>> = {
  miscast: 'Table des Imparfaites',
  critical: 'Table des Critiques',
  mutation: 'Tableau des Corruptions',
};

/**
 * Corps riche d'un Coup Critique (qui inflige → arme → victime, le dé, la localisation FR, les Blessures
 * ignorant BE+PA, les États, et chaque effet AVEC son explication RAW). PARTAGÉ par la révélation témoin
 * ET la modale de déviation (même rendu — la déviation fusionne choix Dévier/Subir et révélation).
 */
export function CriticalBody({ entry, actor, subject }: { entry: RevealEntry; actor?: Combatant; subject?: Combatant }) {
  return (
    <>
      <VsHeader actor={actor} target={subject} label={entry.weapon ?? 'Mains nues'} />

      <TableRollLine table={TABLE_LABEL[entry.kind] ?? entry.title} roll={entry.dice} result={entry.lines[0] ?? ''} />

      {entry.crit && (
        <div className="crit-stats">
          <span className="crit-stat" title="Blessures du Coup Critique : elles ignorent l'Endurance ET l'Armure.">
            <Icon id="resource/wounds" size="sm" /> {entry.crit.woundsLost} Blessure{entry.crit.woundsLost > 1 ? 's' : ''}
          </span>
          {entry.crit.conditions?.map((c) => (
            <span key={c.name} className="crit-cond" title={`État ${c.name}`}>
              <Icon id={conditionMeta(c.name).icon} size="sm" /> {c.name}
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
  const isScene = entry.kind === 'sceneEntry';
  // Auto-fermeture par gravité — relancée à chaque NOUVELLE entrée de la file (clé = entry).
  const ms = entry.severity ? AUTO_CLOSE_MS[entry.severity] : null;
  const [armedAt, setArmedAt] = useState(0);
  useEffect(() => {
    setArmedAt(Date.now());
    if (ms == null) return;
    const t = window.setTimeout(onDismiss, ms);
    return () => window.clearTimeout(t);
    // réarmé par ENTRÉE de la file (pas par re-render) — deps volontairement réduites
  }, [entry]); // eslint-disable-line
  return (
    <Modal title={<><Icon id={ICON[entry.kind]} /> {entry.title}</>} subject={isCrit ? undefined : subject} variant="test">
      {isCrit ? (
        <CriticalBody entry={entry} actor={actor} subject={subject} />
      ) : isScene ? (
        <div className="scene-intro">
          {entry.lines.map((l, i) => (
            <p key={i} className="rm-log">
              {l}
            </p>
          ))}
        </div>
      ) : (
        <>
          <TableRollLine table={TABLE_LABEL[entry.kind] ?? entry.title} roll={entry.dice} result={entry.lines[0] ?? ''} />
          {entry.lines.slice(1).map((l, i) => (
            <p key={i} className="rm-log">
              {l}
            </p>
          ))}
        </>
      )}

      {/* Barre de temps : visible sur le GRAVE seulement (le mineur disparaît sans cérémonie). */}
      {ms != null && entry.severity === 'grave' && (
        <div className="reveal-timer" key={armedAt}>
          <i style={{ animationDuration: `${ms}ms` }} />
        </div>
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
