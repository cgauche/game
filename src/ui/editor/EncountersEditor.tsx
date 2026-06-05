/**
 * Éditeur structuré de rencontres de combat : id + liste d'ennemis
 * (créature du bestiaire + position sur la grille).
 */
import { useState } from 'react';
import { EncounterDef, Dialogue } from '../../state/scene';
import { CreatureData } from '../../data';
import { EffectList } from './EffectList';

export function EncountersEditor({
  encounters,
  creatures,
  dialogues,
  onSave,
  onClose,
}: {
  encounters: EncounterDef[];
  creatures: CreatureData[];
  dialogues: Dialogue[];
  onSave: (e: EncounterDef[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<EncounterDef[]>(() => JSON.parse(JSON.stringify(encounters)));
  const upd = (i: number, patch: Partial<EncounterDef>) => setList(list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const updEnemy = (ei: number, ni: number, patch: any) =>
    upd(ei, { enemies: list[ei].enemies.map((en, j) => (j === ni ? { ...en, ...patch } : en)) });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide enc-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Rencontres de combat</h3>
        <p className="hint">Une rencontre = des ennemis du bestiaire placés sur la grille. Référencée par un effet « Démarrer un combat ».</p>
        <div className="enc-list">
          {list.map((enc, ei) => (
            <div className="enc-card" key={ei}>
              <div className="enc-top">
                <input className="enc-id" value={enc.id} onChange={(e) => upd(ei, { id: e.target.value })} placeholder="id de la rencontre" />
                <button className="btn small danger" onClick={() => setList(list.filter((_, j) => j !== ei))}>
                  Supprimer
                </button>
              </div>
              <div className="enemy-list">
                {enc.enemies.map((en, ni) => (
                  <div className="enemy-row" key={ni}>
                    <select value={en.ref ?? ''} onChange={(e) => updEnemy(ei, ni, { ref: e.target.value })}>
                      <option value="">— créature —</option>
                      {creatures.map((c) => (
                        <option key={c.label} value={c.label}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <label>x<input type="number" value={en.pos.x} onChange={(e) => updEnemy(ei, ni, { pos: { ...en.pos, x: Number(e.target.value) } })} /></label>
                    <label>y<input type="number" value={en.pos.y} onChange={(e) => updEnemy(ei, ni, { pos: { ...en.pos, y: Number(e.target.value) } })} /></label>
                    <button className="btn small danger" onClick={() => upd(ei, { enemies: enc.enemies.filter((_, j) => j !== ni) })}>
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className="btn small"
                  onClick={() => upd(ei, { enemies: [...enc.enemies, { ref: creatures[0]?.label ?? 'Mutant', pos: { x: 0, y: 0 } }] })}
                >
                  + Ennemi
                </button>
              </div>
              <div className="enc-victory">
                <span className="mini-title">À la victoire (récompenses : PX, butin, flag…)</span>
                <EffectList
                  effects={enc.onVictory ?? []}
                  onChange={(eff) => upd(ei, { onVictory: eff })}
                  ctx={{ encounters: list, dialogues }}
                />
              </div>
            </div>
          ))}
        </div>
        <button
          className="btn"
          onClick={() => setList([...list, { id: `enc-${Date.now().toString(36)}`, enemies: [] }])}
        >
          + Nouvelle rencontre
        </button>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onSave(list);
              onClose();
            }}
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
