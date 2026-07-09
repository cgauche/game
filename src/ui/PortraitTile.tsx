import { RigPortrait } from './RigPortrait';
import { hpColor } from '../gameIso/teamColors';
import { StateChips } from './StateChips';
import { Icon } from './Icon';
import { endState } from '../engine/conditions';
import { END_STATE_VISUAL } from './endStateVisual';
import type { Combatant } from '../engine/types';

/**
 * Tuile-portrait compacte et UNIFIÉE — la SEULE façon d'afficher un personnage (HUD, modales,
 * pickers, écrans). L'API est volontairement fermée : 3 variantes × 5 tailles, AUCUN booléen
 * d'affichage (la soupe showPv/showGauge/hideStates est ce qui avait fait diverger les écrans).
 *  - `full`     : portrait + jauge + pastilles d'États (HUD, médecin, inspection) ;
 *  - `vital`    : portrait + jauge, sans États (sujet de modale, cibles) ;
 *  - `identity` : portrait seul (butin, ready-check, lignes de jet, marchand).
 * Règles dérivées (arbitrées 2026-06-12) :
 *  - PV chiffrés : HÉROS uniquement (ennemi/PNJ = jauge seule, les PB exacts restent à
 *    l'Inspection) et à partir de `md` (illisible en dessous) ;
 *  - le NOM n'est jamais affiché — il vit dans `title`/`aria-label` (a11y) et dans la prose ;
 *  - cadre = couleur d'identité/équipe (`ring`), fond d'équipe (`team`), KO grisé ✕,
 *    unité ACTIVE agrandie + liseré or + caret ▼, `selected` = tuile-radio des pickers.
 * Pur à props (testable en SSR), aucune lecture du store — voir CharFrame pour le wrapper connecté.
 */
export type CharVariant = 'full' | 'vital' | 'identity';
export type CharSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Côté de la vignette en px par taille (xs = lignes de jet, sm = frise, md = dock/modales,
 *  lg = cadre actif/inspection, xl = fiche). */
export const CHAR_SIZE_PX: Record<CharSize, number> = { xs: 28, sm: 44, md: 56, lg: 72, xl: 112 };

export interface PortraitTileProps {
  c: Combatant;
  /** Couleur du cadre : teinte d'équipe (frise) ou couleur d'identité du héros (dock). */
  ring: string;
  variant?: CharVariant;
  size?: CharSize;
  /** Unité active (HUD) : portrait agrandi ~×1.28 + liseré or + caret ▼. */
  active?: boolean;
  /** Tuile-radio d'un picker : accentuée comme choix courant. */
  selected?: boolean;
  /** Survolé (token sur la carte OU ce portrait) → léger halo de focus NEUTRE, distinct de l'actif
   *  (or) et du picker (sel). Réciprocité frise↔carte. */
  hovered?: boolean;
  /** Fond d'équipe derrière le portrait (vert allié / rouge ennemi). */
  team?: 'ally' | 'enemy';
  maxStates?: number;
  onClick?: () => void;
  title?: string;
}

export function PortraitTile({ c, ring, variant = 'full', size = 'md', active, selected, hovered, team, maxStates = 4, onClick, title }: PortraitTileProps) {
  const px = CHAR_SIZE_PX[size];
  const ratio = c.wounds.max > 0 ? Math.max(0, Math.min(1, c.wounds.current / c.wounds.max)) : 0;
  // État de FIN (#237) : SOURCE UNIQUE (endState) — distingue mort / inconscient / rendu / hors-combat
  // (une croix ✕ générique les confondait). null = en état (un héros à 0 PB reste À Terre, pas une fin).
  const es = endState(c);
  const endMark = es ? END_STATE_VISUAL[es] : null;
  const showGauge = variant !== 'identity' && !c.inert;
  const showPv = showGauge && c.kind === 'hero' && px >= CHAR_SIZE_PX.md;
  // R6 : l'unité active est plus grosse que les autres pour la mettre en évidence.
  const s = active ? Math.round(px * 1.28) : px;
  return (
    <div className="ptile-wrap">
      <button
        type="button"
        className={`ptile ${active ? 'active' : ''} ${selected ? 'sel' : ''} ${hovered ? 'hov' : ''} ${endMark ? `ko ${endMark.className}` : ''} ${team ? `team-${team}` : ''}`}
        style={{ width: s }}
        onClick={onClick}
        title={title ?? c.name}
        aria-label={title ?? c.name}
      >
        {active && <i className="ptile-caret">▼</i>}
        <span className="ptile-face" style={{ width: s, height: s }}>
          <RigPortrait combatant={c} size={s} ring={ring} />
          {endMark && (
            <span className={`end-mark ${endMark.className}`} title={endMark.label} aria-label={endMark.label}>
              <Icon id={endMark.icon} size="sm" />
            </span>
          )}
        </span>
        {showGauge && (
          <span className="ptile-gauge" title={showPv ? `Blessures : ${c.wounds.current}/${c.wounds.max}` : 'Blessures'}>
            <b style={{ width: `${Math.round(ratio * 100)}%`, background: hpColor(ratio) }} />
            {showPv && <span className="ptile-pv">{c.dead ? <Icon id="journal/death" size="sm" /> : `${c.wounds.current}/${c.wounds.max}`}</span>}
          </span>
        )}
      </button>
      {variant === 'full' && <StateChips c={c} max={maxStates} />}
    </div>
  );
}
