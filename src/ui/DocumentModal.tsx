import { useGame } from '../state/store';
import { Modal } from './Modal';
import { ParchmentCard } from './ParchmentCard';
import { Prose } from './Prose';

/**
 * Lecteur de document/handout remis aux joueurs (brique « inventaire/handouts ») : la MODALE porte le
 * titre, la CARTE-PARCHEMIN porte la matière (aucun second titre à l'intérieur), et le texte est rendu
 * par la primitive unique de prose. L'écran ne déclare que sa largeur.
 */
export function DocumentModal() {
  const doc = useGame((s) => s.document);
  const close = useGame((s) => s.closeDocument);
  if (!doc) return null;
  return (
    <Modal title={doc.title} variant="plain" className="document-modal" onClose={close} backdropClose>
      <ParchmentCard>
        <Prose md={doc.text} />
      </ParchmentCard>
      <button className="btn" onClick={close}>
        Fermer
      </button>
    </Modal>
  );
}
