import { useState } from 'react';
import { Modal } from '../Modal';
import { Icon } from '../Icon';
import { Scene } from '../../state/scene';
import { testScenarios, TestScenario } from '../../scenes/test-scenarios';
import { projectsLoad, projectRemove, SavedProject } from '../../state/projectLibrary';
import { allBuiltinCampaigns, BuiltinCampaign } from '../../scenes/campaign';

/** « Ouvrir » : reprendre un projet enregistré (localStorage), repartir d'une campagne du jeu
 *  (Arène + campagnes built-in — #367 : les fichiers `src/scenes/**‑projet.json` sont commités,
 *  jamais écrasés depuis l'éditeur, donc ouverture = COPIE de travail) ou d'un scénario de test. */
export function OpenProjectModal({
  onScenario,
  onProject,
  onBuiltin,
  onClose,
}: {
  onScenario: (sc: TestScenario) => void;
  onProject: (p: SavedProject) => void;
  onBuiltin: (bc: BuiltinCampaign) => void;
  onClose: () => void;
}) {
  const [projects, setProjects] = useState(() => projectsLoad());
  const del = (id: string) => {
    projectRemove(id);
    setProjects(projectsLoad());
  };

  return (
    <Modal variant="plain" className="wide" title="Ouvrir" onClose={onClose}>
      {projects.length > 0 && (
        <>
          <div className="mini-title">Mes projets</div>
          <div className="stack">
            {projects.map((p) => (
              <div className="listrow" key={p.id}>
                <span className="lr-name">{p.label}</span>
                {p.published && <span className="chip">publiée</span>}
                <button className="btn small btn-primary" onClick={() => onProject(p)}>
                  Ouvrir
                </button>
                <button className="btn small danger" onClick={() => del(p.id)}>
                  Suppr.
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="mini-title">Campagnes du jeu</div>
      <div className="stack">
        {allBuiltinCampaigns.map((bc) => (
          <div className="listrow" key={bc.id}>
            <span className="lr-name">
              <Icon id={bc.icon} size="sm" /> {bc.label}
            </span>
            <span className="chip">s'ouvre en copie</span>
            <button className="btn small btn-primary" onClick={() => onBuiltin(bc)}>
              Ouvrir
            </button>
          </div>
        ))}
      </div>
      <div className="mini-title">Scénarios de test</div>
      <div className="stack">
        {testScenarios.map((sc) => (
          <div className="listrow" key={sc.id}>
            <span className="lr-name">
              {sc.icon} {sc.title}
            </span>
            <span className="chip">{sc.partyNote}</span>
            <button className="btn small" onClick={() => onScenario(sc)}>
              Ouvrir
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** « Enregistrer » : nomme le projet, choisit la scène de départ jouable, publie au menu. */
export function SaveProjectModal({
  initialName,
  initialPublished,
  scenes,
  initialStartId,
  onSave,
  onClose,
}: {
  initialName: string;
  initialPublished: boolean;
  scenes: Scene[];
  initialStartId: string;
  onSave: (name: string, published: boolean, startSceneId: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [published, setPublished] = useState(initialPublished);
  const [start, setStart] = useState(initialStartId);

  return (
    <Modal variant="plain" title="Enregistrer le projet" onClose={onClose}>
      <label className="field">
        <span>Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ma campagne" autoFocus />
      </label>
      {scenes.length > 1 && (
        <label className="field">
          <span>Scène de départ (au jeu)</span>
          <select value={start} onChange={(e) => setStart(e.target.value)}>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom ?? s.id}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="row-flex">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        <span>Jouable depuis le menu principal</span>
      </label>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), published, start)}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
