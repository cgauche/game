import { useGame } from '../state/store';
import { Modal } from './Modal';

/** Lecteur de document/handout remis aux joueurs (brique « inventaire/handouts »). */
export function DocumentModal() {
  const doc = useGame((s) => s.document);
  const close = useGame((s) => s.closeDocument);
  if (!doc) return null;
  return (
    <Modal title={doc.title} variant="plain" className="document-modal" onClose={close} backdropClose>
      <div className="doc-text">
        {doc.text.split('\n').map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
      <button className="btn" onClick={close}>
        Fermer
      </button>
    </Modal>
  );
}
