# HUD Combat and Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à chaque ancrage du HUD une responsabilité unique, partager une seule résolution de déplacement et verrouiller le rendu de l’attaque sur Z0–Z15.

**Architecture:** Les composants du HUD restent des vues composées des primitives existantes. Le mouvement est résolu par une requête pure unique, conservée au premier tap puis consommée au commit. Les transitions de store et les mécaniques de combat hors de cette couture ne changent pas.

**Tech Stack:** TypeScript, React, Zustand, CSS modulaire, Vitest, Testing Library, Playwright via `recette-navigateur`.

## Global Constraints

- Appliquer `docs/superpowers/specs/2026-07-31-hud-combat-exploration-design.md`, révision 2026-08-06, et `docs/charte-ui.md`.
- Réutiliser `PortraitTile`, `LifeBar`, `StateChips`, `RollShell`, `VsHeader`, `Icon` et les tokens existants.
- Aucun emoji, SVG local, hexadécimal, label comme clé logique, nouvelle règle WFRP ou nouvelle référence RAW.
- Breakpoints de largeur exclusifs : 900, 700 et 560 px ; 360 px est une largeur de recette, pas un breakpoint.
- `EditorCanvas` conserve son appel actuel de `ViewControls`.
- L’attaque peut corriger sa projection de props vers `RollShell`, jamais sa mécanique ni `AttackModal`.
- Dans chaque fichier touché, remplacer tout commentaire-excuse, pierre tombale ou paraphrase de règle rencontrée ; ne pas élargir ce nettoyage hors du lot.
- Chaque tâche produit un commit autonome. Ce plan est supprimé après exécution et recette verte.

---

### Task 1: Rendre `PartyDock` strictement identitaire

**Files:**
- Modify: `src/ui/PartyDock.tsx`
- Modify: `src/ui/PartyDock.test.tsx`
- Modify: `src/ui/CampaignView.tsx`

**Interfaces:**
- Consumes: `PortraitTile` avec `variant="full"`, vie et états existants.
- Produces:

```ts
export interface PartyDockProps {
  heroes: Combatant[];
  targeting?: boolean;
  onOpen: (id: string) => void;
}
```

- [ ] **Step 1: RED — verrouiller l’absence d’identité de tour**

Remplacer le montage du test par `<PartyDock heroes={[h1, h2]} onOpen={() => {}} />`, garder l’assertion `11/11`, puis ajouter :

```ts
expect(html).not.toContain('▼');
expect(html).not.toContain('aria-current');
expect(html).not.toContain('active');
```

Run: `npx vitest run src/ui/PartyDock.test.tsx`

Expected: FAIL car `activeId` est requis et `PortraitTile active` rend encore le caret.

- [ ] **Step 2: GREEN — retirer l’état de tour sans toucher au contenu des cartes**

Exporter `PartyDockProps`, retirer `activeId` et supprimer uniquement `active={c.id === activeId}`. Conserver `heroes`, `targeting`, `onOpen`, `variant="full"`, `size="md"`, `team`, `ring`, `title` et le z-index contextuel de fiche.

Dans `CampaignView`, supprimer la dérivation locale `activeId` devenue inutilisée et monter :

```tsx
<PartyDock heroes={dockHeroes} targeting={isTargeting} onOpen={onDockPortrait} />
```

- [ ] **Step 3: Test ciblé et commit**

Run: `npx vitest run src/ui/PartyDock.test.tsx && npx tsc --noEmit`

Expected: PASS.

```powershell
git add src/ui/PartyDock.tsx src/ui/PartyDock.test.tsx src/ui/CampaignView.tsx
git commit -m "fix(ui): rend le dock de groupe identitaire"
```

### Task 2: Rattacher round, inspection et annonces à leurs propriétaires

**Files:**
- Modify: `src/ui/InitiativeStrip.tsx`
- Modify: `src/ui/InitiativeStrip.test.tsx`
- Modify: `src/ui/ViewControls.tsx`
- Create: `src/ui/ViewControls.test.tsx`
- Modify: `src/ui/CombatBanner.tsx`
- Create: `src/ui/CombatBanner.test.tsx`
- Modify: `src/ui/CampaignView.tsx`
- Modify: `src/ui/styles/hud.css`
- Verify unchanged call: `src/ui/editor/EditorCanvas.tsx`

