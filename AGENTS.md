<!-- GENERATED: agents:sync; source=CLAUDE.md -->
# AGENTS.md — RPG Warhammer Fantasy v4 (web)

Guide pour Codex sur ce dépôt. Le **credo de travail**
(`.codex/credo.md`, injecté à chaque session par hook) prime sur tout réflexe : zéro dette,
réutiliser l'existant, data-driven, ne rien croire sans vérifier le RAW.

## Ce qu'est ce projet

Un **jeu de rôle vidéoludique 100 % web, en français**, type *Neverwinter Nights / Baldur's
Gate* (tactique tour par tour, vue isométrique), basé sur **Warhammer Fantasy Roleplay 4e**.
On contrôle un groupe de 4 aventuriers à travers la campagne **L'Ennemi Intérieur**.

> ⚠️ **Ce dossier `Foundry/Game` EST un vrai projet logiciel** (dépôt GitHub `cgauche/game`).
> Le `Foundry/AGENTS.md` parent (« ceci n'est pas un projet logiciel, ne pas committer »)
> **ne s'applique PAS ici**. Ici : commits + push attendus (remote `origin` = cgauche/game).
> Branche de travail : `main` (trunk-based — le tronc reçoit tout ; une branche ne se crée que
> pour du travail risqué et isolable, et fusionne le JOUR MÊME en fast-forward).

> **Mémoire persistante committée** : `.claude/memory/` (index `MEMORY.md` + fiches). En session
> LOCALE le harness l'injecte déjà (junction depuis `~/.codex/projects/…/memory`) — ne pas la
> relire. En **session cloud** (Codex cloud), rien n'est injecté : LIRE `.claude/memory/MEMORY.md`
> en début de session et suivre ses liens au besoin ; les écritures mémoire faites en cloud ne
> persistent pas (VM jetable) — toute leçon durable apprise en cloud se consigne dans une fiche
> committée. Les fiches se committent comme du code ; jamais de git destructif dessus (c'est la
> mémoire vivante de la session locale).

## Table de routage — lire le bon doc AU MOMENT du déclencheur

| Déclencheur | Lire |
|---|---|
| Chercher où vit un module / comprendre un système / AVANT de créer un fichier sous `src/` | `docs/architecture.md` + table « Primitives partagées » ci-dessous |
| Quels systèmes existent / qui compose quoi (matrice primitives × systèmes GÉNÉRÉE) | `docs/systemes.md` (`npm run docs:systemes`, sources `src/data/systemes.manifest.json` + `src/data/primitives.manifest.json`) |
| **« Est-ce que le moteur sait faire X ? »** — chercher une op / une Condition / un déclencheur AVANT de conclure à un manque et de figer une donnée en « narratif » | `docs/vocabulaire-mecanique.md` (GÉNÉRÉ, `npm run docs:vocabulaire` — `GameOp` + `Condition`/`Flow`/`EffectTrigger`, index par concept FR, résolution & usages mesurés) |
| **« Existe-t-il une couture qui fait X ? »** — chercher où vit la fonction qui fait X (nom anglais inconnu), ce qui lit/produit Y, AVANT de conclure à une absence | `docs/index-moteur.md` (GÉNÉRÉ, `npm run docs:index-moteur` — 1825 exports publics de `src/engine`, `fichier:ligne` + JSDoc, index par concept FR) |
| Question RAW (« que dit la règle ? ») | Atlas `docs/raw/00-index.md`, puis `Source/` pour **citer** |
| Détail d'un livre source (chapitres LDB, périmètres autorisés, historique d'extraction) | `docs/sources-vf.md` |
| Valider une feature UI dans le navigateur (`__wfrp`, scénarios de test) | `docs/recette-navigateur.md` + `docs/test-scenarios.md` |
| Toucher un passif / la corruption | `docs/systeme-passifs.md` |
| Toucher les triggers / événements de combat | `docs/combat-events-coherence.md` |
| Ajouter une créature (rig) | `docs/creer-une-creature.md` |
| Ajouter/curer une donnée dans `src/data/*.json` (hors sort/créature/effet/icône) | `docs/donnees.md` (carte + conventions) + skill `ajouter-une-donnee` |
| Authoring de map | `docs/map-authoring.md` |
| Créer/modifier une campagne (projet multi-scènes + carte du monde) | `docs/campagne-authoring.md` + skill `creer-une-campagne` |
| Créer ou retoucher un écran UI (CSS, densité, responsive) | `docs/charte-ui.md` + règle stricte 4 |
| Ajouter un flux de jet différé (une situation = une modale — Piétinement, Course, Focalisation, Soin, Marchandage…) | `docs/ajouter-un-flux-de-jet.md` |
| Intégrer un nouveau livre source VF au projet (pipeline complet) | `docs/ajouter-un-livre-source.md` |
| Ajouter ou curer un sort / une Prière / une Bénédiction / un Miracle | `docs/ajouter-un-sort.md` |
| Ajouter une icône (ou remplacer un emoji par une affordance UI) | `docs/ajouter-une-icone.md` |
| Ajouter une mécanique à une entité (trait, talent, qualité, mutation, maladie, atout…) | `docs/ajouter-une-mecanique.md` |
| Le Codex doit-il exposer une nouvelle relation inverse / un nouvel index / un auto-liage ? | `docs/codex-relations.md` |
| Quel code lit ce champ JSON, avant de le renommer ou de le supprimer ? | `docs/consommateurs-de-champs.md` (GÉNÉRÉ, `npm run docs:field-consumers`) |
| Une entrée de `src/data/*.json` est-elle orpheline (jamais référencée) ? | `docs/orphelines-donnees.md` (GÉNÉRÉ, `npm run docs:orphelines`) |
| Un sprite/rig est-il reconnaissable au premier coup d'œil (QC) ? | `docs/qc-reconnaissabilite-sprites.md` |
| Reprendre un chantier après une pause (nouvelle machine, clone frais) | `docs/reprise-apres-pause.md` |
| Quel est l'état RÉEL d'implémentation des sorts/miracles (écart catalogue vs code) ? | `docs/sorts-implementation.md` (GÉNÉRÉ, `npx tsx scripts/gen-sorts-doc.mts`) |

