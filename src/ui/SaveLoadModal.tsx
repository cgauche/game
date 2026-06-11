import { useRef, useState } from 'react';
import { useGame } from '../state/store';
import { listSaves, readSlot, deleteSlot, exportSave, SAVE_SLOTS, type SaveSlot } from '../state/saves';
import { formatImperial } from '../engine/clock';
import { Modal } from './Modal';

/**
 * Sauvegarde / chargement (Jalon 5) — 3 emplacements localStorage + export/import JSON.
 * `mode 'save'` (en jeu, hors combat) permet d'écrire ; `mode 'load'` (menu principal ou en jeu)
 * ne propose que Charger/Exporter/Importer/Supprimer.
 */
export function SaveLoadModal({ mode, onClose }: { mode: 'save' | 'load'; onClose: () => void }) {
  const saveGame = useGame((s) => s.saveGame);
  const loadGame = useGame((s) => s.loadGame);
  const importGame = useGame((s) => s.importGame);
  const [metas, setMetas] = useState(listSaves());
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => setMetas(listSaves());

  const onSave = (slot: SaveSlot) => {
    setError(saveGame(slot) ? null : 'Sauvegarde impossible (stockage indisponible ou plein).');
    refresh();
  };
  const onLoad = (slot: SaveSlot) => {
    if (loadGame(slot)) onClose();
    else setError('Emplacement vide ou incompatible.');
  };
  const onExport = (slot: SaveSlot) => {
    const save = readSlot(slot);
    if (!save) return;
    const blob = new Blob([exportSave(save)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wfrp4-sauvegarde-${slot}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const onDelete = (slot: SaveSlot) => {
    deleteSlot(slot);
    refresh();
  };
  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const json = await file.text();
    if (importGame(json)) onClose();
    else setError('Fichier de sauvegarde invalide ou de version inconnue.');
  };

  return (
    <Modal title={mode === 'save' ? '💾 Sauvegarder' : '📂 Charger une partie'} variant="test" onClose={onClose}>
      <div className="save-slots">
        {SAVE_SLOTS.map((slot) => {
          const m = metas[slot - 1];
          return (
            <div className="save-slot" key={slot}>
              <div className="save-slot-meta">
                <strong>Emplacement {slot}</strong>
                {m ? (
                  <span className="save-slot-info">
                    {m.sceneLabel} · {formatImperial(m.gameTime)} · {new Date(m.savedAt).toLocaleString('fr-FR')}
                  </span>
                ) : (
                  <span className="save-slot-info empty">— vide —</span>
                )}
              </div>
              <div className="save-slot-actions">
                {mode === 'save' && (
                  <button type="button" className="btn small btn-primary" onClick={() => onSave(slot)}>
                    Sauvegarder
                  </button>
                )}
                {m && (
                  <>
                    <button type="button" className="btn small" onClick={() => onLoad(slot)}>Charger</button>
                    <button type="button" className="btn small" onClick={() => onExport(slot)} title="Télécharger la sauvegarde (JSON)">Exporter</button>
                    <button type="button" className="btn small" onClick={() => onDelete(slot)} title="Effacer cet emplacement">✕</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn small" onClick={() => fileRef.current?.click()} title="Charger une sauvegarde depuis un fichier JSON exporté">
          📥 Importer un fichier…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => void onImportFile(e.target.files?.[0])}
        />
        <button type="button" className="btn" onClick={onClose}>Fermer</button>
      </div>
      {error && <p className="save-error">{error}</p>}
    </Modal>
  );
}
