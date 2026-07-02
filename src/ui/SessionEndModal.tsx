import { useState } from 'react';
import { Modal } from './Modal';
import { useGame } from '../state/store';

type HeroKey = 'ambitionShort' | 'ambitionLong' | 'motivation';

/**
 * Écran de FIN DE SÉANCE (LDB 05 Ambitions + LDB 17 Détermination) — le MJ (ou le groupe) coche les
 * Ambitions accomplies (personnelles et de groupe) et les héros ayant agi selon leur Motivation. « Terminer
 * la séance » octroie les PX d'Ambition (+50 court / +500 long) et regagne la Détermination via
 * `store.endSession`, puis restaure la Chance pour la prochaine séance. Responsive (`.panel-grid`).
 */
export function SessionEndModal({ onClose }: { onClose: () => void }) {
  const party = useGame((s) => s.party.filter((h) => h.kind === 'hero'));
  const endSession = useGame((s) => s.endSession);
  const [heroes, setHeroes] = useState<Record<string, Partial<Record<HeroKey, boolean>>>>({});
  const [group, setGroup] = useState<{ ambitionShort?: boolean; ambitionLong?: boolean }>({});
  const toggle = (id: string, key: HeroKey) =>
    setHeroes((h) => ({ ...h, [id]: { ...h[id], [key]: !h[id]?.[key] } }));
  const confirm = () => { endSession({ heroes, group }); onClose(); };

  return (
    <Modal title="Fin de séance" variant="plain" className="session-end" onClose={onClose} backdropClose>
      <p className="muted">
        Cochez les Ambitions accomplies (+50 PX court terme, +500 long terme — LDB 05) et les héros ayant
        agi selon leur Motivation (+1 Détermination — LDB 17). La Chance du groupe sera restaurée pour la
        prochaine séance.
      </p>
      <section className="hr-group">
        <h4 className="mini-title">Ambitions de groupe</h4>
        <label className="se-check">
          <input type="checkbox" checked={!!group.ambitionShort} onChange={() => setGroup((g) => ({ ...g, ambitionShort: !g.ambitionShort }))} />
          Court terme accomplie (+50 PX à chaque héros)
        </label>
        <label className="se-check">
          <input type="checkbox" checked={!!group.ambitionLong} onChange={() => setGroup((g) => ({ ...g, ambitionLong: !g.ambitionLong }))} />
          Long terme accomplie (+500 PX à chaque héros)
        </label>
      </section>
      <div className="panel-grid">
        {party.map((h) => (
          <section key={h.id} className="se-hero hr-group">
            <h4 className="mini-title">{h.name}</h4>
            <label className="se-check" title={h.details?.ambitionShort ?? 'Aucune Ambition à court terme notée'}>
              <input type="checkbox" checked={!!heroes[h.id]?.ambitionShort} onChange={() => toggle(h.id, 'ambitionShort')} />
              Ambition court terme (+50)
            </label>
            <label className="se-check" title={h.details?.ambitionLong ?? 'Aucune Ambition à long terme notée'}>
              <input type="checkbox" checked={!!heroes[h.id]?.ambitionLong} onChange={() => toggle(h.id, 'ambitionLong')} />
              Ambition long terme (+500)
            </label>
            <label className="se-check" title={h.motivation ?? 'Aucune Motivation notée'}>
              <input type="checkbox" checked={!!heroes[h.id]?.motivation} onChange={() => toggle(h.id, 'motivation')} />
              A agi selon sa Motivation (+1 Détermination)
            </label>
          </section>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={confirm}>Terminer la séance</button>
      </div>
    </Modal>
  );
}
