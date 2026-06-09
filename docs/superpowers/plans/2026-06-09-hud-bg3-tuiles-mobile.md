# HUD de jeu façon BG3 (tuiles-portraits, plein-champ, mobile-first) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Remplacer les colonnes fixes du HUD (gauche 280 px / droite 320 px) par des overlays
flottants sur le champ : frise d'initiative en haut + fil d'événements dessous, dock d'équipe à
gauche, journal en tiroir, menu ☰, chip date — en tuiles-portraits compactes, jouable sur mobile.

**Spec :** `docs/superpowers/specs/2026-06-09-hud-combat-bg3-design.md` (v4 validée).

**Architecture :** 5 nouveaux composants UI **purs à props** (pas de lecture du store — testables en
`renderToStaticMarkup`, piège SSR-Zustand connu) : `PortraitTile` (brique), `InitiativeStrip`,
`PartyDock`, `LogDrawer`, `GameMenu`. `CampaignView` (seul câblé au store) monte tout. Suppression
franche de `BattlePanel`, `LegendPanel`, `GroupPanel`. Affichage seul — zéro changement moteur/store.

**Tech stack :** React 18 + TypeScript, Zustand (lecture dans CampaignView uniquement), Vitest +
`renderToStaticMarkup` (pattern `InspectPanel.test.tsx`), CSS dans `src/ui/styles.css`.

**⚠️ Arbre partagé (sessions parallèles) :** `CampaignView.tsx`, `CombatBanner.tsx` et `styles.css`
bougent sous d'autres sessions (le fil est devenu `.combat-feed` le 2026-06-09). **Relire chaque
fichier juste avant de l'éditer** ; fusionner avec l'état frais, ne jamais coller un état mémorisé.
Committer avec pathspec (`git commit -- <fichiers>`), jamais `--amend`.