**Interfaces:**
- `InitiativeStripProps` ajoute `round: number` et perd `inspectEnabled` / `onToggleInspect`.
- Produces:

```ts
export type InitiativePhase = 'past' | 'current' | 'future';
export function initiativePhase(index: number, turn: number, over: boolean): InitiativePhase;

interface ViewControlsProps {
  // props actuelles inchangées
  inspectEnabled?: boolean;
  onToggleInspect?: () => void;
}
```

- [ ] **Step 1: RED — écrire les trois contrats**

Dans `InitiativeStrip.test.tsx`, fournir `round={3}` à tous les montages et vérifier :

```ts
expect(html).toContain('Round');
expect(html).toContain('3');
expect(initiativePhase(0, -1, false)).toBe('future');
expect(initiativePhase(0, 1, false)).toBe('past');
expect(initiativePhase(1, 1, false)).toBe('current');
expect(initiativePhase(2, 1, false)).toBe('future');
expect(initiativePhase(1, 1, true)).toBe('future');
expect(html).not.toContain('inspect-toggle');
```

Dans `ViewControls.test.tsx`, rendre une fois avec `inspectEnabled` / `onToggleInspect`, une fois sans, puis vérifier le bouton `Inspection des combattants`, `aria-pressed="true"`, son callback et son absence dans le montage éditeur.

Dans `CombatBanner.test.tsx`, initialiser un combat sans ligne puis avec une ligne et vérifier la région :

```ts
expect(status).toHaveAttribute('role', 'status');
expect(status).toHaveAttribute('aria-live', 'polite');
expect(status).toHaveAttribute('aria-atomic', 'true');
expect(status.querySelectorAll('.cb-ev')).toHaveLength(message ? 1 : 0);
```

Run: `npx vitest run src/ui/InitiativeStrip.test.tsx src/ui/ViewControls.test.tsx src/ui/CombatBanner.test.tsx`

Expected: FAIL sur `round`, les phases, l’inspection dans `ViewControls` et la région persistante.

- [ ] **Step 2: GREEN — implémenter les propriétaires exacts**

Dans `InitiativeStrip.tsx` :

```ts
export function initiativePhase(index: number, turn: number, over: boolean): InitiativePhase {
  if (over || turn < 0) return 'future';
  if (index < turn) return 'past';
  return index === turn ? 'current' : 'future';
}
```

Afficher le round dans le panneau, poser `data-phase`, `aria-current={phase === 'current' ? 'step' : undefined}` et `active={phase === 'current'}`. Retirer le toggle d’inspection. La phase d’un renfort vient de son index dans le `map(order)` courant.

Dans `ViewControls`, ajouter le bouton uniquement sous `onToggleInspect`, avec `Icon id="nav/identify"`, `aria-pressed={inspectEnabled === true}`, `title` et `aria-label`. Poser aussi `aria-pressed` sur projection et POV ; ne rendre aucun bouton de jeu si le callback optionnel manque.

Dans `CombatBanner`, garder la région montée pendant tout combat non fini :

```tsx
<div className="combat-feed" role="status" aria-live="polite" aria-atomic="true">
  {line ? <div key={key} className={`cb-ev cb-now cb-tone-${line.tone}`}>{content}</div> : null}
</div>
```

Seul `.cb-ev` garde l’animation. Dans `CampaignView`, passer `round={battle.round}` à l’initiative et `inspectEnabled` / `onToggleInspect={toggleInspect}` à `ViewControls`. Ne pas modifier l’appel d’`EditorCanvas`.

- [ ] **Step 3: Test ciblé et commit**

Run: `npx vitest run src/ui/InitiativeStrip.test.tsx src/ui/ViewControls.test.tsx src/ui/CombatBanner.test.tsx && npx tsc --noEmit`

Expected: PASS.

```powershell
git add src/ui/InitiativeStrip.tsx src/ui/InitiativeStrip.test.tsx src/ui/ViewControls.tsx src/ui/ViewControls.test.tsx src/ui/CombatBanner.tsx src/ui/CombatBanner.test.tsx src/ui/CampaignView.tsx src/ui/styles/hud.css
git commit -m "feat(ui): attribue round inspection et annonces"
```

