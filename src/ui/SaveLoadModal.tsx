import { useRef, useState } from 'react';
import { useGame } from '../state/store';
import { listSaves, readSlot, deleteSlot, exportSave, SAVE_SLOTS, type SaveSlot } from '../state/saves';
import { downloadText } from '../state/fileIo';
import { formatImperial } from '../engine/clock';
import { Modal } from './Modal';
import { t } from '../i18n';

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
    setError(saveGame(slot) ? null : t('saveload.error.save'));
    refresh();
  };
  const onLoad = (slot: SaveSlot) => {
    if (loadGame(slot)) onClose();
    else setError(t('saveload.error.load'));
  };
  const onExport = (slot: SaveSlot) => {
    const save = readSlot(slot);
    if (save) downloadText(`wfrp4-sauvegarde-${slot}.json`, exportSave(save));
  };
  const onDelete = (slot: SaveSlot) => {
    deleteSlot(slot);
    refresh();
  };
  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const json = await file.text();
    if (importGame(json)) onClose();
    else setError(t('saveload.error.import'));
  };

  return (
    <Modal title={mode === 'save' ? t('saveload.title.save') : t('saveload.title.load')} variant="test" onClose={onClose}>
      <div className="save-slots">
        {SAVE_SLOTS.map((slot) => {
          const m = metas[slot - 1];
          return (
            <div className="save-slot" key={slot}>
              <div className="save-slot-meta">
                <strong>{t('saveload.slot.label', { n: slot })}</strong>
                {m ? (
                  <span className="save-slot-info">
                    {m.sceneLabel} · {formatImperial(m.gameTime)} · {new Date(m.savedAt).toLocaleString('fr-FR')}
                  </span>
                ) : (
                  <span className="save-slot-info empty">{t('saveload.slot.empty')}</span>
                )}
              </div>
              <div className="save-slot-actions">
                {mode === 'save' && (
                  <button type="button" className="btn small btn-primary" onClick={() => onSave(slot)}>
                    {t('saveload.btn.save')}
                  </button>
                )}
                {m && (
                  <>
                    <button type="button" className="btn small" onClick={() => onLoad(slot)}>{t('saveload.btn.load')}</button>
                    <button type="button" className="btn small" onClick={() => onExport(slot)} title={t('saveload.btn.export.title')}>{t('saveload.btn.export')}</button>
                    <button type="button" className="btn small" onClick={() => onDelete(slot)} title={t('saveload.btn.delete.title')}>{t('saveload.btn.delete')}</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn small" onClick={() => fileRef.current?.click()} title={t('saveload.import.btn.title')}>
          {t('saveload.import.btn')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => void onImportFile(e.target.files?.[0])}
        />
        <button type="button" className="btn" onClick={onClose}>{t('saveload.btn.close')}</button>
      </div>
      {error && <p className="save-error">{error}</p>}
    </Modal>
  );
}
