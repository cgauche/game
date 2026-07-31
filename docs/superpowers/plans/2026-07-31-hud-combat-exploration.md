# HUD de combat et d’exploration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre immédiatement distincts le groupe, le temps du combat et les décisions du tour, tout en conservant la carte comme surface dominante et sans inventer de mécanique.

**Architecture:** Conserver `CampaignView` comme unique compositeur du HUD. Faire de `PartyDock`, `InitiativeStrip`, `ViewControls` et `ActiveFrame` des vues pures à props ; réutiliser les données déjà calculées par `ActionBar` et `useHoverTargeting`. L’attaque reste paramétrée par `useAttackJetProps` dans la coquille commune `RollShell`. Les adaptations de géométrie vivent dans `styles/hud.css` et `styles/combat-ui.css`, avec les breakpoints canoniques 900/700/560 px.

**Tech Stack:** React 19, TypeScript, Zustand, CSS modulaire global, Vitest SSR/jsdom, SVG via le registre `Icon`, recette navigateur avec `window.__wfrp`.

## Global Constraints

- Lire et appliquer `docs/charte-ui.md` avant toute retouche CSS.
- Pour l’exécution : utiliser les skills projet `orchestrer-des-agents`, `retoucher-un-ecran-ui`, `ajouter-une-icone` au lot 3, puis `recette-navigateur` avant validation finale.
- Ne modifier aucune règle d’initiative, d’économie d’action, de déplacement ou d’attaque.
- Ne jamais afficher l’acteur courant dans la barre de groupe ; cette information appartient exclusivement à l’initiative et au dock inférieur.
- Ne pas créer de ressource « Réaction » : le moteur expose Action, Mouvement et Avantage.
- Ne pas dupliquer les interactions d’exploration : les halos, curseurs et trajets de `IsoStage` restent l’affordance principale.
- Réutiliser `PortraitTile`, `LifeBar`, `RollShell`, `VsHeader`, `Icon` et les classes atomiques existantes.
- Éviter de nouveaux sélecteurs de classe lorsque la structure sémantique, `data-phase`, `aria-current`, `fieldset`, `legend` ou `dl` suffisent. Toute hausse inévitable du cliquet de classes doit être justifiée au voisinage de `CLASS_SELECTOR_BASELINE`.
- Tous les textes visibles sont en français ; couleur jamais seule ; focus clavier visible ; cibles tactiles de 44 px sous `pointer: coarse`.
- Préserver les changements sans rapport déjà présents dans le working tree. Chaque commit ne stage que les fichiers explicitement listés dans sa tâche.
- Spécification source : `docs/superpowers/specs/2026-07-31-hud-combat-exploration-design.md`.

---

## Task 1: Retirer définitivement l’état actif de la barre de groupe

**Files:**

- Modify: `src/ui/PartyDock.tsx`
- Modify: `src/ui/PartyDock.test.tsx`
- Modify: `src/ui/CampaignView.tsx`
- Modify: `src/ui/styles/hud.css`

- [ ] **Step 1: Écrire le verrou de non-régression**

Dans `PartyDock.test.tsx`, remplacer le scénario « actif marqué » par un scénario qui rend deux héros et vérifie :

```tsx
const html = renderToStaticMarkup(
  <PartyDock heroes={[h1, h2]} onOpen={() => {}} />,
);
expect(html).toContain('11/11');
expect(html).toContain('Gunnar');
expect(html).toContain('Elsa');
expect(html).not.toContain('ptile-caret');
expect(html).not.toContain('▼');
```

Conserver un test séparé du titre de ciblage afin de vérifier que le clic reste contextuel sans devenir un état persistant.

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run src/ui/PartyDock.test.tsx`

Expected: FAIL car `activeId` est encore requis et produit le caret de l’acteur courant.

- [ ] **Step 3: Simplifier le contrat de `PartyDock`**

Supprimer `activeId` des props et ne plus passer `active` à `PortraitTile`. Conserver `variant="full"`, `size="md"`, les anneaux d’identité `HERO_RING`, les états et le comportement de ciblage/ouverture. Envelopper chaque tuile dans un élément sémantique portant le nom visible du héros ; ne pas modifier `PortraitTile`, dont le contrat interne reste « portrait sans nom ».

Dans `hud.css`, ancrer les `StateChips` existants dans le coin de cette carte afin qu’une alerte ne flotte jamais entre deux héros. Utiliser les descendants de `.party-dock` et les classes existantes, sans nouveau sélecteur de classe.

Dans `CampaignView`, supprimer le calcul local `activeId` s’il n’a plus d’autre consommateur et appeler :

```tsx
<PartyDock heroes={dockHeroes} targeting={isTargeting} onOpen={onDockPortrait} />
```

- [ ] **Step 4: Vérifier le lot**

Run: `npx vitest run src/ui/PartyDock.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit ciblé**