### Task 3: Partager une seule résolution de déplacement

**Files:**
- Modify: `src/state/combatFlow.ts`
- Modify: `src/state/combatSlice.ts`
- Modify: `src/state/pendings.ts`
- Modify: `src/state/store.ts`
- Create: `src/state/movement-resolution.test.ts`
- Modify: `src/gameIso/stage/useHoverTargeting.ts`
- Modify: `src/gameIso/stage/useHoverTargeting.test.tsx`
- Create: `src/ui/MovementIntent.tsx`
- Create: `src/ui/MovementIntent.test.tsx`
- Modify: `src/ui/ActionBar.tsx`
- Modify: `src/ui/styles/combat-ui.css`

**Interfaces:**

```ts
export type MovementResolution =
  | { status: 'ok'; path: Pt[]; cost: number; kind: 'move' | 'run' }
  | { status: 'blocked'; reason: string };
export function resolveMovementAt(get: Get, pt: Pt): MovementResolution;

export interface MovementIntentProps {
  resolution: MovementResolution | null;
  remainingBefore: number;
  remainingAfter: number | null;
}
```

`PendingRun` ajoute `path?: Pt[]`. `GameState` ajoute `movementIntent: MovementResolution | null`, initialisé à `null` et non persisté.

- [ ] **Step 1: RED — tester résolution, propriété et rendu**

Dans `movement-resolution.test.ts`, monter un combat contrôlé et vérifier : destination légale = `status:'ok'` avec `path/cost/kind`, hors portée = `status:'blocked'` avec `reason`, premier tap = mêmes `path/cost` dans `battle.preview`, second tap = commit depuis ce chemin. Lire le corps de `battleClickTile` et `runConfirm` et vérifier qu’ils ne contiennent plus `pathTo(`.

Dans `MovementIntent.test.tsx`, vérifier `null`, le texte `Marche · coût 2 · Mouvement 4 → 2 · trajet libre`, `Course`, puis un refus sentinelle `Passage fermé` rendu tel quel.

Dans `useHoverTargeting.test.tsx`, vérifier que le survol légal pose la résolution du résolveur et que sortie de case / modale bloquante remet `movementIntent` à l’aperçu tactile courant ou `null`.

Run: `npx vitest run src/state/movement-resolution.test.ts src/gameIso/stage/useHoverTargeting.test.tsx src/ui/MovementIntent.test.tsx`

Expected: FAIL car le type, le résolveur, le store et le composant n’existent pas, et les commits rappellent `pathTo`.

- [ ] **Step 2: GREEN — extraire puis consommer la résolution**

Remplacer `movePreviewAt` par `resolveMovementAt`, sans écriture de store. Conserver les gates actuels ; chaque refus retourne son texte via `{ status:'blocked', reason }`. Un succès appelle `pathTo` une seule fois et retourne les quatre champs du contrat.

Dans `battleClickTile`, garder les routes `currentTargetingMode.commitTile` et `isEngaged -> startDisengage` avant le résolveur. Pour le mode neutre :

```ts
const saved = sameDestination(battle.preview, dest) ? battle.preview : null;
const resolved = saved && (saved.kind === 'move' || saved.kind === 'run')
  ? { status: 'ok' as const, kind: saved.kind, path: saved.path, cost: saved.cost }
  : resolveMovementAt(get, dest);
```

Sur refus, poser seulement `movementIntent`. Au premier tap, copier la résolution dans `battle.preview`. Au commit, utiliser `resolved.path` pour orientation, animation et franchissements, et `resolved.cost` pour `movementUsed`. Pour la Course, transmettre `path` à `battleRun`, stocker `PendingRun.path`, puis tronquer ce chemin dans `runConfirm` sans `pathTo`.

Dans `useHoverTargeting`, utiliser le même résolveur pour le tracé et `movementIntent`. Au nettoyage, restaurer la résolution de `battle.preview` si elle existe, sinon `null`.

