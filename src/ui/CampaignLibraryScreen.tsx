import { useState } from 'react';
import { ScreenShell } from './ScreenShell';
import { MasterDetail } from './MasterDetail';
import { Icon } from './Icon';
import { ListRow } from './ListRow';
import { useGame } from '../state/store';
import { downloadText, fileSlug } from '../state/fileIo';
import { parseProject, CURRENT_PROJECT_SCHEMA, type ProjectDoc } from '../state/worldMap';
import { projectsLoad, projectSave, projectRemove, nomDeProjet, type SavedProject } from '../state/projectLibrary';
import { allBuiltinCampaigns, type BuiltinCampaign } from '../scenes/campaign';

/** Une entrée sélectionnable de la bibliothèque : soit une campagne EMBARQUÉE (lecture seule,
 *  exportable mais jamais supprimable), soit un projet de la bibliothèque locale (supprimable). */
type Entry =
  | { kind: 'builtin'; id: string; bc: BuiltinCampaign }
  | { kind: 'library'; id: string; sp: SavedProject };

/** Cause typée d'un message d'échec d'import déjà écrit en langage JOUEUR (JSON illisible, projet
 *  sans scène) — le tri dans `playerImportError` se fait sur CETTE classe, jamais sur le TEXTE du
 *  message (une reformulation FR ne doit jamais changer le comportement, cf. « la logique se keye
 *  par id, jamais par label »). */
export class PlayerFacingImportError extends Error {}

/** Un `SavedProject` construit depuis le texte d'un fichier importé. Fonction PURE testable : throw
 *  un `PlayerFacingImportError` (message déjà en langage JOUEUR) sur JSON illisible ou projet sans
 *  scène ; toute autre invalidité passe par la validation `parseProject` (#765, message d'authoring,
 *  jamais affiché tel quel — voir `playerImportError`). L'id et le libellé de l'entrée sont ceux du
 *  DOCUMENT (dédup portable, #766) : l'enveloppe les EXIGE (#1552). */
export function buildImportedProject(text: string): SavedProject {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new PlayerFacingImportError('Fichier illisible : ce n’est pas du JSON valide.');
  }
  // `activeAxes` est destructuré NOMMÉMENT (comme `src/ui/editor/Editor.tsx`) : le laisser tomber
  // dans le rest le rendrait invisible à la relecture, alors qu'il doit être RECONDUIT au document
  // reconstruit ci-dessous — sans quoi une campagne importée perdrait ses axes actifs (#409).
  const { scenes, worldMap, activeAxes, narratif, ...identite } = parseProject(data);
  if (!scenes.length) throw new PlayerFacingImportError('Projet invalide : aucune scène.');
  // Un document qui a passé `parseProject` PORTE son identité (#1552, l'enveloppe l'exige) : c'est
  // ELLE que l'entrée de bibliothèque reprend, telle quelle.
  const { label, id } = identite;
  return {
    id,
    label,
    startSceneId: scenes[0].id,
    savedAt: Date.now(),
    published: true, // apparaît aussi dans le picker « Nouvelle partie »
    project: {
      schema: CURRENT_PROJECT_SCHEMA,
      ...identite,
      scenes,
      ...(worldMap ? { worldMap } : {}),
      ...(activeAxes ? { activeAxes } : {}),
      narratif,
    },
  };
}

/** Message d'échec d'import à afficher au JOUEUR (jamais le langage de schéma/authoring de
 *  `parseProject`/`projetSchema`, qui parle de champs — `versionContenu`, `schema=`, noms d'id).
 *  Le tri est STRUCTUREL : `PlayerFacingImportError` porte un message déjà écrit pour le joueur
 *  (JSON illisible, projet sans scène) — jamais une comparaison de TEXTE (une reformulation FR ne
 *  doit jamais changer le comportement). Toute autre erreur est journalée (`console.error`,
 *  diagnostic) et remplacée par un message générique. */
export function playerImportError(err: unknown): string {
  if (err instanceof PlayerFacingImportError) return err.message;
  const message = err instanceof Error ? err.message : null;
  if (message) console.error('Import de campagne refusé :', message);
  return (
    'Ce fichier n’est pas une campagne exploitable. Vérifiez qu’il provient bien d’un export ' +
    'de campagne du jeu, ou demandez-en une nouvelle version à son auteur.'
  );
}

