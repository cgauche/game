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
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../state/store';
import { codexLookup } from './registry';

/** Contexte « popover-seul » : sous ce fournisseur, tout `CodexRef` informe au survol mais son clic
 *  n'ouvre PAS la fiche plein écran (équivaut à `tooltipOnly`). Posé autour de l'assistant de création
 *  pour qu'une référence de règle ne fasse pas quitter le flux — ce qui réinitialisait le brouillon. */
export const CodexTooltipOnly = createContext(false);

const stripHtml = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const truncate = (s: string, n = 260): string => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

const POP_W = 320;
const POP_H = 220; // estimation pour décider dessus/dessous

export function CodexRef({
  category,
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
  label: string;
  /** Texte affiché si différent du libellé d'entrée (ex. libellé avec spécialisation). */
  children?: ReactNode;
  className?: string;
  /** Pour un déclencheur-icône (ℹ️) : ne rien rendre si l'entrée est inconnue (pas d'icône morte). */
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
  const ctxTooltipOnly = useContext(CodexTooltipOnly);
  const item = codexLookup(category, label);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.min(POP_W, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    // Sous le déclencheur par défaut ; au-dessus s'il n'y a pas la place en bas.
    const top = r.bottom + 6 + POP_H > window.innerHeight ? Math.max(8, r.top - 6 - POP_H) : r.bottom + 6;
    setPos({ top, left });
  }, []);
  const hide = useCallback(() => setPos(null), []);

  // Sans entrée catalogue NI fallback : icône-déclencheur → rien ; libellé → texte simple.
  if (!item && !fallback) return hideIfUnknown ? null : <span className={className}>{children ?? label}</span>;

  const title = item?.label ?? label;
  const body = item ? (item.desc ? truncate(item.html ? stripHtml(item.desc) : item.desc) : null) : (fallback?.body || null);
  const popSub = item?.sub ?? fallback?.sub;
  // Faits-clés (Dégâts/PA/Prix/NI/Portée…) DANS le tooltip — pas seulement la prose : le survol
  // d'une arme/d'un sort devient informatif sans ouvrir la fiche. Compact, 4 max.
  const metaLine = item?.meta?.length ? item.meta.slice(0, 4).map((m) => `${m.label} ${m.value}`).join(' · ') : null;
  const src = item?.source;
  const inst = instance && instance !== title ? instance : undefined;
  // Clic → fiche Codex UNIQUEMENT pour une vraie entrée catalogue, hors mode popover-seul
  // (prop `tooltipOnly` ou contexte `CodexTooltipOnly`, ex. assistant de création).
  const interactive = !tooltipOnly && !ctxTooltipOnly && !!item;
  const open = () => { if (item) openCodex({ category, label: item.label, instance: inst }); };

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
          <span className="codex-pop" style={{ top: pos.top, left: pos.left, maxWidth: Math.min(POP_W, window.innerWidth - 16) }} role="tooltip">
            <span className="codex-pop-title">{inst ?? title}</span>
            {inst && <span className="codex-pop-sub">{title}</span>}
            {popSub && <span className="codex-pop-sub">{popSub}</span>}
            {metaLine && <span className="codex-pop-meta">{metaLine}</span>}
            {body && <span className="codex-pop-body">{body}</span>}
            {src && (
              <span className="codex-pop-foot">
                <span className="codex-src">{src.book} p.{src.page}</span>
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}
