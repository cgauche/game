# CLAUDE.md — RPG Warhammer Fantasy v4 (web)

Guide pour Claude Code travaillant sur ce dépôt. Lire aussi `ROADMAP.md`.

## Ce qu'est ce projet

Un **jeu de rôle vidéoludique 100 % web, en français**, type *Neverwinter Nights / Baldur's
Gate* (tactique tour par tour, vue isométrique), basé sur **Warhammer Fantasy Roleplay 4e**.
On contrôle un groupe de 4 aventuriers à travers la campagne **L'Ennemi Intérieur**.

> ⚠️ **Ce dossier `Foundry/Game` EST un vrai projet logiciel** (dépôt GitHub `cgauche/game`).
> Le `Foundry/CLAUDE.md` parent (« ceci n'est pas un projet logiciel, ne pas committer »)
> **ne s'applique PAS ici**. Ici : commits + push attendus (remote `origin` = cgauche/game).
> Branche de travail : `feat/wfrp4-rpg-foundation`.

## Règles strictes (NE PAS déroger)

1. **Aucune invention de règles.** Toute règle/valeur vient des fichiers `Source/` (Livre de
   base + Archives de l'Empire I & II uniquement — **chemins exacts § Sources VF ci-dessous**).
   Ne pas utiliser tes connaissances WFRP.
   En cas de doute, lire le `.md` source et **citer** le passage. Un workflow d'audit de
   fidélité existe (cf. plus bas) — l'utiliser pour vérifier le code contre la source.
2. **Tout le contenu de campagne est éditable** dans l'éditeur (schéma de Scène unique).
   Pas de scène codée « en dur ».
3. **Le moteur de règles (`src/engine`) reste pur et testé.** Le store, l'UI et le rendu en
   dépendent, jamais l'inverse.
4. **UI en français**, et qui **scale** : dès qu'un panneau dépasse ~2 sections → onglets.

## Sources VF (NE PAS chercher — c'est ici)

Tout est en **français** sous `Source/`, dossiers préfixés **`Warhammer v4 - …`**. Les dossiers
SANS ce préfixe (Enemy Within…, Altdorf…, Archives of the Empire…) sont la **VO** (base de
connaissance MJ du dépôt parent) — **ne jamais les lire/citer** ici (la donnée du jeu est FR :
CC/CT/F/E…). Au moindre doute, **lire le `.md` et citer** `LDB <chap> l.<ligne>` / `ADE…`.

**RÈGLES & STATS** (règle 1 — seules sources autorisées) :
- **LDB** = `Source/Warhammer v4 - Livre de base version corrigée/` — chapitres `NN - Titre.md` ;
  les commentaires de code `LDB <n> l.<ligne>` pointent ces fichiers. Chapitres clés :
  06 Classes · 07 Carrières · 08 Statut · 09 Compétences · 10 Talents · 12 Tests · **13 Combat** ·
  15 Déplacement · **16 États** · **17 Destin et Résistance** (« Résilience/Détermination ») ·
  **18 Traumatisme** (critiques) · 19 Corruption · 20 Maladies · **21 Psychologie** ·
  40-43 Prières/Bénédictions/Miracles · 46-51 Règles magiques/Sorts/Magie des Couleurs/Sorcellerie ·
  57 Monnaie · 59 Faire son marché · 60 Fabrication · 61 Encombrement · **62 Les armes** ·
  **63 Armures** · 71 Drogues et poisons · **76 Point d'Impact des Créatures** · 77-83 bestiaire ·
  **85 Traits de créature**. Index : `00 - Index.md`.
- **ADE I** = `Source/Warhammer v4 - Les archives de l'Empire volume 1/`.
- **ADE II** = `Source/Warhammer v4 - Les archives de l'Empire volume 2/`.
- `Source/all-data.json` = extraction filtrée LDB/ADE (source de `npm run build:data`).

**SCÉNARIOS / CONTENU de campagne** (PAS pour les règles) :
- Tome 1 : `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` + `… L'ennemi dans l'Ombre Compagnon/`.
- Tome 2 : `Source/Warhammer v4 - 2.0 Mort sur le Reik/` + `… Mort sur le Reik Compagnon/`.
- Tome 3 : `Source/Warhammer v4 - 3.0 Le Pouvoir Derriere le Trone/` (pas de Compagnon VF).
- Suppléments VF dispo : `Aldorf la Couronne de l'Empire`, `Aventures a Ubersreik`,
  `Middenheim la cité du Loup Blanc`, `Nuits agitees & dures journées`,
  `Boîte d'Initiation WFRP 4e Edition VF` (+ `WH4_FR_BI_Livre_Aventure` / `…_Ubersreik`).

## Pile technique

- **Vite + TypeScript + React** (UI). **Rendu isométrique en SVG React** (PAS Phaser).
- **Zustand** (store global). **Vitest** (tests du moteur). Le RNG est **seedable**
  (`makeRNG`) pour des tests déterministes et une future coop réseau.

## Commandes

```bash
npm install
npm run build:data   # (re)génère src/data/*.json depuis Source/all-data.json (filtré LDB/ADE1/ADE2)
npm run dev          # serveur de dev (http://localhost:5173)
npm test             # tests Vitest du moteur
npm run typecheck    # tsc --noEmit
npm run galleries              # (re)génère toutes les galeries QC -> public/galeries.html (hub)

# Déploiement en PRODUCTION (GitHub Pages → https://cgauche.github.io/jeu/)
node scripts/deploy/deploy.mjs            # build:data + build (Vite) + copie dist/ → cgauche.github.io/jeu/
node scripts/deploy/deploy.mjs --no-build # copie le dist/ existant seulement (pas de rebuild)
node scripts/deploy/deploy.mjs --push     # + git add/commit/push du repo prod (publie réellement)
```

**Déploiement** : `scripts/deploy/deploy.mjs` est LE script de mise en prod (le jeu jouable en ligne).
Il build le jeu, copie `dist/` (hors `qc/`) dans le repo voisin `cgauche.github.io/jeu/`, et avec
`--push` commit + push ce repo → le site se met à jour sur **https://cgauche.github.io/jeu/**.
Prérequis : `PhpstormProjects/cgauche.github.io` doit exister en sibling de `Foundry/`, avec un remote
en écriture. **Ne déployer que sur demande explicite de l'utilisateur** (et après suite verte) ;
`deploy.mjs` lit le **working tree** (pas Git) — si une autre session a du WIP non commité, il
l'embarquerait → s'assurer que l'arbre est propre/commité avant de pousser en prod.

**Vérification** : après une feature UI, valider dans le navigateur (Playwright MCP) — charger
`localhost:5173`, dérouler le flux, vérifier `console` (0 erreur) et screenshoter. Le menu
**« 🧪 Tests — scénarios »** ouvre un choix de scénarios de test (groupe fixé + scène adaptée,
combat direct) ; **passer par le scénario adapté, sinon en créer un** — un scénario = un fichier
dans `src/scenes/test-scenarios/` (cf. `docs/test-scenarios.md`).

## Architecture (où trouver quoi)

```
Source/                     Livres WFRP4 en .md + all-data.json (source de vérité ; PDFs gitignorés)
scripts/build-data.ts       Pipeline Source/all-data.json -> src/data (filtré LDB/ADE1/ADE2)
src/data/                   NOTRE base générée (NE PAS éditer à la main) + index.ts (accès typé), pregens.ts
                            EXCEPTIONS manuscrites (tables verbatim sourcées) : criticals.ts, oups.ts,
                            mutations.ts (Tableaux de Corruption LDB 19), spellspecs/ (specs de sorts
                            CURÉES par famille — repli regex iso-POC pour les sorts non curés)
src/engine/                 Règles WFRP4, PUR + testé :
  types.ts                    Caractéristiques, Combatant, Weapon, ItemInstance, Difficulty…
  tests.ts                    Tests & Degrés de Réussite (DR), tests opposés
  combat.ts                   touche/localisation inversée/dégâts/critique/initiative
  characteristics.ts          bonus, Blessures (BF+2×BE+BFM)
  character.ts                création de personnage (espèce+2d10, 40 augmentations…)
  items.ts                    inventaire/équipement : itemFromTrapping, recomputeLoadout, encombrement
  skills.ts                   valeur d'un test de compétence (partyBest) hors combat
  conditions.ts               États (+ durées d'États de sort, États récurrents)
  ops.ts                      vocabulaire GameOp PARTAGÉ (sorts/contrecoups/mutations) + applyOps
  spellspec.ts                SpellSpec (effets structurés d'un sort) + repli regex (fallbackSpec)
  magic.ts                    incantation/Focalisation/Péché/ZdE/portée/armure (« Repousser les Vents »)
  miscast.ts                  tables d'Imparfaites & Colère des dieux (d100 → GameOps, verbatim)
  corruption.ts               Corruption & mutations (LDB 19 : expositions, seuil, limites → damné)
  grimoire.ts                 apprentissage/mémorisation des sorts (coûts par Talent) + lecture au livre
src/state/
  scene.ts                  SCHÉMA DE SCÈNE (tiles, entities, dialogues, triggers, encounters, Effect[])
  store.ts                  store Zustand : GameState + vue (caméra/zoom) + campagne (scènes, dialogues,
                            effets, temps/repos) + actions de combat — délègue aux modules (get,set) :
  combatFlow.ts               flux de combat tour par tour (IA, attaques, effets, fin de combat)
  rollFlow.ts / rollFlows.ts  FABRIQUE générique des flux de jet différé (« un jet = une modale ») +
                              specs des 11 flux (trample/run/focus/psych/frenzy/reload/recover/test/
                              appraise/bargain/heal) — un nouveau jet = 1 spec + 1 xConfirm
  corruptionFlow.ts           gainCorruption (seuil → mutation → damnation, révélation 🧬) + cibles
  pendings.ts                 types Pending* (ré-exportés par store.ts)
  partyFlow.ts                équipement, avancement PX, consommables de fiche, butin
  merchantFlow.ts             marchand : réassort, panier, achat/vente/réparation, Marchandage, Évaluation
  spawn.ts / path.ts / bus.ts
src/gameIso/                Rendu isométrique SVG (remplace Phaser) :
  iso.ts                      projection (tileCenter, diamondPath, screenToTile, stageSize)
  sprites.ts                  décor (props/villageois/terrain en relief) + DEFS (gradients) — PLUS de sprite créature
  rig/                        gabarits corporels (bipède + quadrupède/ailé/serpentin/…) — rend TOUT le bestiaire
  pickBackend.tsx             classifieur unique : rig humanoïde / gabarit animé / sprite décor
  IsoStage.tsx                composant de rendu (caméra, clics, tokens, surbrillances)
  fx/                         FX de combat pilotés par le bus : useCombatFx (flottants/projectiles/halos/
                              zones) + FxLayer (rendu) + useWalkAnim (marche animée)
src/ui/                     React : menus, créateur, CampaignView (HUD), CharacterSheet, modales
  RollFlowShell.tsx           coquille PARTAGÉE des modales de jet (Lancer→Chance→Résilience→Appliquer)
                              + <Dice> — pendant UI de state/rollFlow
  editor/                     Éditeur : Editor.tsx (sélection + outils + canvas), Palette.tsx (volet
                              gauche à onglets), Inspector.tsx (volet droit), useSceneHistory (undo/redo),
                              useEditorView (caméra), TriggersEditor, DialogueEditor, EncountersEditor,
                              EffectList (constructeur d'effets partagé)
src/scenes/                 Documents de scène (tome1-intro, tome1-route) + campaign.ts + tome1-dossiers.json
art-ref/                    Illustrations extraites des PDFs + mapping.json (GITIGNORÉ — droits Cubicle 7)
```

## Systèmes clés (état actuel)

- **Schéma de Scène + Effets** (`scene.ts`) : `Effect` = setFlag, journal, document, giveItem,
  giveMoney, startCombat, **transition** (scène+entry), startDialogue, **test** (compétence +
  difficulté + `onSuccess`/`onFailure`), endDialogue. Tout est appliqué par `applyEffects` dans le store.
- **Moteur de campagne** : transitions de scènes (registre depuis `campaign`), tests de
  compétence interactifs (modal + branches), inventaire/argent/handouts (state party-level).
- **Inventaire/équipement** : chaque héros a `items: ItemInstance[]` ; `weapons`/`armour`
  ACTIFS dérivés via `recomputeLoadout` (équiper change le combat). Fiche = `CharacterSheet.tsx`.
- **Rendu des entités** : tout passe par `pickBackend` → le **rig** (`src/gameIso/rig/`) : humanoïdes
  bipèdes (carrière + arme + armure + mutations visibles) et créatures non-bipèdes via gabarit corporel
  animé (quadrupède/ailé/serpentin/…). `sprites.ts` ne fournit plus que le décor (props) et le villageois.
  Le sprite monolithique (`creatureSprites.json` + `enemySprite`/`creatureView`) a été retiré (juin 2026).
- **Éditeur** : iso WYSIWYG, onglets Carte/Logique/Scène, triggers/dialogues/rencontres
  structurés, outil « Zone » (drag → trigger). Bouton « Tester » lance la scène en jeu.

## Workflows multi-agents (sur opt-in « ultracode »)

Bons pour la **donnée/extraction/vérification**, pas l'art à l'aveugle. Déjà utilisés :
audit de fidélité des règles (a trouvé 3 vrais bugs), extraction du Tome 1 en dossiers,
génération des sprites de bestiaire depuis l'art officiel (lecture d'image par les agents).
Prochain candidat : **sprites de carrières** (réfs prêtes dans `art-ref/ldb/mapping.json`).

## Pièges connus

- **Closure synchrone en test Playwright** : cliquer un bouton qui change un état React PUIS
  agir dans le MÊME `evaluate` lit l'ANCIEN état (React n'a pas re-rendu). Séparer en deux
  appels, ou utiliser un `ref` côté composant pour la logique de drag.
- `npm run build:data` doit être lancé après un `git clone` (les `src/data/*.json` sont commités,
  mais les régénérer garantit la cohérence avec `Source/`).
- L'« inventaire » party-level (`store.inventory`, liste de noms pour handouts/butin) est
  DISTINCT de l'inventaire à stats par personnage (`Combatant.items`).