```bash
git add src/ui/PartyDock.tsx src/ui/PartyDock.test.tsx src/ui/CampaignView.tsx src/ui/styles/hud.css
git commit -m "fix(ui): réserve l'acteur courant à l'initiative"
```

## Task 2: Faire de l’initiative la source unique du round et du tour courant

**Files:**

- Modify: `src/ui/InitiativeStrip.tsx`
- Modify: `src/ui/InitiativeStrip.test.tsx`
- Modify: `src/ui/CampaignView.tsx`
- Modify: `src/ui/styles/hud.css`

- [ ] **Step 1: Écrire les tests de structure temporelle**

Étendre les fixtures d’appel avec `round={2}` puis vérifier :

```tsx
expect(html).toContain('Round');
expect(html).toContain('>2<');
expect(html).toContain('aria-current="step"');
expect(html).toContain('data-phase="past"');
expect(html).toContain('data-phase="current"');
expect(html).toContain('data-phase="next"');
expect(html).toContain('1 suivant');
```

Remplacer le test historique « score absent une fois engagé (#205) » par un test qui exige les valeurs `42` et `31` pendant le tour 1. Ajouter un test `turn={-1}` : aucune entrée passée/courante, toutes à venir.

- [ ] **Step 2: Vérifier l’échec**

Run: `npx vitest run src/ui/InitiativeStrip.test.tsx`

Expected: FAIL car `round`, les phases et les scores persistants n’existent pas.

- [ ] **Step 3: Étendre les props sans toucher au moteur**

Ajouter `round: number` à `InitiativeStripProps`; dans `CampaignView`, passer `round={battle.round}`.

Rendre un en-tête sémantique avant `.is-tiles`, sans nouvelle classe locale. L’en-tête expose aussi le nombre d’entrées suivant l’acteur courant (`Math.max(0, order.length - turn - 1)`) afin que le défilement ne masque pas l’étendue restante :

```tsx
<header aria-label={`Round ${p.round}`}>
  <span>Round</span>
  <strong>{p.round}</strong>
</header>
```

Pour chaque `.is-cell`, poser `data-phase` à partir de l’index et de `turn`, et `aria-current="step"` sur l’entrée courante. Garder `PortraitTile active` ici : son liseré or et son caret sont désormais le marqueur exclusif du tour courant.

- [ ] **Step 4: Rendre la valeur persistante et le nom accessible**

Retirer la garde `p.turn === -1` autour de `.is-score`. Conserver `initiativeTitle`, l’indicateur d’arme Lente et les badges de préemption.

Afficher un nom court dans un élément textuel voisin du portrait sur les largeurs qui le permettent ; ne pas modifier la règle interne de `PortraitTile` qui garde le nom dans son `title`/`aria-label`. Le CSS doit masquer ce texte uniquement dans la variante horizontale étroite, pas le retirer du DOM.

- [ ] **Step 5: Styler le panneau et les trois phases**

Dans `hud.css` :

- intégrer le cartouche du round au même fond/bordure que la liste ;
- atténuer `[data-phase='past']` par opacité et non par disparition ;
- renforcer `[aria-current='step']` par le marqueur existant + un contraste de fond ;
- conserver les suivants à contraste normal ;
- garder le défilement vertical et un acteur courant entièrement visible.

Utiliser des sélecteurs descendants/attributs avant d’ajouter une classe.

- [ ] **Step 6: Vérifier le lot**

Run: `npx vitest run src/ui/InitiativeStrip.test.tsx src/ui/PartyDock.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit ciblé**

```bash
git add src/ui/InitiativeStrip.tsx src/ui/InitiativeStrip.test.tsx src/ui/CampaignView.tsx src/ui/styles/hud.css
git commit -m "feat(ui): rattache round et tour à l'initiative"
```

## Task 3: Regrouper les commandes réelles de caméra

**Files:**

- Modify: `src/ui/ViewControls.tsx`
- Create: `src/ui/ViewControls.test.tsx`
- Modify: `src/ui/icons/defs/ui.ts`
- Modify: `src/ui/icons/_registry.generated.ts` (generated)
- Modify: `src/ui/styles/hud.css`
- Verify: `src/ui/ui-ratchets.test.ts`

- [ ] **Step 1: Ajouter le test d’accessibilité et de comportement**

Monter `ViewControls` avec des espions et vérifier trois groupes accessibles :

```tsx
expect(screen.getByRole('group', { name: 'Orientation de la caméra' })).toBeTruthy();
expect(screen.getByRole('group', { name: 'Mode d’affichage' })).toBeTruthy();
expect(screen.getByRole('group', { name: 'Zoom' })).toBeTruthy();
expect(screen.getByRole('button', { name: 'Réinitialiser le zoom à 100 %' })).toBeTruthy();
```

Vérifier que les boutons appellent toujours `onRotateLeft`, `onRotateRight`, `onToggleView`, `onZoomIn`, `onZoomOut` et que l’absence de `onTogglePov` retire seulement le bouton POV (contrat éditeur).

- [ ] **Step 2: Vérifier l’échec**

Run: `npx vitest run src/ui/ViewControls.test.tsx`

Expected: FAIL car les groupes et noms accessibles n’existent pas.

- [ ] **Step 3: Ajouter uniquement les icônes manquantes au registre**

Avec le skill `ajouter-une-icone`, ajouter dans la famille `ui` exactement les ids stables `ui/rotate-left`, `ui/rotate-right`, `ui/zoom-in`, `ui/zoom-out` et `ui/projection`. Réutiliser `ui/eye` pour le POV.

Run: `npm run gen`

Expected: `_registry.generated.ts` contient les nouveaux ids et aucune référence d’icône n’est orpheline.

- [ ] **Step 4: Remplacer le tableau inline par trois groupes sémantiques**

Conserver l’API de props partagée avec `EditorCanvas`. Utiliser un conteneur `.view-controls` puis trois `fieldset`/`legend` ou trois éléments `role="group"` nommés. Les boutons portent `className="btn"`, un `aria-label`, un `title`, `aria-pressed` pour les modes et `<Icon>` pour l’affordance.

Le zoom courant est toujours visible comme valeur (`100 %`, `130 %`), et cette même valeur sert de bouton de reset. Supprimer `BTN` et tous les styles de géométrie inline.

- [ ] **Step 5: Poser la géométrie dans `hud.css`**

Ancrer le composant en haut à droite, distinguer les groupes par espacement/bordure et conserver des cibles 42 px, portées à 44 px sous `pointer: coarse`. À `<=700px`, garder orientation + zoom accessibles et déplacer les commandes secondaires dans une disposition compacte, sans cacher la valeur de zoom.

Styler avec `.view-controls` déjà existante et ses descendants sémantiques (`fieldset`, `legend`, boutons) : ce lot ne doit pas augmenter `CLASS_SELECTOR_BASELINE`.

- [ ] **Step 6: Vérifier jeu et éditeur**

Run: `npx vitest run src/ui/ViewControls.test.tsx src/ui/editor/EditorCanvas.test.tsx src/ui/ui-ratchets.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit ciblé**

```bash
git add src/ui/ViewControls.tsx src/ui/ViewControls.test.tsx src/ui/icons/defs/ui.ts src/ui/icons/_registry.generated.ts src/ui/styles/hud.css
git commit -m "feat(ui): structure les commandes de caméra"
```

## Task 4: Rendre l’économie du tour lisible en texte

**Files:**

- Modify: `src/ui/ActiveFrame.tsx`
- Modify: `src/ui/ActiveFrame.test.tsx`
- Modify: `src/ui/ActionBar.tsx`
- Modify: `src/ui/styles/combat-ui.css`
- Modify: `src/ui/styles/hud.css`
- Verify: `src/ui/ui-ratchets.test.ts`

- [ ] **Step 1: Verrouiller les libellés de ressources**

Ajouter des assertions SSR :

```tsx
expect(html).toContain('Action');
expect(html).toContain('1/2');
expect(html).toContain('Mouvement');
expect(html).toContain('3/5');
expect(html).toContain('Avantage');
expect(html).not.toContain('Réaction');
```

Ajouter un scénario consommé (`actAvail={0}`) et vérifier un état textuel « utilisée » ou équivalent, pas uniquement une différence de couleur.

- [ ] **Step 2: Vérifier l’échec**

Run: `npx vitest run src/ui/ActiveFrame.test.tsx`

Expected: FAIL car les valeurs ne vivent aujourd’hui que dans les `title` des jauges.

- [ ] **Step 3: Composer les jauges et un résumé nommé**

Conserver `Notches` pour le retour instantané et l’aperçu clignotant. Ajouter à `ActiveFrame` un `<dl>` compact qui expose les mêmes props, sans recalcul :

```tsx
<dl aria-label="Ressources du tour">
  <div><dt>Action</dt><dd>{actAvail}/{actMax}</dd></div>
  <div><dt>Mouvement</dt><dd>{moveLeft}/{moveMax}</dd></div>
  <div><dt>Avantage</dt><dd>{advantage}/{advantageMax}</dd></div>
</dl>
```

Pour une ressource à zéro, ajouter du texte accessible « utilisée »/« épuisé » et un attribut de donnée permettant le style, sans créer une ressource distincte.

- [ ] **Step 4: Restituer l’identité courte de l’acteur**

Dans `.ab-actor-side`, afficher `active.label` et la carrière éventuelle au-dessus des alertes et sets d’armes. Le nom dans ce dock ne contredit pas la barre de groupe : il identifie le sujet des décisions du tour.

- [ ] **Step 5: Recomposer le bas de l’écran sans changer les actions**

Dans `combat-ui.css`, donner la priorité visuelle au bloc acteur/ressources, conserver `.ab-slots` et isoler visuellement la slot `Fin du tour` déjà produite par `ActionBar`. Ne réordonner aucune action par label : utiliser les ids de slots existants.

Dans `hud.css`, conserver le passage pleine largeur à 560 px et permettre à la liste d’actions de s’enrouler sans pousser le résumé hors écran.

- [ ] **Step 6: Vérifier le lot**

Run: `npx vitest run src/ui/ActiveFrame.test.tsx src/ui/ui-ratchets.test.ts && npm run typecheck`

Expected: PASS. `ActionBar` ne reçoit aucune nouvelle logique : il transmet les valeurs qu’il calcule déjà à la vue pure testée `ActiveFrame`.

- [ ] **Step 7: Commit ciblé**

```bash
git add src/ui/ActiveFrame.tsx src/ui/ActiveFrame.test.tsx src/ui/ActionBar.tsx src/ui/styles/combat-ui.css src/ui/styles/hud.css
git commit -m "feat(ui): nomme les ressources du tour"
```

## Task 5: Ajouter le résumé textuel du déplacement sans dupliquer son calcul

**Files:**

- Modify: `src/state/store.ts`
- Modify: `src/gameIso/stage/useHoverTargeting.ts`
- Modify: `src/gameIso/stage/useHoverTargeting.test.tsx`
- Create: `src/ui/MovementIntent.tsx`
- Create: `src/ui/MovementIntent.test.tsx`
- Modify: `src/ui/ActionBar.tsx`
- Modify: `src/ui/styles/combat-ui.css`

- [ ] **Step 1: Définir le contrat minimal de présentation**

Ajouter au store un état éphémère, par ids/valeurs et non par prose :

```ts
movementIntent: {
  kind: 'move' | 'run';
  cost: number;
  remaining: number;
  pathStatus: 'free';
} | null;
```

`pathStatus` ne prétend pas détecter un danger non modélisé : un aperçu produit par `movePreviewAt` est un trajet légal, donc « libre ». Les destinations illégales continuent à ne produire aucun aperçu.

- [ ] **Step 2: Écrire les tests du producteur**

Dans `useHoverTargeting.test.tsx`, vérifier qu’un survol de déplacement légal renseigne le coût exact déjà fourni par `hoverMove`, le mouvement restant dérivé du budget courant, puis revient à `null` quand le survol disparaît ou qu’une modale bloque l’action.

Run: `npx vitest run src/gameIso/stage/useHoverTargeting.test.tsx`

Expected: FAIL car `movementIntent` n’existe pas.

- [ ] **Step 3: Projeter les données existantes dans le store**

Dans un effet voisin de celui qui pose `hoverDelta`, écrire `movementIntent` uniquement lorsque `hoverMove.kind` vaut `move` ou `run`. Réutiliser `hoverMove.cost`, `movementRemaining` et les mêmes conditions de validité ; ne relancer aucun pathfinding.

- [ ] **Step 4: Écrire le composant pur**

`MovementIntent` reçoit l’objet ou `null` et rend le format suivant :

```text
Destination : 1 case · 3 mouvements resteront · trajet libre
```

Tester pluriels, course et rendu nul. Utiliser `role="status"` avec une politique `aria-live` non intrusive.

Run: `npx vitest run src/ui/MovementIntent.test.tsx`

Expected: FAIL puis PASS après implémentation.

- [ ] **Step 5: Monter le bandeau au-dessus des actions**

Lire `movementIntent` dans `ActionBar` et rendre `MovementIntent` dans le dock, sans déplacer les overlays de trajet de `IsoStage`. Sur tactile, le même état doit aussi être alimenté par `battle.preview` afin que le tap-1 présente le coût avant confirmation.

- [ ] **Step 6: Vérifier le lot**

Run: `npx vitest run src/gameIso/stage/useHoverTargeting.test.tsx src/ui/MovementIntent.test.tsx src/state/preview-resource-delta.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit ciblé**

```bash
git add src/state/store.ts src/gameIso/stage/useHoverTargeting.ts src/gameIso/stage/useHoverTargeting.test.tsx src/ui/MovementIntent.tsx src/ui/MovementIntent.test.tsx src/ui/ActionBar.tsx src/ui/styles/combat-ui.css
git commit -m "feat(ui): explicite le coût du déplacement"
```

## Task 6: Réaligner le HUD d’exploration et le flux de combat

**Files:**

- Modify: `src/ui/styles/hud.css`
- Modify: `src/ui/ObjectiveBanner.test.tsx` or existing objective render test
- Modify: `src/ui/CombatBanner.tsx` only if an accessibility attribute is missing
- Create or modify: `src/ui/CombatBanner.test.tsx`

- [ ] **Step 1: Verrouiller la séparation des rôles**

Dans les tests :

- `ObjectiveBanner` rend seulement en présence d’un objectif, garde le plus récent comme courant et reste dépliable ;
- `CombatBanner` ne contient ni « Round » ni donnée persistante d’initiative ;
- le message de combat porte `role="status"`/`aria-live="polite"` et un seul événement.

Run: `npx vitest run src/ui/ObjectiveBanner.test.tsx src/ui/CombatBanner.test.tsx`

Expected: le test d’annonce accessible échoue si l’attribut manque.

- [ ] **Step 2: Corriger uniquement la sémantique nécessaire**

Ajouter l’annonce accessible au `CombatBanner` sans changer `combatFeed`, `narrateIntent` ni la cadence du directeur de combat.

- [ ] **Step 3: Repositionner l’exploration**

Dans `hud.css`, placer l’objectif sous la zone lieu/date en haut à gauche plutôt que sous la barre de groupe. Garder sa largeur bornée et son dépliage. Les interactions restent portées par `IsoStage` (`interact-halo`, curseur et trajet) : ne pas créer de liste permanente en bas à droite, où vit déjà `LogDrawer`.

- [ ] **Step 4: Recaler le flux de combat**

Positionner `.combat-feed` sous une unique rangée de groupe et supprimer les offsets 176/254 px hérités du dock 2×2. Le flux reste centré, transitoire et ne chevauche pas le round/initiative.

- [ ] **Step 5: Vérifier le lot**

Run: `npx vitest run src/ui/ObjectiveBanner.test.tsx src/ui/CombatBanner.test.tsx src/ui/ui-ratchets.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit ciblé**

```bash
git add src/ui/styles/hud.css src/ui/ObjectiveBanner.test.tsx src/ui/CombatBanner.tsx src/ui/CombatBanner.test.tsx
git commit -m "feat(ui): sépare contexte d'exploration et flux de combat"
```

## Task 7: Finaliser les cinq largeurs responsive

**Files:**

- Modify: `src/ui/styles/hud.css`
- Modify: `src/ui/styles/combat-ui.css`
- Modify: `src/ui/styles/combat-modals.css` only if the existing 560 px full-screen behavior is incomplete
- Modify: `src/ui/ui-ratchets.test.ts` only if justified

- [ ] **Step 1: Définir les invariants CSS à tester**

Ajouter au cliquet ou à un test CSS ciblé des assertions de présence pour les trois breakpoints 900/700/560 et `pointer: coarse`. Verrouiller notamment :

- groupe de quatre portraits sur une seule rangée à 360 px (`flex-wrap: nowrap` + débordement horizontal de secours) ;
- initiative horizontale et défilable sous 700 px ;
- dock pleine largeur sous 560 px ;
- cibles caméra 44 px sous pointeur grossier.

- [ ] **Step 2: Vérifier l’échec des nouveaux invariants**

Run: `npx vitest run src/ui/ui-ratchets.test.ts`

Expected: FAIL sur les règles responsive absentes.

- [ ] **Step 3: Implémenter `<=900px`**

Compacter nom/ressources sans supprimer le round, la Blessure ou l’acteur courant. Autoriser le dock d’action à deux rangées. Ne pas réduire les portraits sous la taille lisible déjà définie par `PortraitTile`.

- [ ] **Step 4: Implémenter `<=700px`**

Transformer `.initiative-strip` en bande horizontale placée sous `.party-dock`; `.is-tiles` passe en ligne avec `overflow-x:auto`. Le cartouche du round reste le premier élément visible. Le groupe ne s’enroule plus en 2×2.

- [ ] **Step 5: Implémenter `<=560px` et `pointer: coarse`**

Garder quatre portraits sur une ligne ; réduire le texte visible mais conserver Blessures et alertes. Le dock occupe la largeur, le résumé acteur reste visible, les actions secondaires peuvent défiler/s’ouvrir sans cacher `Fin du tour`. Vérifier que les modales `RollShell` occupent l’écran, que leur corps défile et que le pied d’action reste fixe.

- [ ] **Step 6: Vérifier mécaniquement**

Run: `npx vitest run src/ui/ui-ratchets.test.ts src/ui/PartyDock.test.tsx src/ui/InitiativeStrip.test.tsx src/ui/ViewControls.test.tsx src/ui/ActiveFrame.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit ciblé**

```bash
git add src/ui/styles/hud.css src/ui/styles/combat-ui.css src/ui/styles/combat-modals.css src/ui/ui-ratchets.test.ts
git commit -m "feat(ui): adapte le HUD tactique aux petits écrans"
```

## Task 8: Verrouiller la hiérarchie de la modale d’attaque existante

**Files:**

- Verify: `src/ui/jetProps/useAttackJetProps.tsx`
- Create: `src/ui/jetProps/useAttackJetProps.render.test.tsx`
- Verify: `src/ui/VsHeader.tsx`

- [ ] **Step 1: Écrire un test de rendu du flux réel**

Initialiser le store avec une `pendingAttack` valide puis rendre les props renvoyées par `useAttackJetProps` dans `RollShell`. Vérifier dans l’ordre du DOM :

1. titre `Attaque` ;
2. `VsHeader` attaquant/cible ;
3. les deux rangées opposées quand une défense existe ;
4. arme et dégâts prévus ;
5. options de localisation ;
6. actions Annuler/Lancer.

Vérifier aussi l’absence de groupe, de round et de duplication de Blessures globales.

- [ ] **Step 2: Exécuter le test avant retouche**

Run: `npx vitest run src/ui/jetProps/useAttackJetProps.render.test.tsx`

Expected: PASS, car la cartographie confirme que le flux compose déjà `RollShell` et `VsHeader`. Un échec est une régression réelle à traiter avant de poursuivre, jamais le motif de créer une nouvelle modale.

- [ ] **Step 3: Vérifier les régressions de la coquille**

Run: `npx vitest run src/ui/jetProps/useAttackJetProps.render.test.tsx src/ui/RollShell.test.tsx src/ui/opposed-mask.test.tsx src/ui/component-conformance.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit ciblé**

```bash
git add src/ui/jetProps/useAttackJetProps.render.test.tsx
git commit -m "test(ui): verrouille la lecture de l'attaque opposée"
```

## Task 9: Recette navigateur complète et fermeture du chantier

**Files:**

- Delete after completion: `docs/superpowers/plans/2026-07-31-hud-combat-exploration.md`

- [ ] **Step 1: Lancer les gardes complètes**

```bash
npm test
npm run typecheck
npm run docs:check
```

Expected: trois commandes vertes. Corriger toute régression dans le lot qui l’a introduite, sans modifier un test pour masquer un comportement faux.

- [ ] **Step 2: Démarrer le jeu et utiliser la recette réelle**

Avec le skill `recette-navigateur`, lancer le scénario existant **L’Embuscade** via `window.__wfrp` pour le combat et **La Diligence — exploration** pour l’état hors combat. Ces deux scénarios couvrent déjà un groupe de quatre, plusieurs ennemis, déplacement, attaque et exploration libre : aucun nouveau scénario n’est requis.

- [ ] **Step 3: Recetter les états de combat**

À 1600×900, vérifier et capturer :

- précombat : round rattaché à l’initiative, valeurs visibles ;
- tour joueur : acteur courant uniquement dans initiative + dock ;
- déplacement : coût/reste/trajet avant confirmation ;
- attaque : `VsHeader`, valeurs opposées, localisation, actions ;
- résultat/influence : même ossature `RollShell` ;
- tour ennemi : intention brève, acteur courant lisible ;
- groupe : aucun caret/liseré d’acteur courant sur les quatre cartes.

- [ ] **Step 4: Recetter l’exploration**

Vérifier : initiative/round/dock absents ; groupe inchangé ; date/lieu et objectif lisibles ; halo/cursor/trajet d’une interaction réellement disponible ; aucun panneau permanent dupliquant ces affordances.

- [ ] **Step 5: Recetter les largeurs**

Répéter les points structurants à 900, 700, 560 et 360 px. À 360 px : quatre portraits sur une ligne, initiative horizontale défilable, acteur courant visible, commandes caméra tactiles, dock exploitable, modale plein écran et aucune collision.

- [ ] **Step 6: Vérifier console et contrôles**

Console à zéro erreur. Parcourir groupe, initiative, caméra, actions et modale au clavier ; vérifier `focus-visible`, noms accessibles et absence d’information reposant seulement sur la couleur.

- [ ] **Step 7: Faire corriger les défauts observés et rejouer la recette**

Chaque défaut visible reçoit un test quand il est mécaniquement verrouillable, puis est corrigé dans le composant source. Rejouer le scénario complet après la dernière correction.

- [ ] **Step 8: Supprimer le plan exécuté et committer**

La politique du dépôt interdit les plans périmés. Une fois tous les critères atteints :

```bash
git rm docs/superpowers/plans/2026-07-31-hud-combat-exploration.md
git add <uniquement les corrections finales et preuves autorisées>
git commit -m "docs(ui): clôt la refonte du HUD tactique"
```

- [ ] **Step 9: Pousser `main`**

```bash
git push origin main
```

Expected: branche distante à jour, arbre de travail ne contenant que les WIP étrangers déjà présents avant le chantier.

## Final Verification Checklist

- [ ] Chaque point des critères d’acceptation de la spécification possède un test ou une étape de recette explicite.
- [ ] Aucun `TBD`, placeholder, pseudo-API ou nom de fichier incertain ne subsiste.
- [ ] `PartyDock` ne reçoit plus aucun état de tour.
- [ ] `InitiativeStrip` reçoit le round depuis `battle.round` et porte seul la temporalité.
- [ ] `ViewControls` conserve son contrat partagé avec `EditorCanvas`.
- [ ] `ActiveFrame` ne recalcule pas l’économie ; il présente les props déjà calculées par `ActionBar`.
- [ ] Le déplacement réutilise `hoverMove`/`previewResourceDelta`, sans second pathfinding.
- [ ] L’attaque reste sur `RollShell`/`VsHeader`.
- [ ] Aucun label n’est utilisé comme clé logique.
- [ ] Aucun emoji, SVG local, couleur JSX en dur ou classe mono-écran injustifiée n’a été ajouté.
- [ ] `npm test`, `npm run typecheck`, `npm run docs:check` et la recette navigateur sont verts.