> **Politique `docs/`** : ce dossier ne contient que des **références vivantes**, maintenues au fil
> du code. Les plans de refonte / sorties de brainstorming sont des artefacts **DATÉS** : ils vont
> dans `docs/plans/`, portent leur date en tête, et sont **supprimés une fois exécutés** (git porte
> l'historique). Un plan périmé qui traîne à la racine de `docs/` est du poison : ne JAMAIS s'appuyer
> sur un doc de plan pour décider de l'architecture actuelle — le code et les références vivantes font foi.
> Garde `npm run docs:check` (`scripts/docs/check-doc-refs.mjs`) : chaque chemin `src/…`/`scripts/…` et
> chaque symbole backtiqué cités par `docs/*.md` (hors `docs/plans/` et `docs/raw/`) doivent exister —
> exit 1 avec la liste `fichier:ligne` sinon. Une référence vivante qui ment ne se tague pas, elle se corrige.

## Règles strictes (NE PAS déroger)

1. **Aucune invention de règles.** Toute règle/valeur vient des livres autorisés (§ Sources VF).
   Ne pas utiliser tes connaissances WFRP. **Point d'entrée = l'Atlas RAW [`docs/raw/`](docs/raw/00-index.md)** :
   22 fiches de règles par domaine + 6 catalogues de données mécaniques, consolidant les 15 livres
   (couverture **⬜0** ; gardes rejouables `node scripts/raw/coverage.mjs` & `node scripts/raw/reconcile.mjs`).
   **Y chercher d'abord** « est-ce RAW / que dit le RAW ». `Source/` reste la vérité
   **citable** (`LDB <chap> l.<ligne>`) et le recours ultime — **devoir rouvrir `Source/` = un défaut
   de l'Atlas à corriger** (amender la fiche/le catalogue, puis re-vérifier avec les deux gardes).
   ⚠ Les champs **`Implémente`** des fiches sont **GÉNÉRÉS** (`npm run raw:implemente`, #487/#434) —
   jamais édités à la main ; un commit qui ajoute/déplace des réfs RAW (code, commentaires, `source:{book,page}`
   de données) régénère les fiches dans le MÊME commit (`docs:check` le gate en CI et au pre-commit).
   Dette/blocage d'un topic = entrée `src/data/raw.manifest.json` (topic non implémenté sans entrée = CI rouge).
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
6. **Les commentaires ne font pas autorité — et trois familles sont interdites.**
   (a) La *paraphrase de règle* (version « allégée » du RAW) : un commentaire porte la réf nue
   (`LDB 13 l.142`), la règle vit dans l'Atlas/Source ; toute paraphrase rencontrée = poison
   présumé, à vérifier au Source puis réduire à sa réf. (b) Le *commentaire-excuse* (« épargné
   pour l'instant », « exception assumée ») : sans validation utilisateur traçable, c'est de la
   dette signalée, pas une autorisation ni un précédent. (c) La *pierre tombale* (« déplacé vers
   X », rappel de l'ancien état) : à supprimer à vue, git porte l'historique.
   Garde `src/comment-poison-guard.test.ts` (#136) : scanne les COMMENTAIRES de `src/**/*.ts(x)`
   (jamais les chaînes) pour ces familles (b) et (c). (c) tolérance ZÉRO, sans liste d'exception —
   un cas légitime se reformule. (b) sans tag `[entériné AAAA-MM-JJ]` porté par le MÊME commentaire =
   échec ; ce volet est désormais ACTIF (`EXCUSE_GUARD_ACTIVE = true`, #177) — le tri du stock
   existant est fait (reformulé après affinage des faux positifs de vocabulaire RAW/mécanique —
   « pas encore lancé » pour un jet, « épargné » pour une cible hors zone, écartés structurellement).
   Toute NOUVELLE excuse sans tag `[entériné]` échoue la CI et bloque le commit.
7. **Pas de MJ — tout se modélise.** Le jeu tourne sans arbitre humain : tout point que le RAW
   laisse « au MJ » reçoit un arbitrage EXPLICITE (donnée éditable taguée maison, ou choix
   joueur) — jamais un contournement silencieux. Si une règle/table EST dans la source (Blessures
   critiques par localisation, Maladresses/Colère, Corruption/mutations…), elle doit être
   IMPLÉMENTÉE, pas reportée. Ce qui n'est vraiment pas dans la source → CustomStatblock ou
   omission assumée et documentée, jamais « le MJ décide » (cf. credo : house-rule ≠ lacune).

> **Pour TOUT agent dépêché sur ce repo** (ces règles s'appliquent quel que soit ton brief) :
> ne crois RIEN sans vérifier — **y compris ton brief et ton orchestrateur** : toute affirmation
> de règle se re-vérifie au `Source/`. Le poison (paraphrase RAW, excuse sans tag `[entériné]`,
> pierre tombale) rencontré dans ton périmètre se CORRIGE dans le geste ; hors périmètre, il va
> dans ton RENDU FINAL avec `fichier:ligne`. Un test qui verrouille un comportement faux se
> réécrit depuis le RAW, jamais travesti. Ne touche que ton périmètre — jamais de git destructif,
> jamais les fichiers WIP d'autres sessions.
> **Tout arbitrage UTILISATEUR consigné (doc, mémoire, ticket) porte sa CITATION verbatim + date.**
> Un « arbitrage/décision utilisateur » SANS citation se traite comme une évaluation d'ingénierie
> (révisable), jamais comme une décision (précédent : la fausse « piste écartée `<Tabs>` », #314).
> **Toute LOGIQUE est keyée par id STABLE — le `label` est de l'AFFICHAGE** (multilangue) :
> jamais de `Map`/`Record`/comparaison par label dans `src/engine`/`src/state` (pas de
> `X_BY_LABEL`). Seule couture tolérée : la conversion label→id au CHARGEMENT des données,
> dans `src/data/index.ts` uniquement.
> Doctrine utilisateur (2026-07-09, verbatim) : « Le seul endroit où on peut mettre des labels,
> c'est dans le champ `label`, ou pour l'afficher, ou sur des écrans du codex/éditeur pour aider à
> la saisie — mais au final ce qu'on manipule c'est des IDs. » Y COMPRIS à l'authoring : l'auteur
> écrit des ids ; les résolveurs (`scripts/*/lib.mjs`) VALIDENT (fail-fast), ils ne normalisent plus.

## Sources VF — l'essentiel

Tout est en **français** sous `Source/`, dossiers préfixés `Warhammer v4 - …` / `WH - V4 - …`.
Les dossiers SANS ce préfixe (Enemy Within…, Altdorf…) sont la **VO** du dépôt parent MJ —
**ne jamais les lire/citer ici**. Atlas `docs/raw/` = couche de lecture ; `Source/` = vérité
citable. ⚠ Ré-extraction Marker 2026-06-22 : le **chapitre** des réfs `l.<ligne>` reste juste,
la **ligne** a dérivé.

Livres de RÈGLES autorisés (chemins exacts, périmètres, chapitres clés : **`docs/sources-vf.md`**) :
**LDB** (livre de base) · **ADE I/II** (Archives de l'Empire) · **EDO/EDOC** (T1 + Compagnon) ·
**Middenheim** · **AA** (Aux Armes) · **ZI** (Zoo Impérial) · **MDG** (Mer des Griffes) ·
**ACE** (Altdorf, Annexe I) · **T2C** (Compagnon T2, navigation fluviale/personnalisation/maladies d'eau) ·
**NADAJ** (gnomes, jeux de taverne) · **VDM** (Les Vents de Magie : incantation révisée, sorts par domaine,
carrières de sorcier, artefacts, élémentaires/familiers) — chacun pour son périmètre. **Arbitrage 2026-07-10 : tout livre FR de
`Source/` peut fournir des règles** (même ~90 % scénario, il en porte souvent quelques-unes) — le périmètre
s'établit par PASSAGE, documenté dans `docs/sources-vf.md`, au MÊME standard : verbatim citable, réf
chap/ligne, extraction FR présente (sans extraction, pas de mécanique). `src/data/*.json` est la **SOURCE
app-owned** (commitée, éditable au Compendium), curée à la main, chaque entrée taguée à sa `source`.

## Pile technique

- **Vite + TypeScript + React** (UI). **Rendu isométrique en SVG React** (PAS Phaser).
- **Zustand** (store global). **Vitest** (tests du moteur). Le RNG est **seedable**
  (`makeRNG`) pour des tests déterministes et une future coop réseau.

## Commandes

```bash
npm install           # active le hook post-commit : "corrige #N" (ou fixes/closes/ferme #N) dans le message de commit ferme l'issue #N automatiquement
npm run dev          # serveur de dev (http://localhost:5173) — src/data/*.json est la SOURCE app-owned (commitée)
npm test             # tests Vitest du moteur
npm run typecheck    # tsc --noEmit
npm run galleries              # (re)génère toutes les galeries QC -> public/galeries.html (hub)
# package-lock.json : régénérer TOUJOURS avec npm 10 (`npx --yes npm@10.9.3 install --package-lock-only`) — npm 11 ampute les hoistées @emnapi/*, garde pre-commit #528

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

**Vérification** : après une feature UI, valider dans le navigateur — flux complet dans
**`docs/recette-navigateur.md`** (outils `window.__wfrp`, scénarios de test, piège closure-sync).

## Architecture — carte rapide

```
src/engine/   règles WFRP4 PURES + testées (types, tests/DR, combat, ops.ts = GameOp, magic, corruption…)
src/state/    store Zustand + flux (combatFlow barils, rollFlowFactory/Specs, scene.ts = SCHÉMA, upkeep…)
src/gameIso/  rendu iso SVG (iso.ts projection, rig/ gabarits corporels, pickBackend, IsoStage, fx/)
src/ui/       React (RollShell, OptionChooser, editor/ v2, creator/, compendium/)
src/data/     base APP-OWNED (JSON commité, éditable au Compendium) + exceptions manuscrites sourcées
src/scenes/   documents de scène + campagne Arène (arene-projet.json) ; asciiMap.ts = authoring ASCII
src/net/      coop relay WS (client) · server/ = Worker Cloudflare · art-ref/ = illustrations (gitignoré)
```

Rôle détaillé de chaque module, conventions (baril combatFlow, résolution forcée, GameOp…) et
état courant des systèmes : **`docs/architecture.md`**.

## Primitives partagées (RÉUTILISER — ne JAMAIS réécrire à la main)

Source UNIQUE de motifs récurrents. **Avant d'écrire un segmented control, une paire de boutons de
choix, une rangée d'influence, un calcul « base + mods », un onglet, un lookup de table d100, ou une
recherche de combattant par id : utiliser la primitive ci-dessous.** Chaque ajout d'option/bouton se
fait DANS la primitive, pas dans une nième copie.

| Besoin | Primitive (source unique) | Fichier |
|---|---|---|
| Coquille d'**écran plein-champ** (carte du monde, port/escale, marché, dossier de navire, négoce) — voile + en-tête (titre/actions/fermeture) + corps, a11y de dialogue, barre d'outils `.screen-toolbar` optionnelle (y poser `<Tabs>`), prop `body` (`'full'` canevas / `'centered'` panneaux borné-960px) + slot `backdrop` (bande d'ambiance) | `ScreenShell` (jamais recopier `.worldmap-overlay`/`.worldmap-head`/`.port-body`) | `src/ui/ScreenShell.tsx` |
| **Menu** (menu PRINCIPAL hors partie ET menu SYSTÈME plein écran/pause EN jeu, ses sous-écrans Coopération/Options compris) : carte + sections de grands boutons pleine largeur icône+libellé + séparateurs titrés + interrupteur de menu — *réflexe avant tout `.menu-card` ou `<button className="btn">` de menu recodé* | `MenuCard` (+ `MenuSection`/`MenuButton`/`MenuToggle`) | `src/ui/MenuCard.tsx` |
| **Méta d'en-tête** date+bourse `{time?, money?}` (`.hud-clock` + `.port-purse`) — partagée en-tête d'écran plein-champ ET en-tête du menu système (date seule, sans bourse) | `ScreenMeta` (composée par `ScreenShell` et `GameMenu`) | `src/ui/ScreenMeta.tsx` |
| **Onglets** (fiche, écran plein-champ, dock repliable, sous-onglets) — *réflexe avant tout `role="tablist"` recodé* | `Tabs` (`variant` : `flat`/`pill`/`sub`/`dock`) — role=tablist/tab, `aria-selected`, roving tabindex (flèches/Home/End) | `src/ui/Tabs.tsx`, `src/ui/styles/tabs.css` |
| **Roving tabindex** (flèches + Home/End, selection-follows-focus — tablist/listbox/radiogroup) — *réflexe avant tout `onKeyDown` de navigation par flèches recodé* | `rovingKeyDown` (fonction PURE, aucun hook interne — le conteneur est une simple réf fournie par l'appelant ; couvre les sites HTML ET SVG) | `src/ui/rovingFocus.ts` |
| Modale de jet (Lancer→Chance→Pacte→Résilience→Appliquer) — la **proéminence** d'une action se DÉDUIT de sa `key` (rôle→style DANS RollShell : `cancel`/`break`/`ack`=ghost, reste=primary) ; les appelants ne portent PLUS de champ de style | `RollShell` (props=contrôles, slots=métier) | `src/ui/RollShell.tsx` |
| Modale de jet **MULTI** (N contributeurs, influence PAR participant, coop) — *réflexe avant toute « 2e modale multi-jets »* | la MÊME coquille `RollShell` (le **mono = N=1** : plusieurs `RollRow`) + `makeRollFlow` mode `spec.multi` (`RollParticipant` `interactive`/témoin) ; ex. `ForceDoorModal`/Manœuvre | `src/ui/RollShell.tsx`, `src/ui/RollRow.tsx`, `src/state/rollFlowFactory.ts` |
| Choix d'**options de jet** (Parade/Esquive, menu de désengagement, Calme/Résistance) | `OptionChooser` (`seg`/`grid`/`actions`) | `src/ui/OptionChooser.tsx` |
| Paire/triplet de **boutons de décision** (Renoncer, Destin, Piège à lame…) | `ChoiceButtons` (= `OptionChooser layout='actions'`) | `src/ui/OptionChooser.tsx` |
| Valeur effective d'une option (`base + mods` plafonné) | `optionValue` | `src/ui/breakdown.ts` |
| Ligne pré-jet `{ label, base, mods }` | `optionPending` / `testPending` | `src/ui/breakdown.ts` |
| Rangée « influencer le jet » (Chance/Pacte/Résilience/Détermination) | `InfluenceRow` (+ `ResilienceButton`/`DeterminationButton`) | `src/ui/InfluenceRow.tsx` |
| En-tête A→B d'une modale de combat | `VsHeader` | `src/ui/VsHeader.tsx` |
| Affichage d'un personnage (HUD/modale/picker) | `PortraitTile` / `CharFrame` | `src/ui/PortraitTile.tsx` |
| **Barre de remplissage LISSE** (vie du portrait, Blessures/Encombrement de la colonne de fiche) — ton par PALIER (`tone`) OU teinte CONTINUE (`color`, ex. `hpColor`), variante `overlay` (superposée, portraits compacts), état de DÉPASSEMENT explicite (`value > max` : piste pleine + surplus + valeur en gras danger) — *réflexe avant toute jauge crantée réutilisée pour une VRAIE barre de vie* | `LifeBar` (jamais `NotchGauge`, réservée aux ressources à PALIERS DISCRETS — Coque/Moral/Soute) | `src/ui/LifeBar.tsx` |
| Champ de **filtre/recherche** de liste (catalogue, palette, sélecteur) — état + filtre pur | `SearchFilterField` (widget) + `useFilteredList`/`filterByLabel` (état/pur) | `src/ui/SearchFilterField.tsx` |
| **Maître-détail** (liste GAUCHE + détail CENTRE — Codex/Compendium ad hoc, palettes de l'éditeur, pickers…) — *réflexe avant toute 2e composition liste+détail* | `MasterDetail` (gabarit de LAYOUT pur, slots `list`/`detail` : l'état de sélection reste chez l'appelant) | `src/ui/MasterDetail.tsx` |
| **Table de NÉGOCE** (colonnes de stats + prix `<Coins>` + action par rangée + groupes de rubrique — marchand, port, marché terrestre) — *réflexe avant tout tableau d'achat/vente recodé* | `TradeTable` (moissonnée de l'étalon `MerchantPanel`, #371 LOT 3) | `src/ui/TradeTable.tsx` |
| **Carte-parchemin narrative** (récit ponctuel adossé à un tirage : événement d'interlude, événement de bord en mer, révélation de scène) — *réflexe avant tout `.tx-parchment` + sceau recodé à la main* | `ParchmentCard` (`seal?` médaillon d100, `title?`, `tone?`, `children` — moissonnée de l'étalon `InterludeScreen`, #371 LOT 4) | `src/ui/ParchmentCard.tsx` |
| **Panneau d'Activité/Service** (en-tête icône+titre, corps DÉFILABLE, pied FIXE : pré-jet + coût `<Coins>` + action jamais cachés par le scroll) — *réflexe avant tout markup en-tête/corps/pied de volet recodé* | `ActivityPane` (slots génériques `desc`/`blocked`/`prejet`/`cost`/`note`/`actions`/`children` — moissonnée de l'étalon `InterludeScreen`, composée aussi par `CityHubScreen`, #371 LOT 5) | `src/ui/ActivityPane.tsx` |
| **Stepper de quantité** `[−][centre][+]` (panier, quantité en stock, baisse de prix par cran) | `QtyStepper` | `src/ui/QtyStepper.tsx` |
| Lookup d'une table d100 par fourchette `[min,max]` | `findTableEntry` | `src/engine/tables.ts` |
| Modificateurs de combat « brut » (Avantage×10 + État) | `baseTestMods` | `src/engine/combat.ts` |
| Libellé d'attaque gratuite de créature (`freeKind`) | `FREE_ATTACK_LABEL` | `src/engine/combat.ts` |
| Combattant par id — **combat ou groupe** (`actorIn`) vs **en combat seulement** (`inBattleId`) | `actorIn` / `inBattleId` | `src/state/combatOrParty.ts` |
| **Tout EFFET mécanique** (soin, État, octroi, dégâts, corruption…) — *réflexe avant tout type ad hoc*. **Le catalogue des 101 ops + des Conditions/Flow/Triggers est GÉNÉRÉ dans `docs/vocabulaire-mecanique.md`** (`npm run docs:vocabulaire`) : index par CONCEPT en français, résolution mesurée (une op « inerte dans applyOps » est NORMALE — impure ou passive, résolue ailleurs), usage réel en donnée. **Y chercher AVANT de conclure « aucune op ne fait X »** | **`GameOp[]`** exécuté par `applyOps(target, ops, ctx)` (`ctx.caster` = référent des `Formula`) | `src/engine/ops.ts` |
| Éditer une **liste de `GameOp[]`** (sorts, effets déclenchés, **PASSIFS** de trait/mutation/qualité, **consommables**) | `GameOpEditor` (liste) — repris par `EffectList`/`FlowEditor` | `src/ui/editor/GameOpEditor.tsx` |
| Rendu JOUEUR d'une liste de `GameOp[]` (passifs d'entité, effets de signe astral) — chips codex-liées + phrase humanisée, jamais le résumeur d'atelier `opSummary` | `GameOpChips` (vue) + `opRows` (structure, compendium) | `src/ui/GameOpChips.tsx` |
| Modificateur **PASSIF** d'un élément (trait/mutation/qualité/trauma/maladie/faim/sort) | `passiveMods(c)` collecteur UNIQUE + `passive: GameOp[]` en donnée | `src/engine/trauma.ts` |
| Effet **DÉCLENCHÉ** (`effects: TriggeredEffect[]`) d'une entité, pour un Trigger — *réflexe avant tout chemin par-kind* | **`fireTriggers(get, actor, trigger, ctx)`** DISPATCHER UNIQUE : réunit Traits + Talents + Atouts + **États** (par composition : Maladies/Mutations octroient Trait/État). Ajouter une source = l'ajouter ICI, JAMAIS un dispatch parallèle | `src/state/triggeredEffects.ts` |
| Attaque GRATUITE déclenchée (`grantFreeAttack` : Frappe réactive/Assaut féroce, et tout Trait/État) | `resolveFreeAttacks` (itère `freeAttackSourcesOf`, filtre `flowHasFreeAttack`) — kind-agnostique | `src/state/combatFlow.ts` |
| Dégâts/soin de **coque** (voyage fluvial/maritime) | `damageHull`/`healHull` routent `applyOps` ; `damageVesselHull`/`healVesselHull` (`seaVoyageFlow.ts`) enchaînent la persistance — SOURCE UNIQUE `state.vessel.wounds` | `src/state/shipDamage.ts` |
| **Suspendre/reprendre une CASCADE** quand un combat/une transition s'ouvre en plein vol (le slot `pendingCascade` = la cascade ACTIVE, unique) | `suspendActiveCascade` / `resumeSuspendedCascade` (pile persistée de cascades suspendues ; coutures universelles : ouverture de combat/transition de scène → suspend, teardown victoire/défaite → resume) — JAMAIS un checkpoint parallèle ni une purge | `src/state/cascade.ts` |
| **Cérémonie de tirage** du créateur (Race/Carrière/Caractéristiques/Signe astral) : attente→roulant→rendu, gain de PX en direct | `CreatorDice` (compose `Section`/`XpBadge`/`useRollFrisson`/`DiceRoll`) | `src/ui/creator/CreatorDice.tsx` |
| Aperçu « perso en pied » hors combat (roster, créateur, fiche, marchand) — rig réel, apparence bas niveau OU `hero` (Combatant) | `CharacterPreview` | `src/ui/CharacterPreview.tsx` |
| Bouton d'engagement dont l'indisponibilité porte sa RAISON en texte visible (a11y `aria-describedby`) | `GatedAction` | `src/ui/GatedAction.tsx` |
| **Rose des forces** (mini-radar gravé, N axes paramétrables — `axisScore`/`axesProfile`, `src/engine/axes.ts`) : glyphe 44px coin de figurine, médaillon 90×86, rendu plein 280×196 | `RoseAxes` | `src/ui/RoseAxes.tsx` |
| Chip statut métallisé Bronze/Argent/Or + échelon (dérivée de `parseStatus`) | `MetalStatus` | `src/ui/MetalStatus.tsx` |
| Sceau de cire (tête de mort, SVG) + plaque d'élu scellée | `WaxSeal` / `SealedPlaque` | `src/ui/WaxSeal.tsx` |
| Chemin d'évolution d'une carrière en médaillons de niveau (`levelsForCareer`) | `CareerPath` | `src/ui/CareerPath.tsx` |
| **Cadre-figurine UNIQUE** (#430/#431) — races, carrières, candidats : patron `.fam-tile` de la planche, une COLONNE (rivets d'or vissés, boîte-figurine à HAUTEUR FIXE sur sa lueur de sol, nom + compte DESSOUS), liseré or si sélectionné, sceau optionnel débordant. Taille de boîte par PROP `fig` (`compact` 104px / `big` 172px), jamais un fork ni une classe par écran ; AUCUNE ambiance `CharacterPreview` exposée (la tuile porte SA matière — une ambiance de plus y peint le 2e cadre) — *réflexe avant tout « cadre dans un cadre » (carte bordée + boîte d'aperçu bordée à l'intérieur)* | `FigTile` (compose `CharacterPreview` ; SEULE définition de `.fig-tile*` : `src/ui/styles/frames.css`) | `src/ui/FigTile.tsx` |
| **Présence PLEIN FORMAT** d'un héros hors combat (colonne aside de la fiche) — boîte-figurine `FigTile` en variante STATIQUE (`fig="hero"`, sans `onClick`/label : aucune sémantique de picker), rig 320px sur sa lueur de sol. Le CORPS de cette colonne est l'INDEX universel de la fiche (#492, arbitrage 2026-07-17) : prop `zoneBadges` — un badge PAR `HitLocation`, ancré anatomiquement (tête/bras/corps/jambes, positions posées UNE fois dans la primitive) — l'appelant fournit la donnée PAR zone (PA d'armure en Possessions, critiques/séquelles en État), jamais la position ; `onClick` présent = `<button>`, absent = `<span>` | `FigTile fig="hero"` (+ prop de zones ancrées, même primitive que la table ci-dessus, sans nouveau composant) | `src/ui/FigTile.tsx` |
| Grille de sélection en SECTIONS par famille/classe (roving tabindex, `role=listbox`) | `GroupedPickGrid` | `src/ui/GroupedPickGrid.tsx` |
| Cadre de détail de l'élue (nom + chips méta + rubriques + prose scrollable, sans slot d'actions) | `DetailFrame` | `src/ui/DetailFrame.tsx` |
| **Rangée-plaque** sombre à rivets d'or (registre de caractéristiques, rangées d'allocation : préfixe codex, nom en `--font-display`, méta centrale base/dés/steppers, valeur droite, états élu/roulant — matière `.c-plate` de la planche Atelier) — *réflexe avant toute rangée de registre recodée* | `PlaqueRow` (+ `PlaqueGrid` 2 colonnes ; styles `src/ui/styles/plaque-row.css`) | `src/ui/PlaqueRow.tsx` |
| **Gabarit d'ÉTAPE du créateur** (OSSATURE 2 zones : bande d'ACTION requise en tête — le choix de la voie, l'encrier `CreatorDice` — puis la zone de CHOIX, et la zone DESC = fiche de l'élue ou FICHE VIVANTE par défaut) — *réflexe avant tout écran-étape du créateur recodé ; le format est un SLOT, jamais une consigne de brief* | `CreatorStepFrame` (+ `StepHeader`/`Section`/`XpBadge` ; compose `MasterDetail` ; styles `src/ui/styles/creator-step.css` ; garde `creator/creator-ossature.test.tsx`) | `src/ui/creator/CreatorStepFrame.tsx` |
| **Bande titrée de rubrique** (barre bois/laiton, titre + compteur/jauge ancrés à droite, contenu dessous — plusieurs blocs d'un panneau : étapes du créateur, bandes de section du registre État de la fiche) — *réflexe avant tout bandeau de rubrique recodé* | `Band` (extraite du créateur #492 Lot 1c, primitive PARTAGÉE — plus aucune dépendance au gabarit d'étape) | `src/ui/Band.tsx`, `src/ui/styles/band.css` |
| **Corps de FICHE HÉROS** (bande d'en-tête figurine+identité+statut+rose `header` désactivable, Caractéristiques+dérivées, Forces seuillées, Compétences/Talents/Sorts-Miracles/Possessions en chips codex) — *réflexe avant toute Nᵉ fiche perso recodée* | `HeroSheet` (composé par `creator/CreatorSummary.tsx` et `PartyScreen.tsx`) | `src/ui/HeroSheet.tsx` |
| **Galerie design system IN-APP** (DEV) : référence de goût pérenne, chaque primitive montée VIVANTE avec des données réelles | `DesignGallery` (`MasterDetail`) | `src/ui/gallery/DesignGallery.tsx` |

> **Frontière orchestrateur · machinerie · data-driven** (cf. `docs/combat-events-coherence.md` §3bis) : un
> Trigger doit fonctionner pour TOUT kind d'entité (maladie/talent/trait/sort/état/mutation) **sans code
> spécifique**. Données = `effects`/`passive` sur l'entité, dispatchées par `fireTriggers` (UNIQUE). Machinerie
> = hooks `registerCombatHook` (règles universelles de l'arène, ne nomment AUCUNE entité). « Difficile à
> exprimer » n'autorise JAMAIS la machinerie → on étend le vocabulaire (`GameOp`/`Formula`/`Condition`).

> Pistes ÉVALUÉES puis ÉCARTÉES (sites trop divergents pour une source unique propre — ne pas
> « globaliser » de force) : `confirmPending` (les `xConfirm` divergent par leur garde de résultat et
> réutilisent `battle` localement → un wrapper ne raccourcit rien), `useMasterDetail` — le rejet
> portait sur le **HOOK D'ÉTAT** partagé (marchand ⇄ carte divergent après sélection) et reste
> valide ; le **GABARIT DE LAYOUT** (slots liste/détail, aucun état) en a été extrait en primitive
> sous #330 → voir `MasterDetail` dans la table ci-dessus (périmètre précisé 2026-07-11, le verdict
> d'origine ne portait que sur l'état) — `<StatChip>`/`itemStatParts` (3 formes de données
> différentes : chaîne d'`ItemInstance`, `Combatant.weapons` résolues, table par famille). Le sweep
> `actorIn` dans `store.ts` est aussi écarté : `battle` y reste en portée pour le `set` final.

## Workflows multi-agents (sur opt-in « ultracode »)

Bons pour la **donnée/extraction/vérification**, pas l'art à l'aveugle. Déjà utilisés :
audit de fidélité des règles (a trouvé 3 vrais bugs), extraction du Tome 1 en dossiers,
génération des sprites de bestiaire depuis l'art officiel (lecture d'image par les agents).

## Pièges connus

- **Closure synchrone en test Playwright** : détail dans `docs/recette-navigateur.md` — ne jamais
  lire le DOM dans le même `evaluate` que l'action qui change l'état React.
- `src/data/*.json` sont la SOURCE app-owned commitée : rien à régénérer après un `git clone`.
- Il n'y a PLUS d'inventaire de GROUPE (`store.inventory`/`giveItem` supprimés) : tout objet va
  sur un héros (`Combatant.items`) via `giveTrapping` (réel ou custom). Butin d'équipement
  attribuable par portrait à l'écran de victoire (`pendingVictory.gear`).