`MovementIntent` ne reçoit aucun store et rend seulement ses props. `ActionBar` choisit l’aperçu tactile avant le survol, calcule `remainingAfter` depuis `movementRemaining` et le `cost` déjà produit, puis monte le composant au-dessus de `.ab-bar`. Purger `movementIntent` au commit, annulation, changement de tour et sortie du combat.

- [ ] **Step 3: Test ciblé et commit**

Run: `npx vitest run src/state/movement-resolution.test.ts src/gameIso/stage/useHoverTargeting.test.tsx src/ui/MovementIntent.test.tsx src/state/preview-resource-delta.test.ts && npx tsc --noEmit`

Expected: PASS.

```powershell
git add src/state/combatFlow.ts src/state/combatSlice.ts src/state/pendings.ts src/state/store.ts src/state/movement-resolution.test.ts src/gameIso/stage/useHoverTargeting.ts src/gameIso/stage/useHoverTargeting.test.tsx src/ui/MovementIntent.tsx src/ui/MovementIntent.test.tsx src/ui/ActionBar.tsx src/ui/styles/combat-ui.css
git commit -m "refactor(combat): partage la resolution du deplacement"
```

### Task 4: Nommer l’économie du tour sans perdre les contrôles

**Files:**
- Modify: `src/ui/ActiveFrame.tsx`
- Modify: `src/ui/ActiveFrame.test.tsx`
- Modify: `src/ui/ActionBar.tsx`
- Modify: `src/ui/styles/combat-ui.css`

**Interfaces:**
- `ActiveFrame` garde toutes ses props actuelles et ses valeurs de preview `spendAction`, `spendMove`, `gainAdv`.
- `ActionBar` garde `.ab-loadouts`, `switchLoadout`, les slots existants et `Fin du tour`.

- [ ] **Step 1: RED — verrouiller texte, aperçu et témoins de non-régression**

Dans `ActiveFrame.test.tsx`, rendre `actAvail=1`, `actMax=1`, `moveLeft=4`, `moveMax=4`, `advantage=2`, `spendAction=1`, `spendMove=2`, `gainAdv=1`, puis vérifier :

```ts
expect(html).toContain('Action');
expect(html).toContain('1 → 0');
expect(html).toContain('Mouvement');
expect(html).toContain('4 → 2');
expect(html).toContain('Avantage');
expect(html).toContain('2 → 3');
expect(html).not.toContain('Réaction');
expect(html).toContain('af-action');
expect(html).toContain('ptile-gauge');
```

Ajouter un test source de `ActionBar.tsx` qui exige `ab-loadouts`, `switchLoadout`, `ab-slots` et `Fin du tour`.

Run: `npx vitest run src/ui/ActiveFrame.test.tsx`

Expected: FAIL car les valeurs restent seulement dans les titres des crans.

- [ ] **Step 2: GREEN — ajouter un résumé textuel adossé aux props**

Conserver `Notches`, `PortraitTile` et `StateChips`. Ajouter un `<dl aria-label="Ressources du tour">` avec trois lignes. Afficher la valeur courante seule sans preview et `avant → après` quand le delta correspondant est non nul ; borner uniquement l’affichage entre 0 et le maximum fourni. Poser `data-spent="true"` et le texte `utilisée` pour Action à zéro, `épuisé` pour Mouvement à zéro.

Dans `ActionBar`, restaurer l’identité courte avant les alertes :

```tsx
<strong>{active.label}</strong>
{active.career ? <span>{careerLabelFor(active)}</span> : null}
```

Ne déplacer ni supprimer le commutateur de loadout, ses handlers, les alertes ou les slots.

- [ ] **Step 3: Test ciblé et commit**

Run: `npx vitest run src/ui/ActiveFrame.test.tsx src/state/preview-resource-delta.test.ts && npx tsc --noEmit`

Expected: PASS.

```powershell
git add src/ui/ActiveFrame.tsx src/ui/ActiveFrame.test.tsx src/ui/ActionBar.tsx src/ui/styles/combat-ui.css
git commit -m "feat(ui): nomme les ressources du tour"
```

### Task 5: Aligner exploration et responsive sur la matrice canonique

