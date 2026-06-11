/**
 * Éditeur structuré de rencontres de combat : id + liste d'ennemis
 * (créature du bestiaire + position sur la grille).
 */
import { useState } from 'react';
import { EncounterDef, Dialogue } from '../../state/scene';
import { CreatureData } from '../../data';
import { Modal } from '../Modal';
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

  // Cadre partagé <Modal> (variant plain) ; pas de onClose → pas d'Échap/clic-voile (champs de
  // saisie : on confirme via Annuler/Appliquer, jamais de fermeture accidentelle).
  return (
    <Modal title="Rencontres de combat" variant="plain" className="wide enc-modal">
        <p className="hint">Une rencontre = des ennemis du bestiaire placés sur la grille. Référencée par un effet « Démarrer un combat ».</p>
        <div className="enc-list">
          {list.map((enc, ei) => (
            <div className="panel sunken" key={ei}>
              <div className="enc-top">
                <input className="enc-id" value={enc.id} onChange={(e) => upd(ei, { id: e.target.value })} placeholder="id de la rencontre" />
                <button className="btn small danger" onClick={() => setList(list.filter((_, j) => j !== ei))}>
                  Supprimer
                </button>
              </div>
              <div className="enemy-list">
                {enc.enemies.map((en, ni) => (
                  <div key={ni}>
                    <div className="enemy-row">
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
                      {/* Personnalisations d'auteur (édition fine : sélectionner le spawn → Inspector) */}
                      {(en.optionals?.length || en.spells?.length || en.randomChars) ? (
                        <span style={{ fontSize: 11, opacity: 0.8 }} title="Édité via l'Inspector (sélectionner le spawn sur la carte)">
                          {en.optionals?.length ? `+${en.optionals.length} facultatif(s) ` : ''}
                          {en.spells?.length ? '🪄 ' : ''}
                          {en.randomChars ? '🎲' : ''}
                        </span>
                      ) : null}
                      <button className="btn small danger" onClick={() => upd(ei, { enemies: enc.enemies.filter((_, j) => j !== ni) })}>
                        ✕
                      </button>
                    </div>
                    {/* Combat monté (LDB 14) : marquer une monture rideable, pré-monter un cavalier (Chevauche), basculer le camp. */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, margin: '1px 0 7px 6px', opacity: 0.92 }}>
                      <label title="Cette créature est une monture rideable (peut être enfourchée — LDB 14).">
                        <input type="checkbox" checked={!!en.mount} onChange={(e) => updEnemy(ei, ni, { mount: e.target.checked || undefined })} /> 🐎 Monture
                      </label>
                      <label title="Monture (de cette rencontre) que cet acteur chevauche au spawn. ⚠ référence par index : change si on réordonne/supprime des ennemis.">
                        Chevauche{' '}
                        <select value={en.rides ?? ''} onChange={(e) => updEnemy(ei, ni, { rides: e.target.value === '' ? undefined : Number(e.target.value) })}>
                          <option value="">— aucune —</option>
                          {enc.enemies.map((m, idx) =>
                            idx !== ni && (m.mount || en.rides === idx) ? (
                              <option key={idx} value={idx}>
                                #{idx} {m.ref ?? '?'}
                              </option>
                            ) : null,
                          )}
                        </select>
                      </label>
                      <label title="Camp au spawn : « Allié » place la créature du côté du groupe (monture libre prêtable). Défaut : Ennemi.">
                        Camp{' '}
                        <select value={en.side ?? 'enemy'} onChange={(e) => updEnemy(ei, ni, { side: e.target.value === 'ally' ? 'ally' : undefined })}>
                          <option value="enemy">Ennemi</option>
                          <option value="ally">Allié</option>
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
                <button
                  className="btn small"
                  onClick={() => upd(ei, { enemies: [...enc.enemies, { ref: creatures[0]?.label ?? 'Mutant', pos: { x: 0, y: 0 } }] })}
                >
                  + Ennemi
                </button>
              </div>
              <div className="enc-surprise">
                <span className="mini-title">Surprise (embuscade, LDB 13)</span>
                <select
                  value={enc.surprise ?? ''}
                  onChange={(e) => upd(ei, { surprise: (e.target.value || undefined) as 'party' | 'enemies' | undefined })}
                  title="Camp pris en embuscade au début du combat : Test opposé Perception vs Discrétion ; les vaincus gagnent l'État Surpris."
                >
                  <option value="">Aucune surprise</option>
                  <option value="enemies">Les ennemis sont surpris (le groupe embusque)</option>
                  <option value="party">Le groupe est surpris (les ennemis embusquent)</option>
                </select>
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
    </Modal>
  );
}
