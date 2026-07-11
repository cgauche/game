import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  /** Badge de comptage (primitive `.count`, cf. `styles/components.css`). */
  count?: number;
  /** Le badge de comptage passe en alerte (ex. erreurs de validation non résolues). */
  alert?: boolean;
}

const VARIANT_CLASS = { flat: '', pill: ' tabs-pill', sub: ' tabs-sub', dock: ' tabs-dock' } as const;

/**
 * Tabs — LA primitive UNIQUE de navigation par onglets (#314 : remplace les 5 systèmes gelés par le
 * cliquet #288 — `.port-tabs`/`.zone-tabs`/`.logic-tabs`/`.merchant-tabs`+`.merch-subtabs`/`.sheet-tabs`).
 * Markup et comportement UNIQUES (`role="tablist"`/`"tab"`, `aria-selected`, roving tabindex — flèches
 * Gauche/Droite/Home/End déplacent le focus ET activent l'onglet, cf. pattern WAI-ARIA Tabs) ; seule la
 * PRÉSENTATION varie par `variant` : `flat` (fiche/zone — soulignement), `pill` (marchand/fiche —
 * onglets boîtes), `sub` (sous-onglets marchand — pilules compactes), `dock` (panneau Logique repliable
 * de l'éditeur — `editor.css` compose la mise en page du dock autour). `trailing` reçoit un contrôle
 * HORS tablist (ex. replier/déplier le dock), rendu après les onglets dans la même rangée.
 */
export function Tabs<K extends string>({
  tabs,
  active,
  onChange,
  variant = 'flat',
  trailing,
  className,
  label,
}: {
  tabs: TabItem<K>[];
  /** Onglet actif ; `null` = aucun sélectionné (ex. dock replié). */
  active: K | null;
  onChange: (key: K) => void;
  variant?: 'flat' | 'pill' | 'sub' | 'dock';
  trailing?: ReactNode;
  className?: string;
  /** `aria-label` du tablist — à fournir quand le titre de l'écran ne le porte pas déjà. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    if (!tabs.length) return;
    e.preventDefault();
    e.stopPropagation(); // n'affronte pas le roving générique de useModalA11y quand Tabs vit dans une modale
    const idx = Math.max(0, tabs.findIndex((t) => t.key === active));
    const next =
      e.key === 'ArrowLeft' ? (idx - 1 + tabs.length) % tabs.length
      : e.key === 'ArrowRight' ? (idx + 1) % tabs.length
      : e.key === 'Home' ? 0
      : tabs.length - 1;
    onChange(tabs[next].key);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      className={`tabs${VARIANT_CLASS[variant]}${className ? ` ${className}` : ''}`}
      onKeyDown={onKeyDown}
    >
      {tabs.map((t, i) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          tabIndex={active === t.key || (active == null && i === 0) ? 0 : -1}
          className={`tab-btn${active === t.key ? ' active' : ''}${t.alert ? ' alert' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
      {trailing}
    </div>
  );
}
