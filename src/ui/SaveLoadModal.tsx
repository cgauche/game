import { useRef, useState } from 'react';
import { useGame } from '../state/store';
import { listSaves, readSlot, deleteSlot, exportSave, SAVE_SLOTS, AUTO_SLOT, type SaveSlot, type AnySlot, type SaveMeta } from '../state/saves';
import { downloadText } from '../state/fileIo';
import { GameDate } from './GameDate';
import { Modal } from './Modal';
import { t } from '../i18n';

/**
 * Sauvegarde / chargement (Jalon 5) — 3 emplacements manuels + 1 emplacement AUTO (écrit aux
 * checkpoints d'entrée de scène), localStorage + export/import JSON. `mode 'save'` (en jeu, hors
 * combat) écrit dans les slots manuels ; `mode 'load'` ne propose que Charger/Exporter/Supprimer.
 * L'emplacement AUTO est CHARGEABLE mais jamais écrit à la main (pas de bouton Sauvegarder).
 */
const autoMetaOf = (): SaveMeta | null => {
  const s = readSlot(AUTO_SLOT);
  return s ? { version: s.version, savedAt: s.savedAt, sceneLabel: s.sceneLabel, gameTime: s.gameTime } : null;
};

export function SaveLoadModal({ mode, onClose }: { mode: 'save' | 'load'; onClose: () => void }) {
  const saveGame = useGame((s) => s.saveGame);
  const loadGame = useGame((s) => s.loadGame);
  const importGame = useGame((s) => s.importGame);
  const [metas, setMetas] = useState(listSaves());
  const [autoMeta, setAutoMeta] = useState(autoMetaOf);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => { setMetas(listSaves()); setAutoMeta(autoMetaOf()); };

  const onSave = (slot: SaveSlot) => { setError(saveGame(slot) ? null : t('saveload.error.save')); refresh(); };
  const onLoad = (slot: AnySlot) => { if (loadGame(slot)) onClose(); else setError(t('saveload.error.load')); };
  const onExport = (slot: AnySlot) => { const save = readSlot(slot); if (save) downloadText(`wfrp4-sauvegarde-${slot}.json`, exportSave(save)); };
  const onDelete = (slot: AnySlot) => { deleteSlot(slot); refresh(); };
  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const json = await file.text();
    if (importGame(json)) onClose();
    else setError(t('saveload.error.import'));
  };

  // Une RANGÉE de slot — partagée par les emplacements manuels (1-3) ET l'emplacement AUTO. `canSave`
  // = bouton Sauvegarder (manuel + mode save) ; l'AUTO ne l'a jamais (écrit par le jeu, pas à la main).
  const slotRow = (slot: AnySlot, label: string, m: SaveMeta | null, canSave: boolean) => (
    <div className="save-slot" key={String(slot)}>
      <div className="save-slot-meta">
        <strong>{label}</strong>
        {m ? (
          <span className="save-slot-info">{m.sceneLabel} · <GameDate time={m.gameTime} /> · {new Date(m.savedAt).toLocaleString('fr-FR')}</span>
        ) : (
          <span className="save-slot-info empty">{t('saveload.slot.empty')}</span>
        )}
      </div>
      <div className="save-slot-actions">
        {canSave && (
          <button type="button" className="btn small btn-primary" onClick={() => onSave(slot as SaveSlot)}>{t('saveload.btn.save')}</button>
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

  return (
    <Modal title={mode === 'save' ? t('saveload.title.save') : t('saveload.title.load')} variant="test" onClose={onClose}>
      <div className="save-slots">
        {SAVE_SLOTS.map((slot) => slotRow(slot, t('saveload.slot.label', { n: slot }), metas[slot - 1], mode === 'save'))}
        {autoMeta && slotRow(AUTO_SLOT, 'Auto ⟳', autoMeta, false)}
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