/** Décision d'import face à un éventuel doublon d'id dans la bibliothèque locale (#766 lot C DoD :
 *  « même `id` + version supérieure → remplacement PROPOSÉ, jamais silencieux »). Fonction PURE
 *  testable : 'new' = aucun existant, import direct ; 'replace-newer'/'replace-older-or-equal' =
 *  existant de même id, la version tranche seulement le LIBELLÉ du prompt de confirmation — dans les
 *  deux cas le remplacement reste soumis à confirmation, jamais silencieux. */
export function importDecision(
  entry: SavedProject,
  existing: SavedProject | undefined,
): 'new' | 'replace-newer' | 'replace-older-or-equal' {
  if (!existing) return 'new';
  const vNew = entry.project.versionContenu ?? 0;
  const vExist = existing.project.versionContenu ?? 0;
  return vNew > vExist ? 'replace-newer' : 'replace-older-or-equal';
}

/** Document de projet PORTABLE (schema courant) reconstruit pour l'export d'une entrée. */
function toProjectDoc(e: Entry): ProjectDoc {
  if (e.kind === 'builtin') {
    // L'identité de la campagne built-in est RECONDUITE : elle vit sur `BuiltinCampaign`, dérivée du
    // paquet par `campaign.ts` — un export qui la laisserait tomber rendrait un document anonyme,
    // que sa propre porte refuserait.
    const { scenes, startSceneId: _start, worldMap, narratif, ...identite } = e.bc;
    return {
      schema: CURRENT_PROJECT_SCHEMA,
      ...identite,
      scenes,
      ...(worldMap ? { worldMap } : {}),
      narratif,
    };
  }
  // `activeAxes` NOMMÉ et RECONDUIT (même raison qu'à `buildImportedProject`) : un export de
  // bibliothèque qui le perdrait rendrait un document PORTABLE amputé de ses axes (#409).
  const { scenes, worldMap, activeAxes, narratif, ...identite } = parseProject(e.sp.project);
  return {
    schema: CURRENT_PROJECT_SCHEMA,
    ...identite,
    scenes,
    ...(worldMap ? { worldMap } : {}),
    ...(activeAxes ? { activeAxes } : {}),
    narratif,
  };
}

function entryLabel(e: Entry): string {
  return nomDeProjet(e.kind === 'builtin' ? e.bc.label : e.sp.label);
}
function entrySceneCount(e: Entry): number {
  return e.kind === 'builtin' ? e.bc.scenes.length : e.sp.project.scenes.length;
}