**Commandes (PowerShell natif — l'outil Bash est lent sur cette machine) :**
- Test ciblé : `npx vitest run src/ui/PortraitTile.test.tsx`
- Suite : `npm test` · Types : `npm run typecheck`

---

## Référence rapide des briques existantes (NE PAS recréer)

| Brique | Source | Signature utile |
| --- | --- | --- |
| Portrait visage | `src/ui/RigPortrait.tsx` | `<RigPortrait combatant size ring />` — bordure 2 px `ring`, pleine héros / tirets ennemi (R9) |
| Couleur barre PV | `src/gameIso/teamColors.ts` | `hpColor(ratio)` → `#2ecc71` sain · `#e8a33d` entamé · `#e74c3c` critique · `#922b21` à 0 |
| Couleurs équipe/identité | idem | `ALLY_TINT`/`ENEMY_TINT` (frise), `HERO_RING[idx]` (dock), `ACTIVE_RING` |
| Résumé d'états | `src/gameIso/effectIcons.ts` | `summarizeEffects(conditions, effects, max, flags)` → `{visible: EffectChip[], moreCount}` ; `combatantFlags(c)` |
| Narration journal | `src/gameIso/combatNarration.ts` | `narrateEvent(ev, combatants)` → `{icon, segments[{text, team?}]}` |
| Événement | `src/state/combatLog.ts` | `CombatEvent { kind, text, actorId?, targetId? }` |
| Pré-emption d'initiative | `src/state/turnEconomy.ts` | `canActFirst(c, battle)` (pur) |
| Monnaie | `src/engine/money.ts` | `formatMoney(money)` ; `Money { gold, silver, brass }` |
| Horloge | `src/engine/clock.ts` | `toDate(min)` → `{day, monthName, intercalary, weekday…}` ; `dayPhase(min)` → `{icon, label}` ; `formatImperial(min)` |
| KO visuel | `styles.css` `.ko-cross` | croix rouge superposée (réutilisée telle quelle) |

KO (affichage) = `c.dead || c.wounds.current <= 0 || c.conditions.some(x => x.name === 'Inconscient')`
(même expression que l'actuel BattlePanel/GroupPanel).

---

### Task 1 : `PortraitTile` — la brique partagée

**Files:**
- Create: `src/ui/PortraitTile.tsx`
- Create: `src/ui/PortraitTile.test.tsx`
- Modify: `src/ui/styles.css` (append bloc `.ptile-*`)

- [ ] **Step 1 : écrire le test (rouge)**

```tsx
// src/ui/PortraitTile.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortraitTile } from './PortraitTile';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

const base = () => createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Gunnar', rng: makeRNG(3) });

describe('PortraitTile', () => {
  it('jauge verticale : pleine et verte à PV max', () => {
    const c = base();
    c.wounds = { current: 12, max: 12 };
    const html = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(html).toContain('ptile-gauge');
    expect(html).toContain('height:100%');
    expect(html).toContain('#2ecc71'); // hpColor(1) — vert sain
  });

  it('jauge rouge en zone critique (≤34 %)', () => {
    const c = base();
    c.wounds = { current: 3, max: 12 }; // ratio 0.25
    const html = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(html).toContain('height:25%');
    expect(html).toContain('#e74c3c'); // hpColor critique
  });

  it('PV chiffrés DANS le portrait seulement si showPv', () => {
    const c = base();
    c.wounds = { current: 11, max: 11 };
    expect(renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" showPv />)).toContain('11/11');
    expect(renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />)).not.toContain('11/11');
  });

  it('≤ 4 états visibles puis chevron ▾', () => {
    const c = base();
    c.conditions = [
      { name: 'Sonné', value: 1 }, { name: 'À Terre', value: 1 }, { name: 'Aveuglé', value: 1 },
      { name: 'Empoisonné', value: 2 }, { name: 'Hémorragique', value: 1 },
    ] as Combatant['conditions'];
    const html = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(html).toContain('💫'); // Sonné (sévérité max → 1er)
    expect(html).toContain('▾'); // 5 états → 4 + débordement
    expect(html).not.toContain('🩸'); // Hémorragique (sévérité min) débordé
    // 2 états → pas de chevron
    c.conditions = [{ name: 'Sonné', value: 1 }, { name: 'À Terre', value: 1 }] as Combatant['conditions'];
    expect(renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />)).not.toContain('▾');
  });

  it('KO : croix + classe ko ; actif : classe active + caret', () => {
    const c = base();
    c.wounds = { current: 0, max: 12 };
    const ko = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(ko).toContain('ko-cross');
    expect(ko).toContain('✕');
    const c2 = base();
    const act = renderToStaticMarkup(<PortraitTile c={c2} ring="#4f8fe0" active />);
    expect(act).toContain('active');
    expect(act).toContain('▼');
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/ui/PortraitTile.test.tsx`
Attendu : FAIL (« Cannot find module './PortraitTile' »).

- [ ] **Step 3 : implémenter le composant**

```tsx
// src/ui/PortraitTile.tsx
import { RigPortrait } from './RigPortrait';
import { hpColor } from '../gameIso/teamColors';
import { summarizeEffects, combatantFlags } from '../gameIso/effectIcons';
import type { Combatant } from '../engine/types';

/**
 * Tuile-portrait compacte (HUD façon BG3, mobile-first) — remplace les lignes « Portrait — 11/11 ».
 * Portrait visage (RigPortrait, cadre = `ring`, plein héros / tirets ennemi), JAUGE DE PV VERTICALE
 * à l'intérieur (bord gauche, vert→orange→rouge via hpColor), PV chiffrés DANS le portrait (option),
 * états en colonne À DROITE (max 4 + « ▾ » en débordement — le détail se lit au TAP, pas au survol).
 * Pur à props (testable en SSR), aucune lecture du store.
 */
export interface PortraitTileProps {
  c: Combatant;
  /** Couleur du cadre : teinte d'équipe (frise) ou couleur d'identité du héros (dock). */
  ring: string;
  /** Côté de la vignette en px (dock 56, frise 40). */
  size?: number;
  /** Unité active : surbrillance or + caret ▼. */
  active?: boolean;
  /** PV chiffrés dans le portrait (dock d'équipe seulement, cf. spec). */
  showPv?: boolean;
  maxStates?: number;
  onClick?: () => void;
  title?: string;
}

export function PortraitTile({ c, ring, size = 56, active, showPv, maxStates = 4, onClick, title }: PortraitTileProps) {
  const ratio = c.wounds.max > 0 ? Math.max(0, Math.min(1, c.wounds.current / c.wounds.max)) : 0;
  const ko = c.dead || c.wounds.current <= 0 || c.conditions.some((x) => x.name === 'Inconscient');
  const all = summarizeEffects(c.conditions, c.activeEffects, Infinity, combatantFlags(c)).visible;
  const shown = all.slice(0, maxStates);
  const more = all.slice(maxStates);
  return (
    <div className="ptile-wrap">
      <button
        type="button"
        className={`ptile ${active ? 'active' : ''} ${ko ? 'ko' : ''}`}
        style={{ width: size, height: size }}
        onClick={onClick}
        title={title ?? c.name}
      >
        {active && <i className="ptile-caret">▼</i>}
        <RigPortrait combatant={c} size={size} ring={ring} />
        <i className="ptile-gauge">
          <b style={{ height: `${Math.round(ratio * 100)}%`, background: hpColor(ratio) }} />
        </i>
        {showPv && <span className="ptile-pv">{c.dead ? '☠️' : `${c.wounds.current}/${c.wounds.max}`}</span>}
        {ko && <span className="ko-cross">✕</span>}
      </button>
      {(shown.length > 0 || more.length > 0) && (
        <span className="ptile-states">
          {shown.map((v) => (
            <span key={v.key} className="pt-state" title={v.count && v.count > 1 ? `${v.label} ×${v.count}` : v.label}>
              {v.icon}
            </span>
          ))}
          {more.length > 0 && (
            <span className="pt-state ptile-more" title={more.map((m) => m.label).join(' · ')}>▾</span>
          )}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4 : ajouter le CSS (append en fin de `styles.css`, après re-lecture du fichier)**

```css
/* ── HUD plein-champ façon BG3 (mobile-first) — tuiles-portraits ───────────── */
.ptile-wrap {
  display: flex;
  align-items: flex-start;
  gap: 3px;
  pointer-events: auto;
}
.ptile {
  position: relative;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 0;
  border-radius: 9px;
  flex: 0 0 auto;
}
.ptile .rig-portrait {
  display: block;
  width: 100%;
  height: 100%;
}
.ptile.active {
  outline: 2px solid #ffe066;
  outline-offset: 1px;
  box-shadow: 0 0 10px rgba(255, 224, 102, 0.5);
}
.ptile.ko .rig-portrait {
  filter: grayscale(0.9);
  opacity: 0.6;
}
.ptile-caret {
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  color: #ffe066;
  font-size: 10px;
  font-style: normal;
  line-height: 1;
  text-shadow: 0 0 3px #000;
  pointer-events: none;
}
.ptile-gauge {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: 5px;
  background: rgba(0, 0, 0, 0.65);
  border-radius: 3px;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  pointer-events: none;
}
.ptile-gauge b {
  display: block;
  width: 100%;
}
.ptile-pv {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 1px;
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 3px #000, 0 1px 2px #000;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  line-height: 1.2;
}
.ptile .ko-cross {
  font-size: 22px;
}
.ptile-states {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 12px;
  line-height: 1.15;
  text-shadow: 0 0 3px #000;
}
.ptile-more {
  color: var(--muted);
  font-weight: 700;
  cursor: default;
}
```

- [ ] **Step 5 : vérifier le vert**

Run : `npx vitest run src/ui/PortraitTile.test.tsx` → PASS (5 tests).

- [ ] **Step 6 : commit**

```powershell
git add src/ui/PortraitTile.tsx src/ui/PortraitTile.test.tsx src/ui/styles.css
git commit -m "feat(ui): PortraitTile — tuile-portrait (jauge PV verticale interne, PV chiffrés, 4 états + chevron)" -- src/ui/PortraitTile.tsx src/ui/PortraitTile.test.tsx src/ui/styles.css
```

---

### Task 2 : `InitiativeStrip` — frise d'initiative (haut)

**Files:**
- Create: `src/ui/InitiativeStrip.tsx`
- Create: `src/ui/InitiativeStrip.test.tsx`
- Modify: `src/ui/styles.css` (append bloc `.initiative-strip`)

- [ ] **Step 1 : écrire le test (rouge)**

```tsx
// src/ui/InitiativeStrip.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InitiativeStrip } from './InitiativeStrip';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

function fixtures() {
  const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Gunnar', rng: makeRNG(3) });
  h.id = 'h1';
  const foe = { ...createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Brigand', rng: makeRNG(5) }), id: 'e1', kind: 'enemy' as Combatant['kind'] };
  return { h, foe };
}
const noop = () => {};

describe('InitiativeStrip', () => {
  it('rend les tuiles dans l’ordre de battle.order et marque l’actif', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={1} round={2} combatants={[h, foe]} over={false}
        pendingRound={null} canFirstIds={[]} inspectEnabled={false} onToggleInspect={noop} onPromote={noop} />,
    );
    expect(html.indexOf('Brigand')).toBeGreaterThan(-1);
    expect(html.indexOf('Brigand')).toBeLessThan(html.indexOf('Gunnar')); // ordre = order[]
    expect(html).toContain('Round 2');
    expect(html.match(/▼/g)?.length).toBe(1); // un seul actif (turn=1)
  });

  it('pause de début de Round : badge ⏫ sur les héros éligibles', () => {
    const { h, foe } = fixtures();
    h.fortune = 2;
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={0} round={3} combatants={[h, foe]} over={false}
        pendingRound={3} canFirstIds={['h1']} inspectEnabled={false} onToggleInspect={noop} onPromote={noop} />,
    );
    expect(html).toContain('⏫');
    expect(html).toContain('Round 3'); // chip + hint de pause
  });

  it('toggle 🔍 présent (On si inspection activée)', () => {
    const { h, foe } = fixtures();
    const off = renderToStaticMarkup(
      <InitiativeStrip order={['h1']} turn={0} round={1} combatants={[h, foe]} over={false}
        pendingRound={null} canFirstIds={[]} inspectEnabled={false} onToggleInspect={noop} onPromote={noop} />,
    );
    expect(off).toContain('🔍');
    const on = renderToStaticMarkup(
      <InitiativeStrip order={['h1']} turn={0} round={1} combatants={[h, foe]} over={false}
        pendingRound={null} canFirstIds={[]} inspectEnabled={true} onToggleInspect={noop} onPromote={noop} />,
    );
    expect(on).toContain('On');
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/ui/InitiativeStrip.test.tsx` → FAIL (module absent).

- [ ] **Step 3 : implémenter**

```tsx
// src/ui/InitiativeStrip.tsx
import { PortraitTile } from './PortraitTile';
import { ALLY_TINT, ENEMY_TINT } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/**
 * Frise d'INITIATIVE (haut du champ, façon BG3) : une tuile-portrait par combattant dans l'ordre
 * du Round (`battle.order`), cadre = teinte d'ÉQUIPE (vert allié / rouge ennemi — la forme
 * pleine/tirets du cadre vient de RigPortrait, R9 daltonisme), actif = or + ▼, KO grisé ✕.
 * Pendant la pause de début de Round (LDB ch.17 l.27), badge « ⏫🍀 » sous les héros éligibles
 * (pré-emption d'initiative — l'ancien « Agir en premier » de BattlePanel). Chip « Round N » +
 * toggle 🔍 d'inspection au bout. Pur à props — câblé par CampaignView.
 */
export interface InitiativeStripProps {
  order: string[];
  turn: number;
  round: number;
  combatants: Combatant[];
  /** battle.over != null → plus de marqueur actif. */
  over: boolean;
  /** Round de la pause d'initiative en cours (pendingRoundStart), sinon null. */
  pendingRound: number | null;
  /** Ids des combattants pouvant « agir en premier » (canActFirst, calculé par CampaignView). */
  canFirstIds: string[];
  inspectEnabled: boolean;
  onToggleInspect: () => void;
  onInspect?: (id: string) => void;
  onPromote: (id: string) => void;
}

export function InitiativeStrip(p: InitiativeStripProps) {
  return (
    <div className="initiative-strip">
      <div className="is-tiles">
        {p.order.map((id, i) => {
          const c = p.combatants.find((x) => x.id === id);
          if (!c) return null;
          const isHero = c.kind === 'hero';
          return (
            <div key={id} className="is-cell">
              <PortraitTile
                c={c}
                ring={isHero ? ALLY_TINT : ENEMY_TINT}
                size={40}
                active={!p.over && i === p.turn}
                onClick={p.onInspect ? () => p.onInspect!(id) : undefined}
                title={p.onInspect ? `${c.name} — inspecter` : c.name}
              />
              {p.canFirstIds.includes(id) && (
                <button
                  type="button"
                  className="is-first"
                  onClick={() => p.onPromote(id)}
                  title={`Dépense 1 point de Chance pour qu'${c.name} agisse en premier ce Round (LDB Destin)`}
                >
                  ⏫🍀{c.fortune ?? 0}
                </button>
              )}
            </div>
          );
        })}
        <span className="is-round">Round {p.round}</span>
        <button
          type="button"
          className={`inspect-toggle ${p.inspectEnabled ? 'on' : ''}`}
          onClick={p.onToggleInspect}
          title={p.inspectEnabled ? 'Inspection activée — tape un portrait pour voir son statbloc. Cliquer pour désactiver.' : 'Activer l’inspection des combattants (statbloc au tap sur la frise)'}
        >
          🔍 {p.inspectEnabled ? 'On' : 'Off'}
        </button>
      </div>
      {p.pendingRound != null && <div className="is-pause">⏳ Round {p.pendingRound} — choisis qui agit en premier</div>}
    </div>
  );
}
```

- [ ] **Step 4 : CSS (append)**

```css
/* ── Frise d'initiative (haut, centrée) ── */
.initiative-strip {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 45;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  max-width: min(88vw, 860px);
}
.is-tiles {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 6px 8px 4px;
  background: rgba(10, 14, 20, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  backdrop-filter: blur(3px);
  overflow-x: auto;
  scrollbar-width: thin;
}
.is-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-top: 12px; /* place pour le caret ▼ de l'actif */
}
.is-round {
  align-self: center;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  padding: 0 2px;
}
.is-tiles .inspect-toggle {
  align-self: center;
}
.is-first {
  font-size: 10px;
  background: rgba(255, 224, 102, 0.14);
  border: 1px solid rgba(255, 224, 102, 0.5);
  border-radius: 6px;
  color: #ffe066;
  padding: 1px 4px;
  cursor: pointer;
  white-space: nowrap;
}
.is-pause {
  font-size: 11px;
  color: #ffe066;
  background: rgba(10, 14, 20, 0.7);
  border-radius: 10px;
  padding: 2px 10px;
}
@media (max-width: 700px) {
  .initiative-strip { top: 6px; max-width: 96vw; }
  .is-tiles { gap: 5px; padding: 4px 6px 3px; }
  .ptile-states { font-size: 10px; }
}
```

- [ ] **Step 5 : vérifier le vert**

Run : `npx vitest run src/ui/InitiativeStrip.test.tsx` → PASS (3 tests).

- [ ] **Step 6 : commit**

```powershell
git add src/ui/InitiativeStrip.tsx src/ui/InitiativeStrip.test.tsx src/ui/styles.css
git commit -m "feat(ui): InitiativeStrip — frise d'initiative en tuiles (actif, ⏫ pré-emption, 🔍, Round N)" -- src/ui/InitiativeStrip.tsx src/ui/InitiativeStrip.test.tsx src/ui/styles.css
```

---

### Task 3 : `PartyDock` — équipe à gauche

**Files:**
- Create: `src/ui/PartyDock.tsx`
- Create: `src/ui/PartyDock.test.tsx`
- Modify: `src/ui/styles.css` (append)

- [ ] **Step 1 : test (rouge)**

```tsx
// src/ui/PartyDock.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PartyDock } from './PartyDock';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

describe('PartyDock', () => {
  const h1 = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Gunnar', rng: makeRNG(3) });
  const h2 = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Elsa', rng: makeRNG(4) });
  h1.id = 'h1'; h2.id = 'h2';

  it('une tuile par héros, PV chiffrés affichés, actif marqué', () => {
    h1.wounds = { current: 11, max: 11 };
    const html = renderToStaticMarkup(<PartyDock heroes={[h1, h2]} activeId="h2" onOpen={() => {}} />);
    expect(html).toContain('party-dock');
    expect(html).toContain('11/11'); // showPv sur le dock
    expect(html.match(/▼/g)?.length).toBe(1); // h2 actif
  });
});
```

- [ ] **Step 2 : échec**

Run : `npx vitest run src/ui/PartyDock.test.tsx` → FAIL (module absent).

- [ ] **Step 3 : implémenter**

```tsx
// src/ui/PartyDock.tsx
import { PortraitTile } from './PortraitTile';
import { HERO_RING } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/**
 * Dock d'ÉQUIPE (bord gauche, façon BG3) — remplace le panneau Groupe dans les DEUX modes.
 * Une tuile-portrait par héros : cadre = couleur d'IDENTITÉ (HERO_RING, cohérente avec les anneaux
 * du champ), PV chiffrés DANS le portrait, états à droite ; tap = fiche perso (CharacterSheet).
 * En combat, passer la version « vivante » des héros (battle.combatants). Pur à props.
 */
export function PartyDock({ heroes, activeId, onOpen }: {
  heroes: Combatant[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="party-dock">
      {heroes.map((c, idx) => (
        <PortraitTile
          key={c.id}
          c={c}
          ring={HERO_RING[idx % HERO_RING.length]}
          size={56}
          active={c.id === activeId}
          showPv
          onClick={() => onOpen(c.id)}
          title={`${c.name} — fiche du personnage`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4 : CSS (append)**

```css
/* ── Dock d'équipe (gauche) ── */
.party-dock {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 45;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
@media (max-width: 700px) {
  .party-dock { left: 6px; gap: 8px; }
}
```

- [ ] **Step 5 : vert** — `npx vitest run src/ui/PartyDock.test.tsx` → PASS.

- [ ] **Step 6 : commit**

```powershell
git add src/ui/PartyDock.tsx src/ui/PartyDock.test.tsx src/ui/styles.css
git commit -m "feat(ui): PartyDock — équipe en tuiles-portraits à gauche (combat + exploration)" -- src/ui/PartyDock.tsx src/ui/PartyDock.test.tsx src/ui/styles.css
```

---

### Task 4 : `LogDrawer` — journal en tiroir (2 contenus)

**Files:**
- Create: `src/ui/LogDrawer.tsx`
- Create: `src/ui/LogDrawer.test.tsx`
- Modify: `src/ui/styles.css` (append)

- [ ] **Step 1 : test (rouge)**

```tsx
// src/ui/LogDrawer.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LogDrawer } from './LogDrawer';
import { ev } from '../state/combatLog';

const COMBATANTS = [
  { id: 'h1', name: 'Gunnar', kind: 'hero' },
  { id: 'e1', name: 'Brigand', kind: 'enemy' },
];

describe('LogDrawer', () => {
  it('replié par défaut : seulement le bouton 📜', () => {
    const html = renderToStaticMarkup(<LogDrawer battle={null} journal={['Vous entrez dans la taverne.']} />);
    expect(html).toContain('📜');
    expect(html).not.toContain('taverne');
  });

  it('ouvert en exploration : lignes du journal du groupe', () => {
    const html = renderToStaticMarkup(<LogDrawer battle={null} journal={['Vous entrez dans la taverne.']} initialOpen />);
    expect(html).toContain('taverne');
  });

  it('ouvert en combat : événements narrés (icône par kind, nom coloré par camp)', () => {
    const battle = { log: [ev('attack', 'Gunnar attaque Brigand', 'h1', 'e1')], combatants: COMBATANTS };
    const html = renderToStaticMarkup(<LogDrawer battle={battle} journal={[]} initialOpen />);
    expect(html).toContain('⚔️'); // icône du kind attack
    expect(html).toContain('Gunnar');
    expect(html).toContain('nm-ally'); // nom allié coloré par camp
  });
});
```

- [ ] **Step 2 : échec** — `npx vitest run src/ui/LogDrawer.test.tsx` → FAIL.

- [ ] **Step 3 : implémenter**

```tsx
// src/ui/LogDrawer.tsx
import { useState } from 'react';
import { narrateEvent } from '../gameIso/combatNarration';
import type { CombatEvent } from '../state/combatLog';

/** Forme minimale acceptée pour les combattants (suffit à `narrateEvent` — id/name/kind). */
interface ComLite { id: string; name: string; kind: string; }

/**
 * Journal en TIROIR (bas-droite, replié par défaut — façon BG3, mobile-first).
 * Deux contenus, un composant : en combat les événements structurés `battle.log` rendus par
 * `narrateEvent` (icône par kind + noms colorés par camp) ; en exploration le journal du groupe.
 * `initialOpen` = aide de test (SSR sans interaction). Pur à props.
 */
export function LogDrawer({ battle, journal, initialOpen = false }: {
  battle: { log: CombatEvent[]; combatants: ComLite[] } | null;
  journal: string[];
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className={`log-drawer ${open ? 'open' : ''}`}>
      {open && (
        <div className="ld-panel">
          <div className="mini-title">{battle ? 'Journal de combat' : 'Journal'}</div>
          {battle
            ? battle.log.slice(-30).map((l, i) => {
                const n = narrateEvent(l, battle.combatants);
                return (
                  <p key={i} className="jr-line">
                    <span className="jr-ic">{n.icon}</span>
                    <span className="jr-tx">
                      {n.segments.map((s, j) =>
                        s.team ? (
                          <b key={j} className={s.team === 'ally' ? 'nm-ally' : 'nm-foe'}>{s.text}</b>
                        ) : (
                          <span key={j}>{s.text}</span>
                        ),
                      )}
                    </span>
                  </p>
                );
              })
            : journal.slice(-30).map((l, i) => (
                <p key={i} className="jr-line"><span className="jr-tx">{l}</span></p>
              ))}
          {!battle && journal.length === 0 && <p className="empty">— rien à signaler —</p>}
        </div>
      )}
      <button type="button" className="ld-btn" onClick={() => setOpen(!open)} title={open ? 'Fermer le journal' : 'Ouvrir le journal'}>
        📜
      </button>
    </div>
  );
}
```

Note type : le prop `combatants: ComLite[]` est structurel — `battle.combatants` (Combatant[],
plus riche) s'y assigne tel quel, et `narrateEvent` accepte la même forme minimale.

- [ ] **Step 4 : CSS (append)**

```css
/* ── Tiroir journal (bas-droite) ── */
.log-drawer {
  position: absolute;
  right: 12px;
  bottom: 92px; /* au-dessus de la barre d'action — calibrer en recette */
  z-index: 46;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.ld-btn {
  width: 42px;
  height: 42px;
  border-radius: 9px;
  background: #1c2230;
  border: 1.5px solid #3a4660;
  color: #cfe6ff;
  font-size: 19px;
  cursor: pointer;
  opacity: 0.92;
}
.log-drawer.open .ld-btn {
  border-color: #ffe066;
}
.ld-panel {
  width: min(330px, 86vw);
  max-height: 38vh;
  overflow: auto;
  background: rgba(16, 16, 22, 0.93);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
}
@media (max-width: 700px) {
  .log-drawer { right: 8px; bottom: 88px; }
}
```

- [ ] **Step 5 : vert** — `npx vitest run src/ui/LogDrawer.test.tsx` → PASS.

- [ ] **Step 6 : commit**

```powershell
git add src/ui/LogDrawer.tsx src/ui/LogDrawer.test.tsx src/ui/styles.css
git commit -m "feat(ui): LogDrawer — journal en tiroir replié (combat narré / journal du groupe)" -- src/ui/LogDrawer.tsx src/ui/LogDrawer.test.tsx src/ui/styles.css
```

---

### Task 5 : `GameMenu` — menu ☰ (les deux modes)

**Files:**
- Create: `src/ui/GameMenu.tsx`
- Create: `src/ui/GameMenu.test.tsx`
- Modify: `src/ui/styles.css` (append)

- [ ] **Step 1 : test (rouge)**

```tsx
// src/ui/GameMenu.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameMenu } from './GameMenu';
import { formatMoney } from '../engine/money';

const money = { gold: 1, silver: 2, brass: 3 };

describe('GameMenu', () => {
  it('fermé par défaut : seulement le bouton ☰', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" money={money} inventory={['Lettre scellée']} dateLine="🌄 Matin — Marktag · 33 Jahrdrung 2512 CI · 08:00" onQuit={() => {}} />,
    );
    expect(html).toContain('☰');
    expect(html).not.toContain('Bourse');
  });

  it('ouvert : scène, bourse, inventaire, date complète, Quitter', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" money={money} inventory={['Lettre scellée']} dateLine="🌄 Matin — Marktag · 33 Jahrdrung 2512 CI · 08:00" onQuit={() => {}} initialOpen />,
    );
    expect(html).toContain('La taverne');
    expect(html).toContain('Bourse');
    expect(html).toContain(formatMoney(money));
    expect(html).toContain('Lettre scellée');
    expect(html).toContain('Marktag');
    expect(html).toContain('Quitter');
  });

  it('inventaire vide : mention « vide »', () => {
    const html = renderToStaticMarkup(
      <GameMenu money={money} inventory={[]} dateLine="🌙 Nuit" onQuit={() => {}} initialOpen />,
    );
    expect(html).toContain('vide');
  });
});
```

- [ ] **Step 2 : échec** — `npx vitest run src/ui/GameMenu.test.tsx` → FAIL.

- [ ] **Step 3 : implémenter**

```tsx
// src/ui/GameMenu.tsx
import { useState } from 'react';
import { formatMoney, type Money } from '../engine/money';

/**
 * Menu ☰ du jeu (haut-gauche, COMBAT et EXPLORATION — mobile-first). Regroupe ce qui a quitté
 * l'écran : nom de la scène, Bourse, Inventaire du groupe (handouts/butin party-level), date
 * complète du Calendrier Impérial, et « Quitter la partie » (retour à l'écran de groupe — parité
 * avec l'ancien bouton toujours visible). `initialOpen` = aide de test. Pur à props.
 */
export function GameMenu({ sceneName, money, inventory, dateLine, onQuit, initialOpen = false }: {
  sceneName?: string;
  money: Money;
  inventory: string[];
  dateLine: string;
  onQuit: () => void;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className={`game-menu ${open ? 'open' : ''}`}>
      <button type="button" className="gm-btn" onClick={() => setOpen(!open)} title={open ? 'Fermer le menu' : 'Menu'}>
        ☰
      </button>
      {open && (
        <div className="gm-panel">
          {sceneName && <h3 className="gm-scene">{sceneName}</h3>}
          <div className="gm-date">{dateLine}</div>
          <div className="gm-section">
            <span className="mini-title">Bourse</span>
            <span className="coins">{formatMoney(money)}</span>
          </div>
          <div className="gm-section">
            <span className="mini-title">Inventaire ({inventory.length})</span>
            <div className="inv-list">
              {inventory.length === 0 && <p className="empty">— vide —</p>}
              {inventory.map((it, i) => (
                <span className="inv-item" key={i}>{it}</span>
              ))}
            </div>
          </div>
          <button type="button" className="btn small gm-quit" onClick={onQuit}>← Quitter la partie</button>
        </div>
      )}
    </div>
  );
}
```

Vérifier l'export réel de `Money` dans `src/engine/money.ts` (ligne 8 : `export interface Money`) —
si l'import `type Money` frotte, importer `import type { Money } from '../engine/money'` séparément.

- [ ] **Step 4 : CSS (append)**

```css
/* ── Menu ☰ (haut-gauche, les deux modes) ── */
.game-menu {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 60;
}
.gm-btn {
  width: 42px;
  height: 42px;
  border-radius: 9px;
  background: #1c2230;
  border: 1.5px solid #3a4660;
  color: #cfe6ff;
  font-size: 19px;
  cursor: pointer;
  opacity: 0.92;
}
.game-menu.open .gm-btn {
  border-color: #ffe066;
}
.gm-panel {
  position: absolute;
  top: 48px;
  left: 0;
  width: min(300px, 88vw);
  max-height: 72vh;
  overflow: auto;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
}
.gm-scene {
  margin: 0;
  font-size: 15px;
  color: var(--gold);
}
.gm-date {
  font-size: 12px;
  color: var(--muted);
}
.gm-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gm-quit {
  align-self: flex-start;
}

/* ── Chip date (haut-droite, exploration) ── */
.date-chip {
  position: absolute;
  top: 16px;
  right: 118px; /* à gauche des ViewControls (top:16 right:16, ~92px de large) */
  z-index: 45;
  background: rgba(10, 14, 20, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 6px 11px;
  font-size: 12px;
  white-space: nowrap;
}
@media (max-width: 700px) {
  .date-chip { top: 64px; right: 8px; } /* sous les ViewControls sur petit écran */
}

/* ── Overlay Défaite (centre du champ) ── */
.defeat-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  z-index: 70;
}
.defeat-overlay .battle-result {
  min-width: 240px;
}
```

- [ ] **Step 5 : vert** — `npx vitest run src/ui/GameMenu.test.tsx` → PASS.

- [ ] **Step 6 : commit**

```powershell
git add src/ui/GameMenu.tsx src/ui/GameMenu.test.tsx src/ui/styles.css
git commit -m "feat(ui): GameMenu ☰ (scène, bourse, inventaire, date, quitter) + chip date + CSS défaite" -- src/ui/GameMenu.tsx src/ui/GameMenu.test.tsx src/ui/styles.css
```

---

### Task 6 : re-layout `CampaignView` (plein-champ, overlays)

**Files:**
- Modify: `src/ui/CampaignView.tsx` (⚠️ RELIRE le fichier d'abord — arbre partagé)
- Modify: `src/ui/styles.css` (`.combat-feed` repositionné)

- [ ] **Step 1 : RELIRE `src/ui/CampaignView.tsx` en entier** (il bouge sous d'autres sessions).
  Conserver tout élément récent non couvert par ce plan (ex. gating du `combat-feed`).

- [ ] **Step 2 : réécrire le composant**

Cible (à FUSIONNER avec l'état frais — la structure du return est normative, les hooks existants
de modales/fiche/inspection sont conservés) :

```tsx
// src/ui/CampaignView.tsx
import { useState } from 'react';
import { useGame } from '../state/store';
import { formatImperial, toDate, dayPhase } from '../engine/clock';
import { canActFirst } from '../state/turnEconomy';
import { IsoStage } from '../gameIso/IsoStage';
import { ViewControls } from './ViewControls';
import { DialogueBox } from './DialogueBox';
import { MerchantPanel } from './MerchantPanel';
import { ActionBar } from './ActionBar';
import { CombatBanner } from './CombatBanner';
import { ActiveModal } from './ActiveModal';
import { VictoryScreen } from './VictoryScreen';
import { BargainModal } from './BargainModal';
import { AppraiseModal } from './AppraiseModal';
import { DocumentModal } from './DocumentModal';
import { CharacterSheet } from './CharacterSheet';
import { InspectPanel } from './InspectPanel';
import { InitiativeStrip } from './InitiativeStrip';
import { PartyDock } from './PartyDock';
import { LogDrawer } from './LogDrawer';
import { GameMenu } from './GameMenu';
import { campaign } from '../scenes/campaign';

export function CampaignView() {
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const journal = useGame((s) => s.journal);
  const dialogue = useGame((s) => s.dialogue);
  const battle = useGame((s) => s.battle);
  const inventory = useGame((s) => s.inventory);
  const money = useGame((s) => s.money);
  const merchant = useGame((s) => s.merchant);
  const inspectEnabled = useGame((s) => s.inspectEnabled);
  const toggleInspect = useGame((s) => s.toggleInspectEnabled);
  const pendingRoundStart = useGame((s) => s.pendingRoundStart);
  const roundStartPromote = useGame((s) => s.roundStartPromote);
  const gameTime = useGame((s) => s.gameTime);
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  const party = useGame((s) => s.party);
  const zoom = useGame((s) => s.zoom);
  const setZoom = useGame((s) => s.setZoom);
  const rotateCam = useGame((s) => s.rotateCam);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const clockDate = toDate(gameTime);
  const phase = dayPhase(gameTime);
  const dateShort = clockDate.intercalary ?? `${clockDate.day} ${clockDate.monthName}`;
  const dateLine = `${phase.icon} ${phase.label} — ${clockDate.weekday ? `${clockDate.weekday} · ` : ''}${formatImperial(gameTime)}`;
  const inspected = inspectEnabled && inspectId ? battle?.combatants.find((c) => c.id === inspectId) ?? null : null;
  // Dock : version « vivante » des héros en combat (PB/effets à jour), sinon la party.
  const dockHeroes = party.map((h) => battle?.combatants.find((x) => x.id === h.id) ?? h);
  const activeId = battle && !battle.over ? battle.order[battle.turn] : null;
  // Pré-emption d'initiative (pause de début de Round) : héros éligibles (LDB ch.17 l.27).
  const canFirstIds = battle && pendingRoundStart
    ? battle.order.filter((id) => {
        const c = battle.combatants.find((x) => x.id === id);
        return !!c && canActFirst(c, battle);
      })
    : [];

  return (
    <div className="screen campaign-view">
      <main className="stage">
        <IsoStage />
        {/* ── Overlays HUD plein-champ (façon BG3, mobile-first) ── */}
        {mode === 'battle' && battle && (
          <InitiativeStrip
            order={battle.order}
            turn={battle.turn}
            round={battle.round}
            combatants={battle.combatants}
            over={battle.over != null}
            pendingRound={pendingRoundStart?.round ?? null}
            canFirstIds={canFirstIds}
            inspectEnabled={inspectEnabled}
            onToggleInspect={toggleInspect}
            onInspect={inspectEnabled ? setInspectId : undefined}
            onPromote={roundStartPromote}
          />
        )}
        {mode === 'battle' && battle && <CombatBanner />}{/* fil SOUS la frise (CSS .combat-feed) */}
        <GameMenu sceneName={scene?.nom} money={money} inventory={inventory} dateLine={dateLine} onQuit={() => setScreen('party')} />
        {mode === 'exploration' && (
          <div className="date-chip" title={dateLine}>{phase.icon} {dateShort}</div>
        )}
        <PartyDock heroes={dockHeroes} activeId={activeId} onOpen={setSheetId} />
        <LogDrawer battle={mode === 'battle' && battle ? { log: battle.log, combatants: battle.combatants } : null} journal={journal} />
        <ViewControls
          zoom={zoom}
          onZoomIn={() => setZoom(zoom + 0.3)}
          onZoomOut={() => setZoom(zoom - 0.3)}
          onZoomReset={() => setZoom(1)}
          onRotateLeft={() => rotateCam(-1)}
          onRotateRight={() => rotateCam(1)}
        />
        {mode === 'exploration' && !dialogue && (
          <div className="stage-hint">Cliquez sur une case pour vous déplacer · sur un personnage/objet pour interagir</div>
        )}
        {dialogue && <DialogueBox />}
        {merchant && <MerchantPanel />}
        {mode === 'battle' && battle && <ActionBar />}
        {/* Défaite : overlay centré (la victoire a son écran plein, VictoryScreen). */}
        {mode === 'battle' && battle?.over === 'defeat' && (
          <div className="defeat-overlay">
            <div className="battle-result defeat">
              <h2>Défaite…</h2>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const cur = useGame.getState().scene;
                  if (cur) {
                    useGame.setState({ mode: 'exploration', battle: null });
                  } else {
                    startScene(campaign[0].scene);
                  }
                }}
              >
                Reprendre
              </button>
            </div>
          </div>
        )}
      </main>

      <VictoryScreen />
      <ActiveModal />
      <BargainModal />
      <AppraiseModal />
      <DocumentModal />
      {sheetId && <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />}
      {inspected && <InspectPanel combatant={inspected} onClose={() => setInspectId(null)} />}
    </div>
  );
}
```

Changements clés vs l'actuel :
- **Supprimer** : tout l'`<aside className="hud-left">` (Quitter, h3 scène, GroupPanel, purse,
  game-clock, inventory, journal) ; les imports `BattlePanel`, `LegendPanel`, `GroupPanel`,
  `formatMoney` ; le montage `<BattlePanel …/>` et `<LegendPanel />`.
- **Ajouter** : imports + montages `InitiativeStrip`/`PartyDock`/`LogDrawer`/`GameMenu`, chip date,
  overlay défaite ; lectures store `pendingRoundStart`, `roundStartPromote`, `party`, `startScene`,
  `toggleInspectEnabled` ; helper `canActFirst`.
- **Conserver** : `CombatBanner` (le CSS le replace sous la frise), DialogueBox, MerchantPanel,
  ViewControls, stage-hint, VictoryScreen, ActiveModal, modales hors combat, CharacterSheet,
  InspectPanel — et tout ajout récent d'une autre session.
- **`establishing`** : suivre l'état FRAIS du fichier (une session parallèle a retouché la bannière
  d'ouverture récemment) — ni la réintroduire si elle a été déplacée, ni la supprimer si elle est
  encore là. La logique « Commencer le combat » vit dans ActionBar et ne bouge pas.

- [ ] **Step 3 : repositionner le fil d'événements sous la frise**

Dans `styles.css`, modifier `.combat-feed` (~ligne 1510) : `top: 12px` → `top: 68px` et ajouter
dans le media query 700px existant de la frise : `.combat-feed { top: 60px; }`.

- [ ] **Step 4 : typecheck + suite**

Run : `npm run typecheck` puis `npm test`
Attendu : 0 erreur TS ; suite verte (BattlePanel/GroupPanel/LegendPanel encore présents sur disque
mais plus importés — c'est l'étape suivante qui les supprime).

- [ ] **Step 5 : commit**

```powershell
git add src/ui/CampaignView.tsx src/ui/styles.css
git commit -m "feat(ui): CampaignView plein-champ — overlays BG3 (frise+fil, dock, tiroir, menu ☰, chip date, défaite)" -- src/ui/CampaignView.tsx src/ui/styles.css
```

---

### Task 7 : suppressions franches + nettoyage CSS + commentaires

**Files:**
- Delete: `src/ui/BattlePanel.tsx`, `src/ui/LegendPanel.tsx`, `src/ui/GroupPanel.tsx`
- Modify: `src/ui/styles.css` (retrait des blocs morts)
- Modify (commentaires seulement) : `src/state/store.ts`, `src/state/combatFlow.ts`,
  `src/state/turnEconomy.ts`, `src/ui/ActiveModal.tsx`, `src/ui/ActionBar.tsx`,
  `src/state/roll-modal-invariant.test.ts`, `src/state/upkeep-reveal.test.ts`

- [ ] **Step 1 : vérifier qu'aucun import ne survit**

Run : `Grep "BattlePanel|GroupPanel|LegendPanel" src --type tsx/ts` (hors commentaires).
Attendu : plus AUCUN `import`/montage (sinon retour Task 6). Les mentions en commentaire seront
mises à jour au Step 4.

- [ ] **Step 2 : supprimer les fichiers**

```powershell
git rm src/ui/BattlePanel.tsx src/ui/LegendPanel.tsx src/ui/GroupPanel.tsx
```

- [ ] **Step 3 : nettoyer le CSS mort (grep AVANT chaque retrait — classes parfois partagées)**

À RETIRER de `styles.css` (après grep `src` confirmant zéro usage restant) :
`.hud-left` (+ `.hud-left h3`), `.party-hud`, `.party-hud-card` (+ `.down`), `.group-panel`,
`.grp-card/.grp-portrait/.grp-main/.grp-top/.grp-pv/.grp-bar/.grp-meta/.grp-wpn`,
`.battle-panel`, `.turn-banner` (+ `.hero/.enemy`, `.turn-round`), `.order-title`, `.order-list`,
`.ord-row` (+ variantes `.ally/.enemy/.now/.out/.ko/.inspectable`), `.ord-portrait`, `.ord-info`,
`.ord-top`, `.ord-pv`, `.ord-bar`, `.ord-states`, `.ord-more`, `.ord-first`, `.round-start-hint`,
`.legend-panel/.legend-title/.legend-team/.legend-dot(.hero/.enemy/.active)/.legend-states`,
`.battle-log`, `.journal`, `.journal-lines`, `.purse`, `.inventory`, `.inv-list`?, `.inv-item`?
À **GARDER** (réutilisés) : `.ko-cross` (PortraitTile), `.inspect-toggle` (frise), `.jr-line/.jr-ic/
.jr-tx`, `.nm-ally/.nm-foe` (LogDrawer/feed), `.mini-title`, `.coins`, `.empty`, `.battle-result`
(défaite + VictoryScreen), `.inv-list`/`.inv-item` si utilisés par GameMenu (ils LE sont — garder).
`.phc-top/.hp-bar/.hp-fill/.phc-sub` : grep `party-hud-card|phc-|hp-bar|hp-fill` — si seul l'ancien
party-hud les consommait ET que PartyScreen ne les utilise pas, retirer ; sinon garder.

- [ ] **Step 4 : mettre à jour les commentaires « frise BattlePanel »**

Remplacer « frise BattlePanel » / « (frise BattlePanel) » par « frise d'initiative
(InitiativeStrip) » dans : `store.ts` (~l.142, ~l.875), `combatFlow.ts` (~l.1985),
`turnEconomy.ts` (~l.38), `ActiveModal.tsx` (~l.48 « frise d'ordre BattlePanel »),
`ActionBar.tsx` (~l.74), `roll-modal-invariant.test.ts` (~l.30), `upkeep-reveal.test.ts` (~l.28).
(Relire chaque ligne avant édition — numéros susceptibles d'avoir bougé.)

- [ ] **Step 5 : suite + typecheck**

Run : `npm test` puis `npm run typecheck` → tout vert, 0 erreur.

- [ ] **Step 6 : commit**

```powershell
git add -A -- src/ui/BattlePanel.tsx src/ui/LegendPanel.tsx src/ui/GroupPanel.tsx src/ui/styles.css src/state/store.ts src/state/combatFlow.ts src/state/turnEconomy.ts src/ui/ActiveModal.tsx src/ui/ActionBar.tsx src/state/roll-modal-invariant.test.ts src/state/upkeep-reveal.test.ts
git commit -m "refactor(ui): suppression BattlePanel/LegendPanel/GroupPanel + CSS mort (HUD BG3 plein-champ)" -- src/ui/BattlePanel.tsx src/ui/LegendPanel.tsx src/ui/GroupPanel.tsx src/ui/styles.css src/state/store.ts src/state/combatFlow.ts src/state/turnEconomy.ts src/ui/ActiveModal.tsx src/ui/ActionBar.tsx src/state/roll-modal-invariant.test.ts src/state/upkeep-reveal.test.ts
```

---

### Task 8 : recette navigateur (desktop + mobile)

**Files:** aucun nouveau — ajustements CSS de calibration éventuels dans `src/ui/styles.css`.

- [ ] **Step 1 : lancer le dev server** (`npm run dev`, port 5173 — en arrière-plan).

- [ ] **Step 2 : recette DESKTOP (Playwright MCP, 1280×800)**

Charger `http://localhost:5173`, menu « 🧪 Tests — scénarios », choisir un scénario de COMBAT
(de préférence avec ennemis multiples). Vérifier (recharger franchement la page si HMR périmé) :
1. Frise en haut : tuiles dans l'ordre, cadres vert/rouge (tirets ennemis), jauge verticale
   interne, actif or + ▼, chip « Round N », toggle 🔍.
2. Fil d'événements SOUS la frise (aucun chevauchement avec les portraits).
3. Dock à gauche : 4 tuiles, PV chiffrés dans le portrait, états à droite (≤4 + ▾ si besoin),
   tap → fiche perso s'ouvre.
4. Pause de début de Round (Round 2+) : badge ⏫🍀 sur les héros avec Chance, clic = promotion.
5. Tiroir 📜 : replié, s'ouvre, journal narré lisible.
6. Menu ☰ EN COMBAT : s'ouvre par-dessus, bourse/inventaire/date/Quitter présents.
7. Aucune colonne fixe : le champ occupe toute la largeur. Console : 0 erreur.
8. Exploration (scénario hors combat ou fin de combat) : chip date haut-droite, hint déplacement,
   dialogue/marchand OK, dock toujours visible, PAS de frise/fil/barre.

- [ ] **Step 3 : recette MOBILE (viewport 390×844)**

Redimensionner (browser_resize 390×844) et re-vérifier combat + exploration :
frise compacte défilable sans chevaucher le ☰, dock + barre d'action + tiroir 📜 tous accessibles
au tap, chip date repositionné (media query), modales utilisables. Screenshots des deux modes.

- [ ] **Step 4 : calibrations** (si besoin) : opacités/positions (`.combat-feed` top, `.log-drawer`
  bottom vs hauteur réelle de l'ActionBar, `.date-chip` vs ViewControls, tailles tuiles mobile).
  Modifier UNIQUEMENT `styles.css`.

- [ ] **Step 5 : commit final (si ajustements)**

```powershell
git add src/ui/styles.css
git commit -m "style(ui): calibrations recette HUD BG3 (desktop + mobile 390x844)" -- src/ui/styles.css
```

---

## Couverture spec → tasks

| Exigence spec (v4) | Task |
| --- | --- |
| PortraitTile (jauge verticale interne vert→orange→rouge, PV dans le portrait, 4 états + ▾, KO, actif, tap) | 1 |
| InitiativeStrip (ordre, cadres équipe, ▼, Round N, 🔍, ⏫ pré-emption, inspection au tap) | 2 |
| PartyDock (HERO_RING, PV chiffrés, fiche au tap, deux modes) | 3, 6 |
| Fil d'événements conservé SOUS la frise | 6 (CSS `.combat-feed`) |
| LogDrawer replié (battle.log narré / journal groupe) | 4, 6 |
| GameMenu ☰ deux modes (scène, bourse, inventaire, date, quitter) | 5, 6 |
| Chip date exploration | 5 (CSS), 6 |
| Défaite en overlay centré | 5 (CSS), 6 |
| Suppression hud-left/BattlePanel/LegendPanel/GroupPanel + bannière tour | 6, 7 |
| Commentaires « frise BattlePanel » → frise d'initiative | 7 |
| Mobile : tap-first, cibles ≥40 px, media queries, recette 390×844 | 1-5 (CSS), 8 |
| Moteur/store intacts (affichage seul) | transverse (aucune task ne touche engine/ ni la logique store) |
