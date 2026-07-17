import type { ReactNode } from 'react';
import { CharFrame } from './CharFrame';
import { PortraitPicker } from './PortraitPicker';
import type { Combatant } from '../engine/types';

/**
 * Affordance UNIQUE « affecter des héros à un slot » — source partagée de la manœuvre navale (rôles
 * d'équipage, MDG 14) ET de la bataille de masse (Scène MULTI-PJ résolue en Soutien / Activité SOLO,
 * ADE II 8). Rend les héros affectés en portraits (clic = retirer, `.crew-remove`) suivis d'un
 * `PortraitPicker` des candidats.
 *
 * Cardinalité par `max` : `1` = une Scène/Activité (le picker REMPLACE via le `onAssign` de l'appelant,
 * qui pose l'unique posté) ; `Infinity` = un rôle d'équipage (le picker AJOUTE un servant de plus). Le
 * filtrage des candidats reste chez l'appelant (héros éligibles) ; ici on ne fait que griser ceux déjà
 * affectés. `canPick` gèle le picker quand l'action est figée (Round résolu, Scène close…).
 */
export function AssignRow({
  assigned, candidates, onAssign, onRemove, max = 1, verb = 'tient ce poste', canPick = true, captionOf, titleOf,
}: {
  assigned: Combatant[]; // héros actuellement affectés
  candidates: Combatant[]; // héros éligibles à ajouter (l'appelant filtre)
  onAssign: (heroId: string) => void;
  onRemove: (heroId: string) => void;
  max?: number; // 1 pour une Scène/Activité, Infinity pour un rôle d'équipage
  verb?: string; // « résout cette Scène », « réalise « X » », « tient le rôle de Timonier »…
  canPick?: boolean; // gèle le picker (action figée)
  captionOf?: (c: Combatant) => ReactNode; // légende sous chaque candidat (ex. valeur de rôle d'équipage)
  titleOf?: (c: Combatant) => string; // infobulle par candidat (ex. « Mettre X à Y »)
}) {
  const single = max === 1;
  // Picker visible : action non figée, au moins un candidat, et place libre (mono = toujours, remplace le posté).
  const showPicker = canPick && candidates.length > 0 && (single || assigned.length < max);
  return (
    <>
      <div className="bar assign-row">
        {assigned.length ? (
          assigned.map((h) => (
            <span key={h.id} className="crew-remove" title={`${h.name} — retirer`}>
              <CharFrame c={h} variant="identity" size="xs" onClick={() => onRemove(h.id)} />
            </span>
          ))
        ) : (
          <span className="mb-detail">Aucun PJ affecté — choisissez qui {verb}.</span>
        )}
      </div>
      {showPicker && (
        <PortraitPicker
          choices={candidates.map((c) => ({
            c,
            disabled: assigned.some((a) => a.id === c.id),
            caption: captionOf?.(c),
            title: titleOf?.(c),
          }))}
          selectedId={single ? assigned[0]?.id : undefined}
          onPick={onAssign}
        />
      )}
    </>
  );
}
