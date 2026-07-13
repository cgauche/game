/**
 * Gabarit d'étape UNIQUE du créateur (arbitrage 2026-07-13) — 3 zones STABLES, identiques à chaque
 * étape, pour tuer l'instabilité du gabarit épinglée par le juge :
 *
 *   Zone A « le choix »  │  Zone B « le détail »   │  Zone C « la fiche vivante »
 *   (rail, slot libre :  │  (centre, TOUJOURS une   │  (CreatorSummary : structure
 *    grille ou form +     │   ParchmentCard : prose  │   stable dès l'étape 1, blocs
 *    « Aux dés » en tête)  │   sourcée / travail de   │   grisés qui se remplissent —
 *                          │   l'étape = l'ÉDITION)    │   le RÉSULTAT)
 *
 * Le centre montre l'ÉDITION (ce qu'on règle), la fiche montre le RÉSULTAT — source de vérité
 * UNIQUE des Caractéristiques. Chaque étape fournit `{ dice?, choice, detail }` ; la présence des
 * trois zones ne dépend jamais de l'étape.
 */
import type { ReactNode } from 'react';
import { CreatorDraft } from './draft';
import { CreatorSummary } from './CreatorSummary';
import { ParchmentCard } from '../ParchmentCard';

/** Zone B (le détail) : titre en font-display + corps ; `seal` = médaillon d100 quand un tirage est
 *  posé (la ParchmentCard le met en scène). */
export interface StepDetail {
  /** Titre de la ParchmentCard — omis quand le corps porte déjà son propre titre (TabbedEntry). */
  title?: ReactNode;
  seal?: { label?: string; roll: number };
  body: ReactNode;
}
/** Ce que produit chaque étape pour le gabarit. `dice` = cérémonie « Aux dés » en tête de Zone A. */
export interface StepZones {
  dice?: ReactNode;
  choice: ReactNode;
  detail: StepDetail;
}

export function CreatorStepFrame({ d, step, zones }: { d: CreatorDraft; step: number; zones: StepZones }) {
  return (
    <div className="creator-shell">
      <aside className="creator-rail">
        {zones.dice}
        {zones.choice}
      </aside>
      <main className="creator-main">
        <ParchmentCard seal={zones.detail.seal} title={zones.detail.title}>
          {zones.detail.body}
        </ParchmentCard>
      </main>
      <CreatorSummary d={d} step={step} />
    </div>
  );
}

/** Section de zone : titre en petites capitales + séparateur (pas de boîte flottante). */
export function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="zone-section">
      <h3>
        <span>{title}</span>
        {right && <span className="sect-right">{right}</span>}
      </h3>
      {children}
    </section>
  );
}

export function XpBadge({ value }: { value: number }) {
  return value > 0 ? <span className="xp-badge">+{value} PX</span> : null;
}

/** Stepper +/− avec compteur — l'outil d'allocation standard des créateurs de RPG. */
export function Stepper({ value, min = 0, max, onChange, disabled }: { value: number; min?: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <span className="stepper">
      <button type="button" className="btn small" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <b>{value}</b>
      <button type="button" className="btn small" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  );
}
