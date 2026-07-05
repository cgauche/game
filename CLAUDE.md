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

1. **Aucune invention de règles.** Toute règle/valeur vient des livres autorisés (§ Sources VF).
   Ne pas utiliser tes connaissances WFRP. **Point d'entrée = l'Atlas RAW [`docs/raw/`](docs/raw/00-index.md)** :
   21 fiches de règles par domaine + 6 catalogues de données mécaniques, consolidant les 15 livres
   (couverture **⬜0** ; gardes rejouables `node scripts/raw/coverage.mjs` & `node scripts/raw/reconcile.mjs`).
   **Y chercher d'abord** « est-ce RAW / que dit le RAW ». `Source/` (§ ci-dessous) reste la vérité
   **citable** (`LDB <chap> l.<ligne>`) et le recours ultime — **devoir rouvrir `Source/` = un défaut
   de l'Atlas à corriger** (amender la fiche/le catalogue, puis re-vérifier avec les deux gardes).
2. **Tout le contenu de campagne est éditable** dans l'éditeur (schéma de Scène unique).
   Pas de scène codée « en dur ».
3. **Le moteur de règles (`src/engine`) reste pur et testé.** Le store, l'UI et le rendu en
   dépendent, jamais l'inverse.
4. **UI en français**, et qui **scale** : dès qu'un panneau dépasse ~2 sections → onglets.
   **Tout nouvel écran est responsive dès sa création** (utilisable à 360px) : composer les
   primitives globales de `styles.css` — `.layout-sidebar` (colonne latérale, s'empile ≤900px),
   `.panel-grid` (1 colonne ≤700px), `.bar` (s'enroule ≤700px), cibles tactiles via
   `pointer: coarse`. Breakpoints canon : 900 / 700 / 560 px.
5. **Aucune retranscription des textes sources dans les `.json`.** Une description (`desc`, et tout
   champ de prose : effet, règles…) est un **copié/collé verbatim** de la source — JAMAIS une
   reformulation, un résumé ou une paraphrase. Le formatage est **conservé en Markdown** (la source
   est en Markdown → on recolle tel quel : `**gras**`, `*ital*`, listes `-`, sauts `\n\n`), **jamais
   en HTML**. Corollaire de la règle 1 : le texte affiché doit pouvoir être recollé tel quel dans
   `Source/`. Rendu par l'unique primitive `<Prose>` (`src/ui/Prose.tsx`, `react-markdown`, HTML brut
   neutralisé + auto-liage des règles) ; garde-fou `src/data/no-html-in-prose.test.ts`.

## Sources VF (NE PAS chercher — c'est ici)

Tout est en **français** sous `Source/`, dossiers préfixés **`Warhammer v4 - …`**. Les dossiers
SANS ce préfixe (Enemy Within…, Altdorf…, Archives of the Empire…) sont la **VO** (base de
connaissance MJ du dépôt parent) — **ne jamais les lire/citer** ici (la donnée du jeu est FR :
CC/CT/F/E…). Au moindre doute, **lire le `.md` et citer** `LDB <chap> l.<ligne>` / `ADE…`.

> **Couche de lecture consolidée = l'Atlas [`docs/raw/`](docs/raw/00-index.md)** (cf. règle 1) : il agrège
> ces 15 livres par domaine + catalogues de stats. Lis l'Atlas pour comprendre/vérifier ; n'ouvre `Source/`
> que pour **citer** ou lever un doute. ⚠ **Source ré-extraite à Marker le 2026-06-22** (tables fiables,
> remplace l'ancien OCR pymupdf4llm) → les **n° de ligne** des anciennes réfs `l.<ligne>` ont **dérivé**
> (le **chapitre** reste juste, la **ligne** est approximative) ; pipeline `scripts/raw/marker-*` + `reextract-all.sh`.

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
- **AA** (Aux Armes / *Up in Arms*) = `Source/WH - V4 - Aux Armes/` — supplément combat & armes (autorisé 2026-06-14 ;
  source des talents que frenchy.bzh référence : Fusilier, Officier de Siège, etc.).
- **ZI** (Zoo Impérial / *The Imperial Zoo*) = `Source/WH - V4 - Le zoo impérial/` — créatures exotiques + le trait
  **Redoutable** (*Grim*) (autorisé 2026-06-14). NB : AA/ZI ne sont PAS dans `all-data.json` → leur donnée est
  **curée à la main directement dans `src/data/*.json`** (commitée, éditable au Codex), chaque entrée taguée à sa
  `source`, pas par `build:data`.
- **MDG** (La Mer des Griffes / *Sea of Claws*) = `Source/WH - V4 - La Mer de Griffe/` — **cadre côtier + règles navales**
  (autorisé 2026-06-22) : navires & construction/artillerie (ch.12), navigation/manœuvres/**combat naval** + dégâts &
  Critiques sur navire (ch.13), tests d'équipage & moral (ch.14), longs voyages/commerce/**activités & maladies en mer**
  (ch.15), classe **Côtier** (8 carrières, ch.9) + carrières norses (ch.7), cultes **Manann/Stromfels** + miracles
  (ch.10-11), magie des mers (ch.2), **bestiaire marin** + capitaines nommés (ch.16). Comme AA/ZI : extraction curée, pas `build:data`.
- **ACE** (Altdorf – Couronne de l'Empire) = `Source/Warhammer v4 - Aldorf la Couronne de l'Empire/` — **UNIQUEMENT
  l'Annexe I « Activités à Altdorf » (ch.12)** : 5 Activités « entre deux aventures » gated par lieu (Pénitence,
  Entraînement à une arme inhabituelle, Tester des objets magiques, Mécénat, Recherche universitaire) — cf. `activities.json`
  (`source.book: "ACE"`, `where: ["altdorf"]`). Le reste du livre reste **CONTENU de campagne** (cf. ci-dessous), pas des règles.
  Comme AA/ZI/MDG : extraction curée à la main, pas `build:data`.
- `Source/all-data.json` = ancienne extraction (LDB/ADE1/ADE2 + EDO/Middenheim/EDOC). **La migration
  `build:data` a été RETIRÉE** (elle régénérait `src/data/*.json` et écrasait les données curées —
  apparence des créatures, etc.). `src/data/*.json` est désormais la **SOURCE app-owned** (commitée,
  éditée dans le Compendium) ; tout nouveau contenu s'ajoute à la main / via l'éditeur, plus par re-seed.
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
npm run dev          # serveur de dev (http://localhost:5173) — src/data/*.json est la SOURCE app-owned (commitée)
npm test             # tests Vitest du moteur
npm run typecheck    # tsc --noEmit
npm run galleries              # (re)génère toutes les galeries QC -> public/galeries.html (hub)

# Coop en ligne (relay WebSocket — Worker Cloudflare, dossier server/)
npm run relay:dev      # Worker relay en local (wrangler dev, port 8787) ; côté client : VITE_RELAY_URL=http://localhost:8787 npm run dev
npm run relay:deploy   # déploie le Worker (compte Cloudflare) → URL dans RELAY_URL_PROD (src/net/relay.ts)

# Déploiement en PRODUCTION (GitHub Pages → https://cgauche.github.io/jeu/)
node scripts/deploy/deploy.mjs            # build (Vite) + copie dist/ → cgauche.github.io/jeu/
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
- `__wfrp.scenario('entrainement', seed?)` → **lance un scénario de test prêt à jouer** (sans menu, pause de Round 1
  acquittée, initiative déterministe si `seed`) ; sans argument : liste les ids.
- `__wfrp.hover('id'|{x,y}|null)` → **survol programmatique** en combat (tooltip + réticule de visée se rendent
  sans souris) ; `__wfrp.aim('id')` → vérité state du ciblage (ok/invalid + raison, compétence, dégâts).
- `__wfrp.battle()` → snapshot combat (round, actif, modales ouvertes, combattants une ligne chacun) ;
  `__wfrp.turn('id')` → **donne le tour** (fini d'attendre l'IA) ; `__wfrp.place('id',{x,y})` → téléporte ;
  `__wfrp.log(n)` → queue lisible des journaux (exploration + feed de combat).
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
Source/                     Livres WFRP4 en .md (+ all-data.json dormant : la migration build:data est retirée)
src/data/                   NOTRE base APP-OWNED (JSON commité, éditable dans le Compendium) + index.ts (accès typé), pregens.ts
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
  ops.ts                      **`GameOp` = LA langue UNIQUE de tout EFFET mécanique** (soin, retrait/pose
                              d'État, octroi de trait/talent/arme, dégâts, modificateurs, corruption…),
                              exécutée par `applyOps(target, ops, ctx)` et éditée par `GameOpEditor`.
                              AVANT de modéliser un effet en type/champ ad hoc → l'exprimer en `GameOp[]`.
                              Consommée par : sorts, Imparfaites (miscast), mutations, traits, qualités
                              (`passive`), effets déclenchés (`Flow`/`Trigger`), CONSOMMABLES. Jalon 2.6 :
                              PerSL (échelle par DR), onlyGroups, grantTrait/grantTalent/augmentWeapon/…
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
  combatFlow.ts               flux de combat tour par tour (IA, attaques, effets, fin de combat).
                              CONVENTION « baril » : les clusters FEUILLES extraits sont des modules
                              séparés que combatFlow ré-exporte (`export * from './combatX'`) pour ne
                              pas casser les importeurs — un module feuille n'importe RIEN de combatFlow
                              (tout passe par get().xxx / modules feuilles). Déjà sortis : combatGeometry.ts
                              (géométrie pure) et combatEffects.ts (effets de scène/campagne : applyEffects,
                              butin attribuable, checkTriggers, pushReveal). NE PAS extraire le preview
                              (previewAttack/Defense) : il partage attackEnv/bestDefenseMode avec la
                              résolution → cycle. La cohésion preview↔résolution est voulue.
  rollFlowFactory.ts / rollFlowSpecs.ts  FABRIQUE générique des flux de jet différé (« une situation = une modale ») +
                              specs des flux (attack/defense/cast/disengage/trample/run/focus/psych/
                              frenzy/approach/test/heal + reload/recover/activity/corruption/appraise/
                              bargain) — un nouveau jet = 1 spec + 1 xConfirm. Résilience « Je ne
                              faillirai pas ! » (LDB 17 l.73, GLOBALE) : mécanisme UNIQUE (factory
                              `forceSuccess`/`setForcedRoll` + UI `ForcedRollPicker`). Un flux qui
                              l'offre déclare `caps: { forced: true }` ; son `resolve(s,p,actor,get,
                              forced?)` porte alors LES TROIS cas dans UN seul résolveur : `forced`
                              absent = jet normal (RNG) ; `{}` = `forceSuccess` (dé par défaut : 01→DR
                              max, ou opposé→jet courant forcé à ≥ DR+1) ; `{ roll }` = `setForcedRoll`
                              (dé choisi, doit rester une réussite). PLUS de dérives `force`/`forceRoll`
                              séparées (l'ancien « code dérivé ») — la résolution forcée VIT dans le
                              résolveur du Test, à côté du jet normal. La localisation suit le dé inversé
                              (attaque LDB 13 l.142, Projectile magique LDB 46 l.156) : choisir le dé la
                              re-dérive — il n'y a PAS de « coup ciblé » libre pour un Projectile (RAW).
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
  RollShell.tsx               coquille PARTAGÉE et UNIQUE des modales de jet (mono, opposé, ou N
                              contributeurs — le mono = N=1) : Lancer→Chance→Pacte→Résilience→Appliquer
                              + frisson + pickers (dé forcé `caps.picker` / localisation du Critique) +
                              <Dice>. TOUTE modale de jet la PARAMÈTRE : contrôles en props, métier en
                              slots (setup/preInfluence/postRollExtra/forcedExtra) — cf. les hooks
                              `jetProps/*` (ex. useDefenseJetProps) ; aucune mécanique générique
                              réécrite par modale. (Désengagement : pré-jet = MENU d'options via
                              <OptionChooser>, pas un « preview + Lancer » ; le coup dans le dos de
                              « Fuir » est montré INLINE dans la modale, plus de popin RevealModal.)
  editor/                     Éditeur v2 : Editor.tsx (shell), editorState.ts (sélection unifiée +
                              mutations PURES), EditorCanvas (pointeur/overlays/resize), Palette (rail
                              d'outils + contenu contextuel), Inspector (DOCKÉ, folds ; scène si rien
                              de sélectionné), LogicDock (triggers/dialogues/rencontres/validation en
                              master-détail, édition live), EffectList (rangées repliées + picker),
                              useSceneHistory (undo/redo), useEditorView (caméra)
src/scenes/                 Documents de scène + campaign.ts (campagne = l'Arène, `arene/arene-projet.json`,
                            projet v2 {scenes, worldMap} — 20 scènes : Bourg+intérieurs, 13 zones, 3 expéditions,
                            embuscade ; AUTHORING par `scripts/arene/generate.mjs`, cartes ASCII → JSON canonique
                            qui RESTE la source éditable dans l'éditeur)
                            + test-fixture.ts (scène neutre `testScene` + rencontre `enc-mutants` des tests de combat)
src/state/asciiMap.ts       AUTHORING de map en ASCII — la MÉTHODE À PRIVILÉGIER pour tout contenu de
                            map (scène/scénario) plutôt que poser les tuiles une à une. `parseAsciiRows(rows,
                            base, legend)` → {w,h,tiles} (1 char = 1 tuile) ; `parseWalledAscii` (box-drawing
                            (2W+1)×(2H+1) : tuiles + MURS d'arête, `:` = porte). Légende de base : `#`mur
                            `~`eau `D`porte `_`fosse `=`planches (surchargeable). Garde-fou : lignes de
                            largeurs inégales / char inconnu → throw. Entités/props/départ : poser des
                            MARQUEURS custom dans l'ASCII (ex. `@BFLr`), nettoyer avant le parse (`replace`)
                            puis scanner leurs positions.
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
- **Éditeur v2** (juin 2026, interface refaite de 0) : iso WYSIWYG, rail d'outils + contenu
  contextuel (pose directe depuis les catalogues), inspecteur DOCKÉ (plus aucune modale d'édition),
  panneau Logique en bas (triggers/dialogues/rencontres/validation, master-détail, édition live →
  undo global), points d'entrée ⚑ et zones de repos dessinés sur la carte, resize à la poignée,
  barre de statut. Bouton « Tester » lance la scène en jeu.
- **Passifs unifiés + corruption data-driven** (réf. **`docs/systeme-passifs.md`**) : tout modificateur
  PASSIF continu (trait/mutation/qualité/trauma/maladie/faim/sort) = une liste de `GameOp` lue par UN
  collecteur `passiveMods(c)` (`engine/trauma.ts`), emballée en `PassiveMod{op, kind}` — le `kind` porte
  l'annulation ET la combinaison (`intrinsèque` = Σ dans la base / autres = pool non-cumul). `charMod` =
  SEUL op de modif de carac (passif ET sort) ; `moveMod` pour le Mouvement (≠ carac : `M` ∉ `CharKey`).
  Traits de profil appliqués `spawn→live` (`Combatant.liveTraits` + `baseWithTraits`, sans double-compte
  du profil bestiaire imprimé FINAL). **Édité en DONNÉES au Codex** : `TraitData`/`QualityData`/`Mutation`
  ont `passive: GameOp[]`, édité par le `<GameOpEditor>` EXISTANT (comme un sort — NE PAS réinventer de
  widget de liste d'ops). **Mutation découplée de sa table** : `mutations.json` (entités) ⊥
  `mutationTables.json` (plages d100 → réf mutation) → plusieurs tables (une par dieu du Chaos, Compagnon T1)
  sans collision. L'APPARENCE d'une mutation (cornes/peau…) reste couche **rig** (≠ GameOp).

## Primitives partagées (RÉUTILISER — ne JAMAIS réécrire à la main)

Source UNIQUE de motifs récurrents. **Avant d'écrire un segmented control, une paire de boutons de
choix, une rangée d'influence, un calcul « base + mods », un onglet, un lookup de table d100, ou une
recherche de combattant par id : utiliser la primitive ci-dessous.** Chaque ajout d'option/bouton se
fait DANS la primitive, pas dans une nième copie.

| Besoin | Primitive (source unique) | Fichier |
|---|---|---|
| Modale de jet (Lancer→Chance→Pacte→Résilience→Appliquer) | `RollShell` (props=contrôles, slots=métier) | `src/ui/RollShell.tsx` |
| Modale de jet **MULTI** (N contributeurs, influence PAR participant, coop) — *réflexe avant toute « 2e modale multi-jets »* | la MÊME coquille `RollShell` (le **mono = N=1** : plusieurs `RollRow`) + `makeRollFlow` mode `spec.multi` (`RollParticipant` `interactive`/témoin) ; ex. `ForceDoorModal`/Manœuvre | `src/ui/RollShell.tsx`, `src/ui/RollRow.tsx`, `src/state/rollFlowFactory.ts` |
| Choix d'**options de jet** (Parade/Esquive, menu de désengagement, Calme/Résistance) | `OptionChooser` (`seg`/`grid`/`actions`) | `src/ui/OptionChooser.tsx` |
| Paire/triplet de **boutons de décision** (Renoncer, Destin, Piège à lame…) | `ChoiceButtons` (= `OptionChooser layout='actions'`) | `src/ui/OptionChooser.tsx` |
| Valeur effective d'une option (`base + mods` plafonné) | `optionValue` | `src/ui/breakdown.ts` |
| Ligne pré-jet `{ label, base, mods }` | `optionPending` / `testPending` | `src/ui/breakdown.ts` |
| Rangée « influencer le jet » (Chance/Pacte/Résilience/Détermination) | `InfluenceRow` (+ `ResilienceButton`/`DeterminationButton`) | `src/ui/InfluenceRow.tsx` |
| En-tête A→B d'une modale de combat | `VsHeader` | `src/ui/VsHeader.tsx` |
| Affichage d'un personnage (HUD/modale/picker) | `PortraitTile` / `CharFrame` | `src/ui/PortraitTile.tsx` |
| Lookup d'une table d100 par fourchette `[min,max]` | `findTableEntry` | `src/engine/tables.ts` |
| Modificateurs de combat « brut » (Avantage×10 + État) | `baseTestMods` | `src/engine/combat.ts` |
| Libellé d'attaque gratuite de créature (`freeKind`) | `FREE_ATTACK_LABEL` | `src/engine/combat.ts` |
| Combattant par id (combat ou groupe) | `actorIn` / `inBattle` | `src/state/combatOrParty.ts` |
| **Tout EFFET mécanique** (soin, État, octroi, dégâts, corruption…) — *réflexe avant tout type ad hoc* | **`GameOp[]`** exécuté par `applyOps(target, ops, ctx)` (`ctx.caster` = référent des `Formula`) | `src/engine/ops.ts` |
| Éditer une **liste de `GameOp[]`** (sorts, effets déclenchés, **PASSIFS** de trait/mutation/qualité, **consommables**) | `GameOpEditor` (liste) — repris par `EffectList`/`FlowEditor` | `src/ui/editor/GameOpEditor.tsx` |
| Modificateur **PASSIF** d'un élément (trait/mutation/qualité/trauma/maladie/faim/sort) | `passiveMods(c)` collecteur UNIQUE + `passive: GameOp[]` en donnée | `src/engine/trauma.ts` |
| Effet **DÉCLENCHÉ** (`effects: TriggeredEffect[]`) d'une entité, pour un Trigger — *réflexe avant tout chemin par-kind* | **`fireTriggers(get, actor, trigger, ctx)`** DISPATCHER UNIQUE : réunit Traits + Talents + Atouts + **États** (par composition : Maladies/Mutations octroient Trait/État). Ajouter une source = l'ajouter ICI, JAMAIS un dispatch parallèle | `src/state/triggeredEffects.ts` |
| Attaque GRATUITE déclenchée (`grantFreeAttack` : Frappe réactive/Assaut féroce, et tout Trait/État) | `resolveFreeAttacks` (itère `freeAttackSourcesOf`, filtre `flowHasFreeAttack`) — kind-agnostique | `src/state/combatFlow.ts` |

> **Frontière orchestrateur · machinerie · data-driven** (cf. `docs/combat-events-coherence.md` §3bis) : un
> Trigger doit fonctionner pour TOUT kind d'entité (maladie/talent/trait/sort/état/mutation) **sans code
> spécifique**. Données = `effects`/`passive` sur l'entité, dispatchées par `fireTriggers` (UNIQUE). Machinerie
> = hooks `registerCombatHook` (règles universelles de l'arène, ne nomment AUCUNE entité). « Difficile à
> exprimer » n'autorise JAMAIS la machinerie → on étend le vocabulaire (`GameOp`/`Formula`/`Condition`).

> Pistes ÉVALUÉES puis ÉCARTÉES (sites trop divergents pour une source unique propre — ne pas
> « globaliser » de force) : `confirmPending` (les `xConfirm` divergent par leur garde de résultat et
> réutilisent `battle` localement → un wrapper ne raccourcit rien), `<Tabs>` (3 systèmes de classes
> distincts + LogicDock replie un dock / MerchantPanel = boutons non mappés), `useMasterDetail`
> (marchand ⇄ carte divergent après sélection), `<StatChip>`/`itemStatParts` (3 formes de données
> différentes : chaîne d'`ItemInstance`, `Combatant.weapons` résolues, table par famille). Le sweep
> `actorIn` dans `store.ts` est aussi écarté : `battle` y reste en portée pour le `set` final.

## Workflows multi-agents (sur opt-in « ultracode »)

Bons pour la **donnée/extraction/vérification**, pas l'art à l'aveugle. Déjà utilisés :
audit de fidélité des règles (a trouvé 3 vrais bugs), extraction du Tome 1 en dossiers,
génération des sprites de bestiaire depuis l'art officiel (lecture d'image par les agents).
Prochain candidat : **sprites de carrières** (réfs prêtes dans `art-ref/ldb/mapping.json`).

## Pièges connus

- **Closure synchrone en test Playwright** : cliquer un bouton qui change un état React PUIS
  agir dans le MÊME `evaluate` lit l'ANCIEN état (React n'a pas re-rendu). Séparer en deux
  appels, ou utiliser un `ref` côté composant pour la logique de drag.
- `src/data/*.json` sont la SOURCE app-owned commitée (rien à régénérer après un `git clone` — la
  migration `build:data` depuis `Source/all-data.json` a été retirée car elle écrasait les données curées).
- Il n'y a PLUS d'inventaire de GROUPE (`store.inventory`/`giveItem` supprimés) : tout objet va
  sur un héros (`Combatant.items`) via `giveTrapping` (réel ou custom). Butin d'équipement
  attribuable par portrait à l'écran de victoire (`pendingVictory.gear`).
