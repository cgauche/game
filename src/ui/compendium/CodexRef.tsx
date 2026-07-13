/**
 * CodexRef — primitive PARTAGÉE de référence contextuelle. Enrobe un libellé d'entité (talent,
 * compétence, équipement, état, sort, trait, signe…) : au survol/focus, un popover montre sa
 * description + sa source ; un clic ouvre le Codex sur la fiche. C'est LA primitive popover du
 * jeu (il n'y en avait pas) — remplace les `title=desc` bruts et les libellés « nus ».
 *
 * Le popover est rendu en PORTAL (document.body) en `position: fixed`, positionné depuis le rect
 * du déclencheur : il échappe ainsi à TOUT clipping `overflow` (fiche, panneaux…) et à tout
 * contexte d'empilement. `pointer-events: none` → pur tooltip, pas de pont de survol ; le clic
 * (déclencheur) ouvre le Codex.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../state/store';
import { codexLookup, codexLookupById } from './registry';
import { mdToText } from '../Prose';

const truncate = (s: string, n = 400): string => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

const POP_W = 320;
const GAP = 6;
const MARGIN = 8;

export interface PopoverPlacement {
  left: number;
  /** Ancré par le HAUT (placé sous le déclencheur) — `bottom` absent. */
  top?: number;
  /** Ancré par le BAS (placé au-dessus) — indépendant de la hauteur réelle, `top` absent. */
  bottom?: number;
  maxHeight: number;
  width: number;
}

/** Place un popover dans le viewport SANS deviner sa hauteur : on le pose du côté (dessous/dessus)
 *  qui a le PLUS de place et on borne `maxHeight` à cette place réelle → jamais de débordement haut
 *  ni bas (symétrique au bornage horizontal déjà fait sur `left`/`width`). Pur → testable. */
export function computePopoverPos(
  rect: { left: number; top: number; bottom: number },
  vw: number,
  vh: number,
  popW = POP_W,
): PopoverPlacement {
  const width = Math.min(popW, vw - 2 * MARGIN);
  const left = Math.max(MARGIN, Math.min(rect.left, vw - width - MARGIN));
  const below = vh - rect.bottom - GAP - MARGIN; // place disponible sous le déclencheur
  const above = rect.top - GAP - MARGIN; // place disponible au-dessus
  const cap = Math.floor(vh * 0.6);
  return below >= above
    ? { left, top: rect.bottom + GAP, maxHeight: Math.max(0, Math.min(below, cap)), width }
    : { left, bottom: vh - rect.top + GAP, maxHeight: Math.max(0, Math.min(above, cap)), width };
}

export function CodexRef({
  category,
  id,
  label,
  children,
  className,
  hideIfUnknown = false,
  inline = false,
  instance,
  tooltipOnly = false,
  fallback,
}: {
  category: string;
  /** Identité STABLE de la cible — PRÉFÉRÉE quand fournie (`codexLookupById`) ; `label` reste requis
   *  (affichage + repli de résolution pour les ~40 appelants hors Codex non migrés ce lot). */
  id?: string;
  label: string;
  /** Texte affiché si différent du libellé d'entrée (ex. libellé avec spécialisation). */
  children?: ReactNode;
  className?: string;
  /** Pour un déclencheur-icône (info) : ne rien rendre si l'entrée est inconnue (pas d'icône morte). */
  hideIfUnknown?: boolean;
  /** Ref en PLEINE PROSE (hors cadre) : réintroduit l'indice pointillé. Par défaut (libellé déjà
   *  encadré : chip/tag/stat-chip/titre) aucun soulignement — cf. `.codex-ref.codex-inline`. */
  inline?: boolean;
  /** Instance paramétrée portant les Indices (« 8 Tentacules +8 ») — affichée en tête du popover
   *  et transmise au Codex à l'ouverture (le Codex « prend en compte les Indices »). */
  instance?: string;
  /** POPOVER SEUL : survol → info, mais le clic n'ouvre PAS la fiche Codex (ni rôle bouton). Pour
   *  un déclencheur déjà cliquable par ailleurs (cellule d'équipement = picker au clic). */
  tooltipOnly?: boolean;
  /** Contenu de SECOURS quand l'entrée n'est pas au catalogue (arme invoquée/enchantée…) : un popover
   *  est tout de même rendu au survol (sub + body), sans ouverture de fiche. */
  fallback?: { sub?: string; body?: string };
}) {
  const openCodex = useGame((s) => s.openCodex);
  const item = (id ? codexLookupById(category, id) : undefined) ?? codexLookup(category, label);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<PopoverPlacement | null>(null);

  const show = useCallback(() => {
    const el = ref.current;
    if (el) setPos(computePopoverPos(el.getBoundingClientRect(), window.innerWidth, window.innerHeight));
  }, []);
  const hide = useCallback(() => setPos(null), []);

  // Sans entrée catalogue NI fallback : icône-déclencheur → rien ; libellé → texte simple.
  if (!item && !fallback) return hideIfUnknown ? null : <span className={className}>{children ?? label}</span>;

  const title = item?.label ?? label;
  const body = item ? (item.desc ? truncate(mdToText(item.desc)) : null) : (fallback?.body || null);
  const popSub = item?.sub ?? fallback?.sub;
  // Faits-clés (Dégâts/PA/Prix/NI/Portée…) DANS le tooltip — pas seulement la prose : le survol
  // d'une arme/d'un sort devient informatif sans ouvrir la fiche. Compact, 4 max.
  const metaLine = item?.meta?.length ? truncate(item.meta.slice(0, 4).map((m) => `${m.label} ${m.value}`).join(' · '), 140) : null;
  const src = item?.source;
  const inst = instance && instance !== title ? instance : undefined;
  // Clic → fiche Codex UNIQUEMENT pour une vraie entrée catalogue, hors mode popover-seul (prop
  // `tooltipOnly`, ex. cellule d'équipement déjà cliquable comme picker).
  const interactive = !tooltipOnly && !!item;
  const open = () => { if (item) openCodex({ category, id: item.id, label: item.label, instance: inst }); };

  return (
    <span
      ref={ref}
      className={`codex-ref${inline ? ' codex-inline' : ''}${interactive ? '' : ' codex-static'}${className ? ` ${className}` : ''}`}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      onClick={interactive ? open : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      } : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children ?? label}
      {pos &&
        createPortal(
          <span className="codex-pop" style={{ top: pos.top, bottom: pos.bottom, left: pos.left, maxWidth: pos.width, maxHeight: pos.maxHeight }} role="tooltip">
            <span className="codex-pop-title">{inst ?? title}</span>
            {inst && <span className="codex-pop-sub">{title}</span>}
            {popSub && <span className="codex-pop-sub">{popSub}</span>}
            {metaLine && <span className="codex-pop-meta">{metaLine}</span>}
            {body && <span className="codex-pop-body">{body}</span>}
            {(src || interactive) && (
              <span className="codex-pop-foot">
                {src && <span className="codex-src">{src.book} p.{src.page}</span>}
                {/* affordance EXPLICITE : le déclencheur est cliquable → la fiche Codex s'ouvre */}
                {interactive && <span className="codex-pop-open">Ouvrir la fiche</span>}
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}