**Files:**
- Modify: `src/ui/CampaignView.tsx`
- Modify: `src/ui/ObjectiveBanner.test.tsx`
- Modify: `src/ui/styles/hud.css`
- Modify: `src/ui/styles/combat-ui.css`
- Modify: `src/ui/styles/combat-modals.css`
- Modify: `src/ui/ui-ratchets.test.ts`

**Interfaces:**
- `CampaignView` produit un `<aside aria-label="Contexte d’exploration">` dans l’ordre lieu, `GameDate`, `ObjectiveBannerMount`.
- Les seuls media queries de largeur ajoutés ou conservés pour ce HUD sont `max-width:900px`, `700px`, `560px`.

- [ ] **Step 1: RED — verrouiller pile et tranches**

Dans `ObjectiveBanner.test.tsx`, garder les tests de pile et ajouter le témoin que l’objectif courant reste le dernier objectif, avec son bouton dépliable accessible.

Dans `ui-ratchets.test.ts`, lire `hud.css` / `combat-ui.css` et vérifier :

```ts
expect(css).toContain('@media (max-width: 900px)');
expect(css).toContain('@media (max-width: 700px)');
expect(css).toContain('@media (max-width: 560px)');
expect(css).toContain('@media (pointer: coarse)');
expect(css).not.toMatch(/max-width:\s*(360|420)px/);
```

Ajouter des assertions source pour `flex-wrap: nowrap` du groupe sous 560, `overflow-x: auto` de l’initiative sous 700 et `min-width: 44px` des commandes sous `pointer: coarse`.

Run: `npx vitest run src/ui/ObjectiveBanner.test.tsx src/ui/ui-ratchets.test.ts`

Expected: FAIL car `hud.css` conserve 420 px et ne porte pas les quatre tranches explicites.

- [ ] **Step 2: GREEN — composer le contexte et les quatre tranches**

Dans `CampaignView`, sortir `GameDate` de la barre d’actions et monter :

```tsx
{mode === 'exploration' && (
  <aside aria-label="Contexte d’exploration">
    <strong>{scene?.nom ?? 'Lieu inconnu'}</strong>
    <span className="hud-clock"><GameDate time={gameTime} /></span>
    <ObjectiveBannerMount />
  </aside>
)}
```

Styler cet aside par son attribut, sans nouvelle classe locale. Supprimer la media query 420 px et redistribuer sa règle dans 560 px. Implémenter exactement : base `>900`, `max-width:900`, `max-width:700`, `max-width:560`, plus `pointer:coarse`. À 560 : groupe `nowrap`, initiative horizontale défilable, dock pleine largeur. Conserver les modales plein écran et leur pied fixe à 560.

- [ ] **Step 3: Test ciblé et commit**

Run: `npx vitest run src/ui/ObjectiveBanner.test.tsx src/ui/PartyDock.test.tsx src/ui/InitiativeStrip.test.tsx src/ui/ViewControls.test.tsx src/ui/ui-ratchets.test.ts && npx tsc --noEmit`

Expected: PASS.

```powershell
git add src/ui/CampaignView.tsx src/ui/ObjectiveBanner.test.tsx src/ui/styles/hud.css src/ui/styles/combat-ui.css src/ui/styles/combat-modals.css src/ui/ui-ratchets.test.ts
git commit -m "feat(ui): aligne exploration et responsive"
```

### Task 6: Verrouiller l’attaque sur Z0–Z15

**Files:**
- Modify: `src/ui/jetProps/useAttackJetProps.tsx`
- Create: `src/ui/jetProps/useAttackJetProps.conformance.test.tsx`
- Verify: `src/ui/RollShell.tsx`
- Verify: `src/ui/VsHeader.tsx`

**Interfaces:**
- `useAttackJetProps(): ComponentProps<typeof RollShell> | null` reste inchangé.
- `composeRollLabel(attacker, 'Attaque', test)` devient l’unique producteur de Z1.
- Aucune modification de `pendingAttack`, du calcul, des handlers ou d’une modale dédiée.

- [ ] **Step 1: RED — rendre le flux réel et sonder ses zones**

Créer une fixture jsdom sur le patron de `defense-forcage-annule.test.tsx`, initialiser un attaquant et une cible, ouvrir l’attaque réelle, puis rendre `<RollShell {...useAttackJetProps()!} />` dans un `Probe`.

