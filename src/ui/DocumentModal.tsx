import { useGame } from '../state/store';

/** Lecteur de document/handout remis aux joueurs (brique « inventaire/handouts »). */
export function DocumentModal() {
  const doc = useGame((s) => s.document);
  const close = useGame((s) => s.closeDocument);
  if (!doc) return null;
  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal document-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="doc-title">{doc.title}</h3>
        <div className="doc-text">
          {doc.text.split('\n').map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        <button className="btn" onClick={close}>
          Fermer
        </button>
      </div>
    </div>
  );
}
