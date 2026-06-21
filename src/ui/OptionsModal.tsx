import { useEffect, useState } from 'react';
import { useGame } from '../state/store';
import { KEYBINDINGS, effectiveCodes, keyLabel } from '../state/keybindings';
import { Modal } from './Modal';

/**
 * Écran Options — REMAP clavier (1ʳᵉ pièce). Liste les raccourcis de jeu (registre `keybindings`) et
 * permet de réassigner chaque touche : un clic arme la capture, la PROCHAINE touche pressée devient le
 * binding (par POSITION physique `event.code` → AZERTY-safe). Échap pendant la capture = annuler.
 * « Réinitialiser » efface toutes les surcharges. (Volume, reduce-motion, vitesse — à venir.)
 */
export function OptionsModal({ onClose }: { onClose: () => void }) {
  const keyOverrides = useGame((s) => s.keyOverrides);
  const setKeyBinding = useGame((s) => s.setKeyBinding);
  const resetKeyBindings = useGame((s) => s.resetKeyBindings);
  const [rebinding, setRebinding] = useState<string | null>(null);

  // Capture de la prochaine touche pour le raccourci en cours de remap. EN CAPTURE + stop immédiat :
  // passe AVANT le hook de jeu (useGameKeyboard) pour ne pas déclencher un raccourci pendant la saisie.
  useEffect(() => {
    if (!rebinding) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code !== 'Escape') setKeyBinding(rebinding, e.code); // Échap = annule la capture sans changer
      setRebinding(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [rebinding, setKeyBinding]);

  return (
    <Modal title="Options — Clavier" variant="test" onClose={onClose}>
      <div className="opt-keys">
        {KEYBINDINGS.map((b) => {
          const code = effectiveCodes(b, keyOverrides)[0];
          const remapped = !!keyOverrides[b.id];
          return (
            <div className="opt-key-row" key={b.id}>
              <span className="opt-key-label">{b.label}</span>
              <button
                type="button"
                className={`btn small ${rebinding === b.id ? 'btn-primary' : ''}`}
                onClick={() => setRebinding(b.id)}
                title={remapped ? 'Touche personnalisée — clic pour réassigner' : 'Clic pour réassigner'}
              >
                {rebinding === b.id ? 'Appuyez sur une touche…' : keyLabel(code)}
              </button>
            </div>
          );
        })}
      </div>
      <p className="hint">Touches par POSITION physique (le binding suit l’endroit de la touche, AZERTY comme QWERTY). Échap pendant la capture = annuler.</p>
      <div className="modal-actions">
        <button type="button" className="btn small" onClick={() => resetKeyBindings()}>Réinitialiser les touches</button>
        <button type="button" className="btn" onClick={onClose}>Fermer</button>
      </div>
    </Modal>
  );
}