Vérifier Z0 `Attaque` seul, Z1 `attaquant — Attaque (Corps à corps)`, un seul `.rm-vs` en Z3, les options en Z4, une ou deux `.roll-row` en Z5, aucune `.rm-journal` pré-jet, puis les actions `Annuler` / `Appliquer`. Vérifier l’absence de `Round`, `party-dock` et d’une deuxième modale.

Run: `npx vitest run src/ui/jetProps/useAttackJetProps.conformance.test.tsx`

Expected: FAIL sur Z1 car `subtitle` vaut actuellement `null`.

- [ ] **Step 2: GREEN — corriger seulement la projection Z1**

Importer `composeRollLabel` et dériver le test depuis l’arme déjà résolue :

```ts
const attackTest = weapon.resolveChar
  ? { char: weapon.resolveChar }
  : { skill: weapon.type === 'ranged' ? 'projectiles' : 'corps-a-corps' };

subtitle: composeRollLabel(attacker, 'Attaque', attackTest),
```

Conserver `title:'Attaque'`, `extra:<VsHeader>`, `setup`, `rows`, `outcome`, `postRollExtra`, `forcedExtra` et `actions` à leur propriétaire actuel. Ne modifier aucun handler ni fichier de moteur.

- [ ] **Step 3: Test ciblé et commit**

Run: `npx vitest run src/ui/jetProps/useAttackJetProps.conformance.test.tsx src/ui/roll-display-contract.test.tsx src/ui/component-conformance.test.ts && npx tsc --noEmit`

Expected: PASS.

```powershell
git add src/ui/jetProps/useAttackJetProps.tsx src/ui/jetProps/useAttackJetProps.conformance.test.tsx
git commit -m "test(ui): verrouille attaque sur le contrat de jet"
```

### Task 7: Passer les gates, recetter et supprimer le plan exécuté

**Files:**
- Delete after all checks pass: `docs/superpowers/plans/2026-07-31-hud-combat-exploration.md`
- Modify only on observed regression: files already owned by Tasks 1–6

**Interfaces:**
- Scénarios existants : `L’Embuscade` pour le combat et `La Diligence — exploration` hors combat.
- Largeurs : 1600×900, 900, 700, 560, 360 px.

- [ ] **Step 1: RED — exécuter les gates avant fermeture**

Run:

```powershell
npm test
npm run typecheck
npm run docs:check
```

Expected: les trois commandes doivent passer ; tout échec reste attribué au premier lot qui l’a introduit et y reçoit un test rouge avant correction.

- [ ] **Step 2: GREEN — recette navigateur complète**

Avec le skill `recette-navigateur`, lancer `L’Embuscade` et vérifier : pause `turn=-1`, tour joueur, renfort, déplacement survol/tap/commit/refus, attaque pré-jet/résultat/influence, tour ennemi et combat fini. Confirmer absence de caret dans le groupe, round et phases dans l’initiative, inspection dans `ViewControls`, région live unique, texte avant → après, loadout et `Fin du tour` intacts.

Lancer `La Diligence — exploration` et confirmer la pile lieu/date/objectif haut-gauche, le groupe identitaire et l’absence d’initiative, round, flux et dock.

Répéter les contrôles structurants aux cinq largeurs. À 360 px : quatre portraits sur une ligne, round visible, courant atteignable, commandes de 44 px sous pointeur grossier, dock et modale exploitables sans collision. Parcourir au clavier groupe, initiative, vue, dock et modale ; console à zéro erreur.

- [ ] **Step 3: Rejouer les gates après la dernière correction**

Run:

```powershell
npm test
npm run typecheck
npm run docs:check
```

Expected: PASS pour les trois commandes et recette navigateur verte.

- [ ] **Step 4: Supprimer le plan et committer la fermeture**

Supprimer `docs/superpowers/plans/2026-07-31-hud-combat-exploration.md` seulement après les gates et la recette vertes.

```powershell
git add docs/superpowers/plans/2026-07-31-hud-combat-exploration.md
git commit -m "docs(ui): clot le chantier du HUD tactique"
```
