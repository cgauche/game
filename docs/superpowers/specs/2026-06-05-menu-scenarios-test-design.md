# Menu de scénarios de test (et workflow de vérification visuelle)

- **Date** : 2026-06-05
- **Statut** : design validé (en attente de relecture spec).
- **Motivation** : la feature *rechargement & munitions* est **injouable** aujourd'hui — aucun pré-tiré n'a d'arme à distance ni de munition (l'équipement vient des `trappings` de carrière, vides dans la data). On a *la main* sur `Combatant.items` : on crée donc un héros et on lui donne directement une arbalète + des carreaux. Plus largement, le bouton « 🧪 Test rapide » (un seul couple équipe+scène) devient un **menu de scénarios de test** : chaque système récent du combat a un scénario dédié (groupe fixé + scène adaptée), pour vérifier au navigateur sans bricoler une partie.
- **Principe** : les **règles et les héros pré-tirés** restent 100 % sourcés (`createHero`, data LDB/ADE). Seuls les **ennemis de test** sont, au choix, de **vraies créatures du bestiaire** (`creatures.json`, LDB/ADE) ou — uniquement quand aucun équivalent canon n'existe (le **mannequin passif**) — une *fixture de test* clairement étiquetée. Une fixture de test n'est pas une affirmation de règle ; ce n'est pas du contenu de campagne.

## Décisions de design

