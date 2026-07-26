/** Relecture de l'historique de dialogue (#718 dernier lot) — surface de lecture JOUEUR du journal
 *  de conversations. Lit `dialogueHistory` (état runtime déjà tenu par le store, `recordTurn`) —
 *  aucune logique n'est ajoutée ici, seulement sa présentation regroupée en conversations. */
import { useState } from 'react';
import { ScreenShell } from './ScreenShell';
import { MasterDetail } from './MasterDetail';
import { Prose } from './Prose';
import { Icon } from './Icon';
import { GameDate } from './GameDate';
import { ListRow } from './ListRow';
import { useGame } from '../state/store';
import type { DialogueTurn } from '../state/dialogueHistory';

/** Une conversation = un run CONTIGU de tours partageant le même `dialogueId` ET `sceneId` — un
 *  dialogue se termine toujours avant qu'un autre s'ouvre, jamais d'entrelacement. */
export interface DialogueConversation {
  speaker?: string;
  at: number;
  sceneId?: string;
  dialogueId: string;
  turns: DialogueTurn[];
}

/** Pure — regroupe une liste CHRONOLOGIQUE de tours en conversations (nouveau groupe dès que
 *  `dialogueId`/`sceneId` change par rapport au tour précédent). */
export function groupConversations(turns: DialogueTurn[]): DialogueConversation[] {
  const groups: DialogueConversation[] = [];
  for (const turn of turns) {
    const last = groups[groups.length - 1];
    if (last && last.dialogueId === turn.dialogueId && last.sceneId === turn.sceneId) {
      last.turns.push(turn);
    } else {
      groups.push({ speaker: turn.speaker, at: turn.at, sceneId: turn.sceneId, dialogueId: turn.dialogueId, turns: [turn] });
    }
  }
  return groups;
}

export function DialogueHistoryScreen({ onClose }: { onClose: () => void }) {
  const dialogueHistory = useGame((s) => s.dialogueHistory);
  // Le plus RÉCENT en tête — `groupConversations` rend l'ordre chronologique, on l'inverse pour l'affichage.
  const conversations = groupConversations(dialogueHistory).slice().reverse();
  const aucune = conversations.length === 0;

  const [selIdx, setSelIdx] = useState(0);

  const list = aucune ? (
    <p className="empty">Aucune conversation enregistrée.</p>
  ) : (
    <div className="stack">
      {conversations.map((conv, i) => (
        <ListRow
          key={`${conv.dialogueId}-${conv.sceneId ?? ''}-${conv.at}-${i}`}
          variant="codex"
          selected={selIdx === i}
          onClick={() => setSelIdx(i)}
          label={conv.speaker ?? 'Conversation'}
        >
          <GameDate time={conv.at} />
        </ListRow>
      ))}
    </div>
  );

  const selected = conversations[selIdx];

  const detail = aucune ? null : !selected ? (
    <p className="empty">Sélectionnez une conversation.</p>
  ) : (
    <div className="stack">
      {selected.turns.map((turn, i) => (
        <div key={i} className="stack">
          {turn.speaker && <div className="mini-title">{turn.speaker}</div>}
          <Prose md={turn.nodeText} />
          <p className="dlg-history-reply">{turn.choiceText}</p>
        </div>
      ))}
    </div>
  );

  return (
    <ScreenShell title={<><Icon id="journal/dialogue" size="lg" /> Conversations</>} onClose={onClose} body="centered">
      <MasterDetail list={list} detail={detail} listLabel="Conversations" />
    </ScreenShell>
  );
}
