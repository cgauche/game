/**
 * CodexRef — primitive PARTAGÉE de référence contextuelle. Enrobe un libellé d'entité (talent,
 * compétence, équipement, état, sort, trait, signe…) : au survol/focus, un popover montre sa
 * description + sa source ; un bouton ouvre le Codex sur la fiche. C'est LA primitive popover du
 * jeu (il n'y en avait pas) — remplace les `title=desc` bruts et les libellés « nus ».
 *
 * Pur CSS pour l'affichage (`:hover` / `:focus-within`) : pas d'état, mobile = focus au tap.
 */
import type { ReactNode } from 'react';
import { useGame } from '../../state/store';
import { codexLookup } from './registry';

const stripHtml = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const clamp = (s: string, n = 260): string => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

export function CodexRef({
  category,
  label,
  children,
  className,
  hideIfUnknown = false,
}: {
  category: string;
  label: string;
  /** Texte affiché si différent du libellé d'entrée (ex. libellé avec spécialisation). */
  children?: ReactNode;
  className?: string;
  /** Pour un déclencheur-icône (ℹ️) : ne rien rendre si l'entrée est inconnue (pas d'icône morte). */
  hideIfUnknown?: boolean;
}) {
  const openCodex = useGame((s) => s.openCodex);
  const item = codexLookup(category, label);
  const text = children ?? label;

  // Pas de fiche connue : icône-déclencheur → rien ; libellé → texte simple (jamais d'enrobage mort).
  if (!item) return hideIfUnknown ? null : <span className={className}>{text}</span>;

  const body = item.desc ? clamp(item.html ? stripHtml(item.desc) : item.desc) : null;

  return (
    <span className={`codex-ref${className ? ` ${className}` : ''}`} tabIndex={0}>
      {text}
      <span className="codex-pop" role="tooltip">
        <span className="codex-pop-title">{item.label}</span>
        {item.sub && <span className="codex-pop-sub">{item.sub}</span>}
        {body && <span className="codex-pop-body">{body}</span>}
        <span className="codex-pop-foot">
          {item.source && <span className="codex-src">{item.source.book} p.{item.source.page}</span>}
          <button type="button" className="btn small" onClick={() => openCodex({ category, label: item.label })}>
            📖 Codex
          </button>
        </span>
      </span>
    </span>
  );
}