export function CampaignLibraryScreen({ onClose }: { onClose: () => void }) {
  const setScreen = useGame((s) => s.setScreen);
  const setPendingCampaign = useGame((s) => s.setPendingCampaign);

  const [library, setLibrary] = useState<SavedProject[]>(() => projectsLoad());
  const [selId, setSelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const builtins: Entry[] = allBuiltinCampaigns.map((bc) => ({ kind: 'builtin', id: bc.id, bc }));
  const locals: Entry[] = library.map((sp) => ({ kind: 'library', id: sp.id, sp }));
  const all: Entry[] = [...builtins, ...locals];
  const selected = all.find((e) => e.id === selId) ?? null;

  function importFile(file: File) {
    setError(null);
    file.text().then(async (txt) => {
      try {
        const entry = buildImportedProject(txt);
        const existing = projectsLoad().find((p) => p.id === entry.id);
        const decision = importDecision(entry, existing);
        if (decision !== 'new') {
          const vNew = entry.project.versionContenu ?? 0;
          const vExist = existing!.project.versionContenu ?? 0;
          const msg = decision === 'replace-newer'
            ? `Une campagne « ${existing!.label} » (v${vExist}) est déjà dans votre bibliothèque. La remplacer par la version ${vNew} importée ?`
            : `La version importée (v${vNew}) n’est pas plus récente que celle de votre bibliothèque (v${vExist}). Remplacer quand même « ${existing!.label} » ?`;
          if (!window.confirm(msg)) return;
        }
        const res = await projectSave(entry);
        setLibrary(projectsLoad());
        setSelId(entry.id);
        if (!res.ok) setError(res.message);
      } catch (err) {
        setError(playerImportError(err));
      }
    });
  }

  function play(e: Entry) {
    if (e.kind === 'builtin') {
      setPendingCampaign({
        id: e.bc.id,
        label: e.bc.label,
        scenes: e.bc.scenes,
        startSceneId: e.bc.startSceneId,
        worldMap: e.bc.worldMap,
        narratif: e.bc.narratif,
      });
    } else {
      const { scenes, worldMap, narratif } = parseProject(e.sp.project);
      setPendingCampaign({
        id: e.sp.id,
        label: e.sp.label,
        scenes,
        startSceneId: e.sp.startSceneId,
        worldMap: worldMap ?? null,
        narratif,
      });
    }
    onClose();
    setScreen('party');
  }

  function exportEntry(e: Entry) {
    downloadText(`${fileSlug(entryLabel(e))}-projet.json`, JSON.stringify(toProjectDoc(e), null, 2));
  }

  function remove(e: Entry) {
    if (e.kind !== 'library') return;
    if (!window.confirm(`Supprimer « ${e.sp.label} » de votre bibliothèque ? (La campagne du jeu n’est pas affectée.)`)) return;
    setError(null);
    projectRemove(e.id).then((res) => {
      if (!res.ok) setError(res.message);
    });
    setLibrary(projectsLoad());
    if (selId === e.id) setSelId(null);
  }

  const row = (e: Entry) => (
    <ListRow
      key={e.id}
      variant="codex"
      selected={selId === e.id}
      onClick={() => setSelId(e.id)}
      label={<>{e.kind === 'builtin' && <Icon id={e.bc.icon} size="sm" />} {entryLabel(e)}</>}
    >
      <span className="chip">{entrySceneCount(e)} scène{entrySceneCount(e) > 1 ? 's' : ''}</span>
    </ListRow>
  );

  const list = (
    <>
      <div className="mini-title">Campagnes du jeu</div>
      <div className="stack">{builtins.map(row)}</div>
      <div className="mini-title">Ma bibliothèque</div>
      <label className="btn small">
        <Icon id="file/import" size="sm" /> Importer une campagne…
        <input
          type="file"
          accept="application/json"
          hidden
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = '';
            if (f) importFile(f);
          }}
        />
      </label>
      {error && <p className="chip tone-danger" role="alert">{error}</p>}
      {locals.length > 0
        ? <div className="stack">{locals.map(row)}</div>
        : <p className="empty">Aucune campagne importée pour l’instant.</p>}
    </>
  );

  const detail = selected == null
    ? <p className="empty">Sélectionnez une campagne pour la jouer, l’exporter ou la supprimer.</p>
    : (
      <div className="stack">
        <h3>{entryLabel(selected)}</h3>
        <div className="row-flex">
          <span className="chip">{entrySceneCount(selected)} scène{entrySceneCount(selected) > 1 ? 's' : ''}</span>
          <span className="chip">{selected.kind === 'builtin' ? 'Campagne du jeu' : 'Ma bibliothèque'}</span>
          {selected.kind === 'library' && selected.sp.published && <span className="chip">publiée</span>}
        </div>
        {selected.kind === 'library' && selected.sp.project.desc && (
          <p>{selected.sp.project.desc}</p>
        )}
        {selected.kind === 'library' && selected.sp.project.auteur && (
          <p className="mini-title">Par {selected.sp.project.auteur}</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={() => play(selected)}>Jouer</button>
          <button type="button" className="btn" onClick={() => exportEntry(selected)}>Exporter</button>
          {selected.kind === 'library' && (
            <button type="button" className="btn danger" onClick={() => remove(selected)}>Supprimer</button>
          )}
        </div>
      </div>
    );

  return (
    <ScreenShell title="Bibliothèque de campagnes" onClose={onClose} body="centered-wide">
      <MasterDetail list={list} detail={detail} listLabel="Campagnes" />
    </ScreenShell>
  );
}
