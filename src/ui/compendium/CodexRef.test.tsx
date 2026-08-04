import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { computePopoverPos, CodexRef } from './CodexRef';

describe('computePopoverPos — placement du popover dans le viewport (anti-débordement)', () => {
  const VW = 1000;
  const VH = 800;

  it('déclencheur en HAUT → ancré par le haut (sous), maxHeight ≤ place disponible sous', () => {
    const p = computePopoverPos({ left: 100, top: 50, bottom: 70 }, VW, VH);
    expect(p.top).toBe(70 + 6);
    expect(p.bottom).toBeUndefined();
    expect(p.maxHeight).toBeLessThanOrEqual(VH - 70);
  });

  it('déclencheur en BAS → ancré par le bas (au-dessus), jamais hors viewport', () => {
    const p = computePopoverPos({ left: 100, top: 760, bottom: 780 }, VW, VH);
    expect(p.bottom).toBe(VH - 760 + 6);
    expect(p.top).toBeUndefined();
    expect(p.maxHeight).toBeLessThanOrEqual(760);
  });

  it('jamais top ET bottom simultanément, quelle que soit la position', () => {
    for (const top of [10, 200, 400, 600, 790]) {
      const p = computePopoverPos({ left: 0, top, bottom: top + 18 }, VW, VH);
      expect(p.top === undefined || p.bottom === undefined).toBe(true);
    }
  });

  it('viewport étroit (360px) → largeur et gauche bornées au viewport', () => {
    const p = computePopoverPos({ left: 950, top: 100, bottom: 120 }, 360, VH);
    expect(p.width).toBeLessThanOrEqual(360 - 16);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left).toBeLessThanOrEqual(360 - p.width - 8);
  });

  it('maxHeight plafonné à 0.6×vh', () => {
    const p = computePopoverPos({ left: 0, top: 400, bottom: 420 }, VW, VH);
    expect(p.maxHeight).toBeLessThanOrEqual(Math.floor(VH * 0.6));
  });
});

describe('CodexRef — affordance clic (#tooltipOnly bascule le popover, jamais un survol-only)', () => {
  // `mouvement` (catégorie `characteristics`) : entrée réelle garantie (source des chips
  // moveMod/moveScale, cf. `opRows.ts`) — pas de fixture ad hoc.
  it('tooltipOnly : le déclencheur est FOCUSABLE/CLIQUABLE (role=button, tabindex=0) — jamais survol seul', () => {
    const h = renderToStaticMarkup(<CodexRef category="characteristics" id="mouvement" label="Mouvement" tooltipOnly>Mouvement</CodexRef>);
    expect(h).toContain('role="button"');
    expect(h).toContain('tabindex="0"');
    // Fermé initialement : `aria-expanded="false"`, pas encore de popover porté (pinned=false au 1er rendu).
    expect(h).toContain('aria-expanded="false"');
    // Le clic ne doit PAS ouvrir la fiche Codex en mode `tooltipOnly` — aucune affordance « Ouvrir la fiche ».
    expect(h).not.toContain('codex-pop-open');
  });

  it('hors tooltipOnly (même entrée) : le clic ouvre la fiche — affordance visible, pas d’aria-expanded (pas de bascule popover)', () => {
    const h = renderToStaticMarkup(<CodexRef category="characteristics" id="mouvement" label="Mouvement">Mouvement</CodexRef>);
    expect(h).toContain('role="button"');
    expect(h).not.toContain('aria-expanded');
  });
});

describe('CodexRef — repli sans entrée catalogue (#956) : la surface garde sa mise en forme', () => {
  it('entrée INTROUVABLE : le repli porte `codex-ref` (le style de l’affordance mord) et la classe du site', () => {
    const h = renderToStaticMarkup(
      <CodexRef category="characteristics" id="entree-qui-n-existe-pas" label="Inconnue" className="ab-codex-info">Inconnue</CodexRef>,
    );
    expect(h).toContain('codex-ref');
    expect(h).toContain('ab-codex-info');
    // Rien n'est cliquable : aucune fiche à ouvrir.
    expect(h).not.toContain('role="button"');
  });
});
