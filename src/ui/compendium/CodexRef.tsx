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
import { codexLookup } from './registry';

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
  instance,
}: {
  category: string;
  label: string;
  /** Texte affiché si différent du libellé d'entrée (ex. libellé avec spécialisation). */
  children?: ReactNode;
  className?: string;
  /** Pour un déclencheur-icône (ℹ️) : ne rien rendre si l'entrée est inconnue (pas d'icône morte). */
  hideIfUnknown?: boolean;
  /** Instance paramétrée portant les Indices (« 8 Tentacules +8 ») — affichée en tête du popover
   *  et transmise au Codex à l'ouverture (le Codex « prend en compte les Indices »). */
  instance?: string;
}) {
  const openCodex = useGame((s) => s.openCodex);
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

  // Pas de fiche connue : icône-déclencheur → rien ; libellé → texte simple (jamais d'enrobage mort).
  if (!item) return hideIfUnknown ? null : <span className={className}>{children ?? label}</span>;

  const body = item.desc ? truncate(item.html ? stripHtml(item.desc) : item.desc) : null;
  const inst = instance && instance !== item.label ? instance : undefined;
  const open = () => openCodex({ category, label: item.label, instance: inst });

  return (
    <span
      ref={ref}
      className={`codex-ref${className ? ` ${className}` : ''}`}
      tabIndex={0}
      role="button"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children ?? label}
      {pos &&
        createPortal(
          <span className="codex-pop" style={{ top: pos.top, left: pos.left, maxWidth: Math.min(POP_W, window.innerWidth - 16) }} role="tooltip">
            <span className="codex-pop-title">{inst ?? item.label}</span>
            {inst && <span className="codex-pop-sub">{item.label}</span>}
            {item.sub && <span className="codex-pop-sub">{item.sub}</span>}
            {body && <span className="codex-pop-body">{body}</span>}
            {item.source && (
              <span className="codex-pop-foot">
                <span className="codex-src">{item.source.book} p.{item.source.page}</span>
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}