| Sujet | Décision |
|---|---|
| Forme UI | **Sous-écran dédié** « Scénarios de test » (comme l'éditeur), liste de cartes. Nouvel écran `'test'` dans l'union `Screen`. |
| Registre | **Auto-découverte par dossier** : `src/scenes/test-scenarios/`, **un fichier = un scénario** (`export const scenario: TestScenario`). `index.ts` collecte via `import.meta.glob('./*.ts', { eager: true })` et trie par `order`. **Ajouter un scénario = déposer un fichier** — aucun tableau central à éditer. |
| Lancement | `setParty(makeParty())` → `startScene(scene)` → si `autoCombat` : `startCombat(id)` → `setScreen('campaign')`. |
| Combat direct | `autoCombat?: string` (id d'encounter) démarre le combat sans passer par l'exploration/dialogue — pratique pour itérer. Sinon flux normal (ex. l'Embuscade garde son dialogue). |
| Équipement custom | héros créé par `createHero` (carrière indifférente) puis `items` réassignés via `itemFromTrapping` + `recomputeLoadout` (dérive `reload`/`subType`). |
| Fidélité ennemis | vraies créatures `creatures.json` quand une convient ; statblocs custom déjà présents (mutants ch.2) réutilisables ; **mannequin** = seule fixture pure (M 0, beaucoup de Blessures, ne riposte pas). |
| Doc | `docs/test-scenarios.md` : registre + **convention de vérif visuelle** (passer par un scénario adapté, sinon en créer un). MAJ `Game/CLAUDE.md` § Vérification. |

## Type + auto-découverte

Dossier `src/scenes/test-scenarios/` :
- **`_shared.ts`** (préfixe `_` → hors glob) : le type `TestScenario` + le helper `arena(...)`. Importé par chaque scénario.
- **`<NN>-<slug>.ts`** : un fichier par scénario, `export const scenario: TestScenario = { order: NN, … }`.
- **`index.ts`** : registre auto-généré —
  ```ts
  const mods = import.meta.glob('./*.ts', { eager: true }) as Record<string, { scenario?: TestScenario }>;
  export const testScenarios: TestScenario[] = Object.entries(mods)
    .filter(([p]) => !p.includes('/_') && !p.endsWith('/index.ts'))
    .map(([, m]) => m.scenario)
    .filter((s): s is TestScenario => !!s)
    .sort((a, b) => a.order - b.order);
  ```

```ts
interface TestScenario {
  id: string;
  order: number;         // tri d'affichage
  icon: string;          // emoji de carte
  title: string;
  tests: string;         // une ligne « ce que ça vérifie »
  partyNote: string;     // ex. « Arbalétrier solo »
  makeParty: () => Combatant[];
  scene: Scene;
  autoCombat?: string;   // id d'encounter → combat direct
}
```

Helper partagé `arena(w, h, terrain='herbe')` (dans `_shared.ts`) : scène dégagée + entité `heroStart`, base des scénarios de combat direct. **Ajouter un scénario = créer un fichier dans ce dossier** ; le glob Vite le ramasse, l'écran l'affiche, aucun import manuel.

## Catalogue (batterie large — 6 scénarios)

1. **🏹 Tir & Rechargement** — *Groupe* : 1 **arbalétrier** (Arbalète « Recharge 1 » + Carreaux équipés). *Cible* : **mannequin passif** (fixture). *Teste* : tir consomme 1 munition + Empaleuse combinée ; **modale de rechargement** (Test étendu de Projectiles, cumul de DR) ; arme déchargée → tir refusé jusqu'au rechargement ; arme vide → tir refusé. `autoCombat`.
2. **🩸 L'Embuscade** — *Groupe* : 4 pré-tirés. La scène `ambushTest` actuelle (dialogue → combat, 5 mutants ch.2). Remplace l'ancien « Test rapide ».
3. **💀 Critiques & Mort** — *Groupe* : 1 héros fragile. *Ennemi* : un frappeur (vraie créature à forte F, ou mutant ch.2). *Teste* : overkill→Critique, 0 PB→À Terre→Inconscient→mort, tables 18-Traumatisme. `autoCombat`.
4. **🍀 Destin / Résilience** — *Groupe* : 1 héros (Destin + Résilience). *Ennemi* : frappeur létal. *Teste* : `pendingFateSave` (« Comment ça a pu rater ? » / « Meurs un autre jour ») + réussite garantie (Résilience). `autoCombat`.
5. **⚔️ Engagé / Charge / Désengagement** — *Groupe* : 2 héros mêlée. *Ennemis* : 2 humanoïdes espacés. *Teste* : Charger (portée Course + Avantage), état Engagé symétrique, Se désengager (sacrifice d'Avantage / Esquive opposée). `autoCombat`.
6. **✨ Magie** — *Groupe* : Sorcier (Fléchette/Choc) + Prêtre (Bénédictions). *Ennemis* : cibles faibles. *Teste* : modale d'incantation (NI/DR/Maladresse), Focalisation, Bénédictions. `autoCombat`.

## UI — `TestScenariosScreen.tsx`

Écran plein : titre, ← Retour (→ `'menu'`), grille de cartes. Carte = `icon` + `title` + « teste : `tests` » + `partyNote` + bouton **Lancer**. `MainMenu` : le bouton 🧪 devient « Tests — scénarios » → `setScreen('test')`. Routeur `src/ui/App.tsx` : ajouter `{screen === 'test' && <TestScenariosScreen />}` (lazy-load, comme l'éditeur, puisque inutile au menu).

## Documentation (livrable)

- `docs/test-scenarios.md` : décrit le registre + **comment vérifier une feature au navigateur** → *passer par le scénario de test adapté ; s'il n'en existe pas, en créer un* (1 entrée dans `src/scenes/test-scenarios.ts`, avec `autoCombat` pour aller droit au but). Liste les scénarios et ce que chacun couvre.
- `Game/CLAUDE.md` § **Vérification** : remplacer la mention « bouton Test rapide » par « menu **Tests — scénarios** » et renvoyer vers `docs/test-scenarios.md` (convention : vérif visuelle = via un scénario de test).

## Hors périmètre

- Combler le **gap data** des `trappings` de carrière (un Chasseur sans arc, etc.) — vrai sujet de contenu, distinct ; ici on assigne l'équipement à la main pour les fixtures.
- Sélecteur de munition multi-types : la data canon n'a qu'une munition par famille (Carreau/Flèche) → le sélecteur n'apparaît qu'à ≥2 munitions compatibles (déjà géré) ; pas de nouvelle munition inventée.
- Tests automatisés des scénarios eux-mêmes (ce sont des fixtures de vérif manuelle/visuelle) ; le moteur reste couvert par Vitest.

## Fichiers touchés (prévision)

- `src/scenes/test-scenarios/_shared.ts` (type `TestScenario` + `arena`)
- `src/scenes/test-scenarios/index.ts` (registre auto, `import.meta.glob`)
- `src/scenes/test-scenarios/<NN>-*.ts` (un fichier par scénario : tir-rechargement, embuscade, critiques-mort, destin-resilience, engagement, magie)
- `src/ui/TestScenariosScreen.tsx` (nouveau) + `src/ui/styles.css` (cartes)
- `src/ui/MainMenu.tsx` (bouton → écran de tests)
- `src/state/store.ts` (`Screen` += `'test'`) + le routeur `src/ui/App.tsx` (lazy `TestScenariosScreen`)
- `docs/test-scenarios.md` (nouveau) + `Game/CLAUDE.md` (§ Vérification)

> La doc `docs/test-scenarios.md` insistera sur la convention : **un scénario = un fichier dans `src/scenes/test-scenarios/`**.
