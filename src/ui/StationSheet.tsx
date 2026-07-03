import type { ReactNode } from 'react';
import { TopoScene } from '../gameIso/TopoScene';
import type { Station } from '../state/stations';
import type { Scene } from '../state/scene';

/**
 * Bande de sélection RTS GÉNÉRIQUE : une puce par Station de l'ensemble (point « servi » + label + effectif).
 * Sélecteur secondaire du plan (`TopoScene`), synchronisé par `selectedStationId` (= `station.id`, globalement
 * unique). L'appelant PRÉ-FILTRE les stations par kind (un plan ne mélange jamais deux kinds) → on rend TOUT ce
 * qui est passé, sans garde de kind. Sous-titre OPTIONNEL (`subtitleOf`) : le bord d'une pièce navale, plus tard
 * la nature d'une activité. Réutilise les classes CSS `poste-chip*` existantes (pas de churn styles.css).
 */
export function StationChips({
  stations,
  selectedStationId,
  onSelect,
  subtitleOf,
}: {
  stations: Station[];
  selectedStationId?: string;
  onSelect: (stationId: string) => void;
  subtitleOf?: (s: Station) => string | undefined;
}) {
  if (!stations.length) return null;
  return (
    <div className="poste-chips">
      {stations.map((s) => {
        const count = s.assignedIds.length;
        const selected = selectedStationId === s.id;
        const sub = subtitleOf?.(s);
        return (
          <button
            key={s.id}
            className={`poste-chip${selected ? ' selected' : ''}`}
            onClick={() => onSelect(s.id)}
            title={sub ? `${sub} · ${s.label}` : s.label}
          >
            <span className={`poste-dot${count ? ' manned' : ''}`} aria-hidden />
            {sub && <span className="poste-chip-side">{sub}</span>}
            <span className="poste-chip-name">{s.label}</span>
            <span className="poste-chip-badge">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * SURFACE MAÎTRE-DÉTAIL GÉNÉRIQUE d'un plan top-down de stations (couche partagée navire / siège / — bientôt —
 * bataille de masse). CONTRÔLÉE : le parent possède la sélection (`selectedStationId`/`onSelectStation`), ce corps
 * n'a PAS d'état interne. Composition par RENDER-PROP (pas de registre par kind : un plan ne mélange jamais les
 * kinds, donc rien à dispatcher au runtime) — `renderDetail` fournit le détail spécifique de la station choisie.
 * Ce n'est PAS une modale (aucun overlay/fermeture) : juste le corps `poste-layout` = plan TOP-DOWN + puces + détail,
 * tous synchronisés sur la MÊME station. Sélection BIDIRECTIONNELLE : plan ⇄ puces ⇄ détail.
 */
export function StationSheet({
  scene,
  stations,
  selectedStationId,
  onSelectStation,
  renderDetail,
  subtitleOf,
  detailTitle,
}: {
  /** Plan top-down. OPTIONNEL : la vitrine `__wfrp.massBattle()` sans scène chargée n'a pas de champ à
   *  rendre → on n'affiche alors que puces + détail (le maître-détail RTS reste utilisable sans carte). */
  scene?: Scene | null;
  stations: Station[];
  selectedStationId?: string;
  onSelectStation: (s: Station) => void;
  renderDetail: (s: Station) => ReactNode;
  subtitleOf?: (s: Station) => string | undefined;
  /** Intitulé de la colonne de détail (spécifique à l'appelant : « Armes · postes », « Scènes du moment »…). */
  detailTitle?: string;
}) {
  const selected = stations.find((s) => s.id === selectedStationId);
  return (
    <div className="poste-layout">
      {scene && (
        <div className="ship-section topo-panel">
          <TopoScene
            scene={scene}
            stations={stations}
            selectedStationId={selectedStationId}
            onSelectStation={onSelectStation}
          />
        </div>
      )}
      <div className="poste-detail-col">
        {detailTitle && <div className="mini-title">{detailTitle}</div>}
        <StationChips
          stations={stations}
          selectedStationId={selectedStationId}
          onSelect={(id) => {
            const s = stations.find((st) => st.id === id);
            if (s) onSelectStation(s);
          }}
          subtitleOf={subtitleOf}
        />
        {selected && renderDetail(selected)}
      </div>
    </div>
  );
}
