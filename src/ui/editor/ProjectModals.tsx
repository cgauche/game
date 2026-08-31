import { useState } from 'react';
import { Modal } from '../Modal';
import { GatedAction } from '../GatedAction';
import { Icon } from '../Icon';
import { Scene } from '../../state/scene';
import { testScenarios, TestScenario } from '../../scenes/test-scenarios';
import { projectsLoad, projectRemove, nomDeProjet, SavedProject } from '../../state/projectLibrary';
import { allBuiltinCampaigns, BuiltinCampaign } from '../../scenes/campaign';

/** Un refus d'ouverture RENDU à l'auteur : `message` en mots d'auteur, `detail` = le rapport brut de
 *  la porte (`parseProject`), replié sous le message. */
export type RefusOuverture = { message: string; detail?: string };

/** Champs d'IDENTITÉ du document de projet (`projetSchema`) : un refus qui les nomme est un refus
 *  d'identité — le projet n'a pas de nom, aucun réglage de contenu ne le sauvera. */
const CHAMPS_IDENTITE = ['id', 'label', 'versionContenu', 'type'];
const REFUS_IDENTITE_RX = new RegExp(`^\\s*-\\s*(${CHAMPS_IDENTITE.join('|')}):`, 'm');

/**
 * Traduit le refus de la porte en refus d'ÉCRAN. Un rapport de validation est un texte technique en
 * anglais : quand il porte sur l'IDENTITÉ, l'auteur lit d'abord ce qui lui arrive, en français
 * (règle 4), et le rapport reste consultable dessous. Les autres refus (contenu invalide) gardent
 * leur détail en message : ils nomment le champ à corriger.
 */
export function refusDOuverture(erreur: unknown): RefusOuverture {
  const brut = erreur instanceof Error ? erreur.message : 'Projet invalide';
  return REFUS_IDENTITE_RX.test(brut)
    ? { message: 'Ce projet n’a pas de nom : impossible de l’ouvrir tel quel.', detail: brut }
    : { message: brut };
}

/** « Ouvrir » : reprendre un projet enregistré (localStorage), repartir d'une campagne du jeu
 *  (Arène + campagnes built-in — #367 : les fichiers `src/scenes/**‑projet.json` sont commités,
 *  jamais écrasés depuis l'éditeur, donc ouverture = COPIE de travail) ou d'un scénario de test. */
export function OpenProjectModal({
  onScenario,
  onProject,
  onBuiltin,
  onClose,
  error,
}: {
  onScenario: (sc: TestScenario) => void;
  onProject: (p: SavedProject) => void;
  onBuiltin: (bc: BuiltinCampaign) => void;
  onClose: () => void;
  /** Refus de la porte à l'ouverture d'un projet (#1552) — la modale reste ouverte et le DIT :
   *  `message` est écrit en mots d'auteur (règle 4), `detail` porte le rapport de la porte, replié. */
  error?: RefusOuverture | null;
}) {
  const [projects, setProjects] = useState(() => projectsLoad());
  const [delError, setDelError] = useState<string | null>(null);
  const del = (id: string) => {
    setDelError(null);
    projectRemove(id).then((res) => {
      if (!res.ok) setDelError(res.message);
    });
    setProjects(projectsLoad());
  };

  return (
    <Modal variant="plain" className="wide" title="Ouvrir" onClose={onClose}>
      {error && (
        <div className="chip tone-danger" role="alert">
          <span>{error.message}</span>
          {error.detail && (
            <details>
              <summary>Détail technique</summary>
              <span>{error.detail}</span>
            </details>
          )}
        </div>
      )}
      {delError && <p className="chip tone-danger" role="alert">{delError}</p>}
      {projects.length > 0 && (
        <>
          <div className="mini-title">Mes projets</div>
          <div className="stack">
            {projects.map((p) => (
              <div className="listrow" key={p.id}>
                <span className="lr-name">{nomDeProjet(p.label)}</span>
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
  error,
}: {
  initialName: string;
  initialPublished: boolean;
  scenes: Scene[];
  initialStartId: string;
  onSave: (name: string, published: boolean, startSceneId: string) => void;
  onClose: () => void;
  /** #811 : message de l'échec le plus récent de `projectSave`, ou `null` si le chemin nominal. */
  error?: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [published, setPublished] = useState(initialPublished);
  const [start, setStart] = useState(initialStartId);

  return (
    <Modal variant="plain" title="Enregistrer le projet" onClose={onClose}>
      {error && <p className="chip tone-danger" role="alert">{error}</p>}
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
                {s.label ?? s.id}
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
        <GatedAction
          id="projet-enregistrer"
          label="Enregistrer"
          enabled={!!name.trim()}
          reason="Un projet se nomme avant d’être enregistré : saisissez un nom dans le champ Nom."
          onClick={() => onSave(name.trim(), published, start)}
        />
      </div>
    </Modal>
  );
}
