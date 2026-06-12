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

1. **Aucune invention de règles.** Toute règle/valeur vient des fichiers `Source/` (livres
   autorisés — **liste exacte § Sources VF ci-dessous**). Ne pas utiliser tes connaissances WFRP.
   En cas de doute, lire le `.md` source et **citer** le passage. Un workflow d'audit de
   fidélité existe (cf. plus bas) — l'utiliser pour vérifier le code contre la source.
2. **Tout le contenu de campagne est éditable** dans l'éditeur (schéma de Scène unique).
   Pas de scène codée « en dur ».
3. **Le moteur de règles (`src/engine`) reste pur et testé.** Le store, l'UI et le rendu en
   dépendent, jamais l'inverse.
4. **UI en français**, et qui **scale** : dès qu'un panneau dépasse ~2 sections → onglets.
   **Tout nouvel écran est responsive dès sa création** (utilisable à 360px) : composer les
   primitives globales de `styles.css` — `.layout-sidebar` (colonne latérale, s'empile ≤900px),
   `.panel-grid` (1 colonne ≤700px), `.bar` (s'enroule ≤700px), cibles tactiles via
   `pointer: coarse`. Breakpoints canon : 900 / 700 / 560 px.

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
- **EDO** (L'Ennemi dans l'Ombre, T1) = `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` — inclus
  2026-06-11 : sorts de Tzeentch, créatures du Chaos (Horreurs, Furie), 3 talents + 3 traits.
- **EDOC** (Compagnon T1) = `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/` — 9 véhicules.
- **Middenheim** = `Source/Warhammer v4 - Middenheim la cité du Loup Blanc/` — 3 origines humaines + carrière Frère Loup.
- `Source/all-data.json` = extraction filtrée aux **livres autorisés ci-dessus** (LDB/ADE1/ADE2 +
  EDO/Middenheim/EDOC) — source de `npm run build:data`. **Exclusion** (`DENY_CLASS`, `scripts/build-data.ts`) :
  la classe « Chaos » et sa carrière « Magus du culte de Tzeentch » sont retirées (contenu ennemi, hors
  création joueur) ; les sorts de Tzeentch RESTENT (verrouillés au joueur par le Talent du grimoire).
  EDO/EDOC/Middenheim sont AUSSI des livres de scénario (cf. ci-dessous) ; seule leur **donnée extraite**
  entre dans les règles, pas leur prose narrative.

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
npm run build:data   # (re)génère src/data/*.json depuis all-data.json (livres autorisés : LDB/ADE + EDO/Middenheim/EDOC)
npm run dev          # serveur de dev (http://localhost:5173)
npm test             # tests Vitest du moteur
npm run typecheck    # tsc --noEmit
npm run galleries              # (re)génère toutes les galeries QC -> public/galeries.html (hub)

# Coop en ligne (relay WebSocket — Worker Cloudflare, dossier server/)
npm run relay:dev      # Worker relay en local (wrangler dev, port 8787) ; côté client : VITE_RELAY_URL=http://localhost:8787 npm run dev
npm run relay:deploy   # déploie le Worker (compte Cloudflare) → URL dans RELAY_URL_PROD (src/net/relay.ts)

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

**Outils de recette `window.__wfrp`** (DEV uniquement, `src/state/devtools.ts`) : pour piloter le
jeu depuis Playwright **sans chasser les coordonnées pixel des tokens**. Depuis un `browser_evaluate` :
- `__wfrp.state()` → instantané lisible (écran, `sceneId`, `partyPos`, `inDialogue`, `inCombat`, groupe, argent).
- `__wfrp.entities()` → **cartographie** : chaque entité de la scène `{ id, label, kind, pos, access }`
  (`access` = `talk`/`merchant`/`interact`/`—`).
- `__wfrp.talk('id')` → téléporte le groupe à côté de l'entité et l'**interpelle** (ouvre dialogue/marchand).
- `__wfrp.goto('id'|{x,y})` → place le groupe sur la case (déclenche portes/triggers au pas).
- `__wfrp.screen('menu'|'party'|…)` → navigue ; `__wfrp.store` = store Zustand brut (`getState`/`setState`).
- `__wfrp.scenario('ciblage', seed?)` → **lance un scénario de test prêt à jouer** (sans menu, pause de Round 1
  acquittée, initiative déterministe si `seed`) ; sans argument : liste les ids.
- `__wfrp.hover('id'|{x,y}|null)` → **survol programmatique** en combat (tooltip + réticule de visée se rendent
  sans souris) ; `__wfrp.aim('id')` → vérité state du ciblage (ok/invalid + raison, compétence, dégâts).
- `__wfrp.battle()` → snapshot combat (round, actif, modales ouvertes, combattants une ligne chacun) ;
  `__wfrp.turn('id')` → **donne le tour** (fini d'attendre l'IA) ; `__wfrp.place('id',{x,y})` → téléporte.
- `__wfrp.modal()` → modale(s) `pending*` ouvertes ; `__wfrp.roll()` / `__wfrp.confirm()` / `__wfrp.cancel()`
  → pilotent LA modale ouverte par convention `<flux>Roll/Confirm/Cancel` (révélations/Round : verbe propre).
- Les tokens de combat portent `data-cid="<id du combattant>"` dans le SVG → survol/clic ciblé par sélecteur DOM.
- **Triches de recette** : `killEnemies()` (victoire par le flux normal), `healParty()` (PB max,
  états/critiques/maladies purgés), `give(co)` / `xp(n)`, `flags()` / `flag('id', bool)` (portes de
  l'arène), `go('scene-id')` (transition), `fight()` (liste/lance une rencontre de la scène),
  `time(min)` / `rest(jours)` (horloge + cascade quotidienne).
Piège du *closure-sync* : lire le DOM dans le **même** `evaluate` que `talk()` lit l'état AVANT le
re-rendu React — séparer en deux appels (cf. `game-browser-verif-tempo`).

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
  character.ts                création de personnage (espèce+2d10, 40 augmentations, talents…)
  creation.ts                 tables de création LDB 04/05 : d100 espèce/carrière, bonus PX,
                              100 Points, Richesse initiale, âge/taille/yeux/cheveux
  careerSlots.ts              spécialisations & emplacements « (Au choix) » des carrières :
                              parsing, désignations par carrière, Maxi des talents
  talentEffects.ts            talents à effet création/attributs (+5 carac de départ, addSkill,
                              Dur à cuire/Chanceux/Obstiné/Véloce)
  advancement.ts              coûts PX, complétion de Niveau, changement de carrière (validé)
  items.ts                    inventaire/équipement : itemFromTrapping, recomputeLoadout, encombrement
  skills.ts                   valeur d'un test de compétence (partyBest) hors combat
  conditions.ts               États (+ durées d'États de sort, États récurrents)
  ops.ts                      vocabulaire GameOp PARTAGÉ (sorts/contrecoups/mutations) + applyOps ;
                              Jalon 2.6 : PerSL (échelle par DR), onlyGroups, grantTrait/grantTalent/
                              enchantWeapon/cureDisease/… ; SpellSpec.teleportMeters/pushMeters
  spellspec.ts                SpellSpec (effets structurés d'un sort) + repli regex (fallbackSpec)
  magic.ts                    incantation/Focalisation/Péché/ZdE/portée/armure (« Repousser les Vents »)
  miscast.ts                  tables d'Imparfaites & Colère des dieux (d100 → GameOps, verbatim)
  corruption.ts               Corruption & mutations (LDB 19 : expositions, seuil, limites → damné)
  grimoire.ts                 apprentissage/mémorisation des sorts (coûts par Talent) + lecture au livre
  travel.ts                   voyage RAW (#T2) : vitesses km/h, 6 h/jour, marche forcée, coûts diligence/barge
  provisions.ts               rations & Faim (LDB 18 l.417-422) : consommation/jour, Tests, malus, Brouet
src/state/
  scene.ts                  SCHÉMA DE SCÈNE (tiles, entities, dialogues, triggers, encounters, Effect[])
  worldMap.ts               SCHÉMA DE CARTE DU MONDE (#T2) : lieux/routes au niveau projet + format projet v2
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
  travelFlow.ts               voyage jour par jour (temps, fatigue, péripéties d10+auteur, interruption/reprise)
  upkeep.ts                   entretien QUOTIDIEN (#T3 cascade : rations/faim + maladies + convalescence
                              des critiques, jours CALENDAIRES) + purge des effets a duree d'horloge
                              (castPenalties/ActiveEffect.untilTime) — anti-double-comptage lastUpkeepDay
  spawn.ts / path.ts / bus.ts
src/gameIso/                Rendu isométrique SVG (remplace Phaser) :
  iso.ts                      projection (tileCenter, diamondPath, screenToTile, stageSize)
  sprites.ts                  décor (props/villageois/terrain en relief) + DEFS (gradients) — PLUS de sprite créature
  rig/                        gabarits corporels (bipède + quadrupède/ailé/serpentin/…) — rend TOUT le bestiaire
                              AJOUTER une créature : suivre docs/creer-une-creature.md (registre defs/,
                              corps nu ≠ tenue, illustration art-ref obligatoire, pièges codifiés)
  pickBackend.tsx             classifieur unique : rig humanoïde / gabarit animé / sprite décor
  IsoStage.tsx                composant de rendu (caméra, clics, tokens, surbrillances)
  fx/                         FX de combat pilotés par le bus : useCombatFx (flottants/projectiles/halos/
                              zones) + FxLayer (rendu) + useWalkAnim (marche animée)
src/ui/                     React : menus, CampaignView (HUD), CharacterSheet, modales
  creator/                    assistant de création multi-étapes (LDB 04/05) : CharacterCreator.tsx
                              (rendu) + draft.ts (état pur : tirages figés, bonus PX, validation)
  RollFlowShell.tsx           coquille PARTAGÉE des modales de jet (Lancer→Chance→Résilience→Appliquer)
                              + <Dice> — pendant UI de state/rollFlow
  editor/                     Éditeur : Editor.tsx (sélection + outils + canvas), Palette.tsx (volet
                              gauche à onglets), Inspector.tsx (volet droit), useSceneHistory (undo/redo),
                              useEditorView (caméra), TriggersEditor, DialogueEditor, EncountersEditor,
                              EffectList (constructeur d'effets partagé)
src/scenes/                 Documents de scène + campaign.ts (campagne = l'Arène, `arene/arene-projet.json`,
                            projet v2 {scenes, worldMap} — 20 scènes : Bourg+intérieurs, 13 zones, 3 expéditions,
                            embuscade ; AUTHORING par `scripts/arene/generate.mjs`, cartes ASCII → JSON canonique
                            qui RESTE la source éditable dans l'éditeur)
                            + test-fixture.ts (scène neutre `testScene` + rencontre `enc-mutants` des tests de combat)
src/net/                    Coop en ligne (relay WebSocket) : relay.ts (RelayClient heartbeat/backoff,
                            RoomHost = un Transport virtuel par siège, RoomGuest), session.ts (hôte-
                            autoritaire : intents allowlist + snapshots), protocol.ts, compress.ts,
                            intents.ts — codes de room 6 chars, reconnexion auto par token (grace 2 min)
server/                     Worker Cloudflare du relay coop (Durable Object « Room », hibernation WS,
                            TTL 30 min) — npm run relay:dev / relay:deploy
art-ref/                    Illustrations extraites des PDFs + mapping.json (GITIGNORÉ — droits Cubicle 7)
```

## Systèmes clés (état actuel)

- **Schéma de Scène + Effets** (`scene.ts`) : `Effect` = setFlag, journal, document, **giveTrapping**
  (donner un objet — nom RÉEL de la base → objet à stats ; nom inconnu → objet CUSTOM `misc` ;
  il n'y a PLUS de `giveItem`/inventaire de groupe), giveMoney, giveXp, startCombat, **transition**
  (scène+entry), startDialogue, **test** (compétence + difficulté + `onSuccess`/`onFailure`),
  endDialogue. Tout est appliqué par `applyEffects` dans le store.
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
- Il n'y a PLUS d'inventaire de GROUPE (`store.inventory`/`giveItem` supprimés) : tout objet va
  sur un héros (`Combatant.items`) via `giveTrapping` (réel ou custom). Butin d'équipement
  attribuable par portrait à l'écran de victoire (`pendingVictory.gear`).
