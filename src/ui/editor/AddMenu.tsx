/**
 * MENU D'AJOUT de l'atelier — définition UNIQUE du motif « bouton + liste groupée de blocs à
 * insérer » : « + Effet » (EffectList), « + Bloc » (FlowEditor), « + Op mécanique » (GameOpEditor).
 * Les rangées composent la primitive canon `ListRow` ; le menu se PLACE dans le viewport (fixe,
 * bascule au-dessus du bouton quand le dessous manque, hauteur bornée à la place réelle). Ses
 * boutons vivent dans des panneaux DÉFILANTS collés au bas de l'écran (dock Logique) : un menu posé
 * dans le flux de son ancêtre y serait rogné par l'`overflow` de celui-ci et sortirait de l'écran.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ListRow } from '../ListRow';

/** VOCABULAIRE d'un menu : les types offerts, groupés, SANS action. Un registre le publie une fois
 *  (`EFFECT_MENU_GROUPS`, `OP_MENU_GROUPS`) et tous ses menus le partagent — c'est ce qui garantit
 *  qu'ajouter et changer de type proposent EXACTEMENT la même liste. */
export interface TypeMenuItem {
  key: string;
  label: ReactNode;
}
export interface TypeMenuGroup {
  title: string;
  items: TypeMenuItem[];
}

export interface AddMenuItem extends TypeMenuItem {
  onPick: () => void;
}
export interface AddMenuGroup {
  title: string;
  items: AddMenuItem[];
}

/** Unique passage du VOCABULAIRE à un menu ACTIONNABLE. */
export function pickable(groups: TypeMenuGroup[], onPick: (key: string) => void): AddMenuGroup[] {
  return groups.map((group) => ({
    title: group.title,
    items: group.items.map((item) => ({ ...item, onPick: () => onPick(item.key) })),
  }));
}

/** Doit suivre la largeur de `.eff-add-menu` (editor.css) : le placement borne le débord latéral. */
const MENU_W = 330;
/** Hauteur MAXIMALE souhaitée ; la place réellement disponible la réduit encore. */
const MENU_MAX_H = 320;
/** Marge au bord du viewport et écart au bouton. */
const EDGE = 8;
const GAP = 4;

interface Box {
  top: number;
  left: number;
  maxHeight: number;
}

/** Coordonnées FIXES du menu pour un bouton donné : sous le bouton s'il y a plus de place dessous,
 *  au-dessus sinon, hauteur bornée à cette place. Exportée pour être vérifiable sans navigateur. */
export function placeMenu(
  anchor: { top: number; bottom: number; left: number },
  viewport: { width: number; height: number },
): Box {
  const below = viewport.height - anchor.bottom - GAP - EDGE;
  const above = anchor.top - GAP - EDGE;
  const down = below >= above;
  const maxHeight = Math.max(0, Math.min(MENU_MAX_H, down ? below : above));
  return {
    top: down ? anchor.bottom + GAP : anchor.top - GAP - maxHeight,
    left: Math.max(EDGE, Math.min(anchor.left, viewport.width - MENU_W - EDGE)),
    maxHeight,
  };
}

export function AddMenu({ label, groups }: { label: string; groups: AddMenuGroup[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    const summary = el?.querySelector('summary');
    if (!el || !summary || !el.open) {
      setBox(null);
      return;
    }
    const r = summary.getBoundingClientRect();
    setBox(placeMenu(r, { width: window.innerWidth, height: window.innerHeight }));
  }, []);

  // Le menu est FIXE au viewport pour tenir entier à l'écran ; il doit donc se REPOSER à chaque fois
  // que son bouton bouge sous lui. Le défilement d'un panneau ancêtre ne bouillonne pas : on l'écoute
  // à la CAPTURE, sur la fenêtre, ce qui couvre tous les conteneurs défilants de l'atelier.
  const ouvert = box !== null;
  useEffect(() => {
    if (!ouvert) return;
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [ouvert, place]);

  const pick = (item: AddMenuItem) => () => {
    if (ref.current) ref.current.open = false;
    setBox(null);
    item.onPick();
  };

  return (
    <details className="eff-add" ref={ref} onToggle={place}>
      <summary className="btn small">{label}</summary>
      <div
        className="eff-add-menu panel"
        style={box ? { top: box.top, left: box.left, maxHeight: box.maxHeight } : undefined}
      >
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mini-title">{g.title}</div>
            {g.items.map((it) => (
              <ListRow key={it.key} label={it.label} onClick={pick(it)} />
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

/** Report des valeurs connues sur un bloc NEUF : le type visé décide des champs qui existent, la
 *  mémoire fournit leurs valeurs. Le discriminant reste celui du type visé. Pure, donc vérifiable
 *  sans navigateur. */
export function convertTo<T extends object>(fresh: T, memoire: Record<string, unknown>, discriminant: string): T {
  const out: Record<string, unknown> = { ...(fresh as Record<string, unknown>) };
  for (const key of Object.keys(out)) {
    if (key === discriminant) continue;
    if (memoire[key] !== undefined) out[key] = memoire[key];
  }
  return out as T;
}

/** CHANGER le type d'un bloc déjà authoré. Même primitive, même vocabulaire et même geste
 *  DÉLIBÉRÉ que l'ajout (`AddMenu`) — et CONVERSION, jamais fabrication : les champs que le type
 *  visé connaît aussi gardent leur valeur, et ceux qu'il ignore attendent dans la mémoire de la
 *  rangée, de sorte qu'un aller-retour de type rende le texte saisi. Le document, lui, ne porte
 *  jamais que les champs du type courant. */
export function TypeMenu<T extends object>({
  value,
  discriminant,
  currentLabel,
  groups,
  make,
  onChange,
}: {
  value: T;
  /** Nom du champ qui PORTE le type (`type` pour un Effect, `op` pour un GameOp). */
  discriminant: string;
  currentLabel: string;
  groups: TypeMenuGroup[];
  make: (key: string) => T;
  onChange: (next: T) => void;
}) {
  const memoire = useRef<Record<string, unknown>>({});
  return (
    <AddMenu
      label={`Type : ${currentLabel}`}
      groups={pickable(groups, (key) => {
        memoire.current = { ...memoire.current, ...(value as Record<string, unknown>) };
        onChange(convertTo(make(key), memoire.current, discriminant));
      })}
    />
  );
}
