> ⚠️ **ARCHIVE (2026-07-05)** — document DATÉ : constat/plan d'époque, ne décrit PAS l'état courant du code.
> Conservé pour l'historique du raisonnement. Ne JAMAIS s'appuyer dessus pour juger l'architecture ou l'état actuel.

# Dette technique, réductions de fidélité & lacunes de jouabilité/éditabilité

> Registre d'époque de ce qui n'était PAS conforme au standard (« suivre le RAW à 100 % **et**
> rendre tout scénarisable dans l'éditeur »). Le backlog actif vit dans les issues GitHub.
>
> Deux axes :
> - **A. Réductions de fidélité** — systèmes IMPLÉMENTÉS mais SIMPLIFIÉS vs le livre (le moteur ne suit
>   pas le RAW à 100 %).
> - **B. Lacunes jouabilité/éditabilité** — systèmes qui n'ont pas de scénario jouable au menu ET/OU ne
>   sont pas authorables depuis l'éditeur (issus de l'audit transversal des 75 systèmes).
>
> Le code lui-même ne porte AUCUN marqueur `TODO`/`FIXME` : tout ce qui est connu comme incomplet est ICI.

## Statut de conformité (référence rapide)

- Backlog GitHub d'audit de conformité : **39/39 issues fermées** (juillet 2026).
- Chantiers de fiabilisation post-backlog : combat de masse #69 (fidélité + éditabilité), combat naval
  (abordage), audit jouabilité/éditabilité — cf. sections ci-dessous.
- **Audit du fichier lui-même (2026-07-04)** : contre-échantillon RAW des claims chiffrés (AA l.2480/2523/4139/4418,
  MSRC ch.13 l.167) → tous fidèles au livre. Les entrées OUVERTES ci-dessous sont désormais suivies en **issues
  GitHub** (le fichier = index, l'issue = tracker). Nouvelles : **#87** hallucinogène/`perDegreeOfFailure` ·
  **#88** Battement/Distraire héros · **#89** réaction défensive N Avantages (Porte-bouclier AA) · **#90**
  améliorations navales non-plat · **#91** descente fluviale résidus · **#92** Avantage initial éditeur ·
  **#93** flags marchand + `openPort` · **#94** Effets santé éditables · **#95** poursuites terrestres ·
  **#96** scénarios santé Vague 1 · **#97** reliquats magie · **#98** `castSpell` (design) · **#99** rumeur
  cross-Lieu · **#100** purge branches `legacy`/rétro-compat (dette de code, hors périmètre historique de ce
  fichier). Pré-existantes : **#82** escalade · **#83** méta-flux + roster · **#84** filets ZI · **#85**
  équipage/désertion.

---

## A. Réductions de fidélité (implémenté mais simplifié vs RAW)

Chaque entrée : la règle RAW non entièrement suivie, ce qui est fait, ce qui manque pour être fidèle.

### Combat de masse (#69, ADE II ch.8)
- ~~**« Tenez votre position »**~~ ✅ **RÉSOLU** : Scène `kind:'hold'` data-driven (`hold: {breakpoint:10,
  maxRounds:5, enemyBonusPerHold:10}`, l.161-163) + résolveur PUR `resolveHoldRound`/`holdEnemyBonus` +
  état de Scène PERSISTANT générique (`MassBattleState.sceneState`). Chaque Round : Test OPPOSÉ (PJ vs jet
  ennemi figé = Puissance ennemie + bonus cumulatif de tenue) → le DR net de l'ennemi ACCUMULE le Point de
  rupture ; tenue (breakpoint < 10) = ennemi −2 + réimposition de la Scène + opposition +10 au Round
  suivant ; Point de rupture ≥ 10 OU 5 Rounds = déroute (plus de réimposition).
- ~~**« Percée »**~~ ✅ **RÉSOLU** : Scène `kind:'combat'` (startCombat générique, encounter `enc-percee`).
  Victoire (`combatWon`) → allié +10 ; DÉFAITE (`combatLost`) → Scène de Charge imposée au Round suivant.
  Le mécanisme `chains`+`when` sait déclencher sur une DÉFAITE de combat (`when:'combatLost'`, générique).
- ~~**Duel — le champion ALLIÉ perd → allié −20**~~ ✅ **RÉSOLU** : la défaite tactique d'une Scène de
  combat de bataille passe désormais par `dismissDefeat` (store) → `massBattleResumeCombat(..., 'lost')`
  (symétrique de la victoire), qui applique les effets `combatLost` (Duel : ally −20, l.223 « vaut dans les
  deux sens ») et FAIT CONTINUER la bataille (groupe repoussé mais relevé, pas d'écran de game-over).
- ~~**Activités de bataille — Tests combinés (l.79-110)**~~ ✅ **RÉSOLU** : Infiltration (Discrétion +
  Perception) & Repérage (Chevaucher + Perception) portent `combined:true` et réutilisent la primitive
  existante `evaluateCombinedTest` (un jet vs deux valeurs, LDB 12 l.229) — RÉUSSITE sur `full` (les deux),
  DR de palier = le plus faible des deux. Sabotage reste au CHOIX (« Discrétion OU Divertissement », RAW).
- **Aléa de bataille** : appliqué en narratif (option RAW l.309), pas mécanisé. HORS PÉRIMÈTRE.
- **Coût / Horreurs de la guerre** (options ADE II) : non modélisés. HORS PÉRIMÈTRE.

### Système alternatif Aux Armes — Blessures & Critiques (#38, sous toggle `combat-aa-blessures`)
- ~~**Variante +10/Blessure globale** d'Aux Armes~~ ⚪ **FAUX POSITIF** : le « +10 par Blessure » d'Aux
  Armes (AA l.2480 : « ajoutez +10 au résultat d'un jet de 1D100 par Blessure que vous infligez au-delà
  de celles nécessaires pour faire tomber l'ennemi à 0 Blessure ») EST déjà entièrement câblé, PAS hors
  périmètre. `aaCriticalOffset(overkill) = 10 × overkill` (`engine/aaCritical.ts` l.49-52) applique le
  décalage sur le jet de Critique AA ; `rollCritical` bifurque vers `resolveAACritical(…, overkill)` sous
  `combat-aa-blessures==='aa'` (l.105) ; `overkill` = `res.woundsLost − PB courants` est calculé et passé
  à CHAQUE site de résolution (`applyCriticalToTarget`, mêlée & magie). Testé : `aa-critical.test.ts`
  (`aaCriticalOffset(8)===80`, l'exemple canon l.2498 ; le décalage pousse vers la ligne LÉTALE) +
  `aa-critical-wiring.test.ts` (bout en bout). L'ancien libellé « +10/Blessure globale » était un
  malnom : la variante N'EST PAS un +10 aux Dégâts par palier, c'est CE décalage-là. Rien à câbler.

### Avantage de groupe Aux Armes (#39, sous toggle `combat-aa-avantage-groupe`)
- ~~**Dépenses d'Avantage en mode groupe**~~ ✅ **RÉSOLU** : TOUTE dépense d'Avantage passe par le point
  UNIQUE `campSpend(get, c, n)` (symétrique de `campGain`) — débite la RÉSERVE du camp en mode groupe,
  l'Avantage individuel en LDB. Routés : manœuvres de créature (`resolveManeuver`), Piétinement (joueur +
  IA), attaques gratuites de créature (mêlée + op `grantFreeAttack`), coût de Flow `choice.cost.advantage`
  (Déstabilisante — joueur + IA), Rage (dépense TOUT). La **Retraite stratégique** (Désengagement) débite
  aussi la réserve : coût FIXE 2 Avantages (AA l.4139), abaissé à 1 par *Impitoyable* (AA l.4418).
- ~~**Empoignade opposée**~~ ✅ **RÉSOLU** : `resolveGrappleOpposed(get, …)` crédite le +1 du vainqueur via
  `campGain` → réserve du camp en mode groupe (plus per-combattant).
- **Op `gainAdvantage`/`spendAdvantage` hors début de tour** : `reconcileAdvantageToPool` est désormais
  BIDIRECTIONNEL (relève ET abaisse la réserve selon l'écart projection↔réserve), mais reste appelé UNIQUEMENT
  au turn-start (Redoutable). Aucune donnée n'émet ces ops ailleurs qu'au turn-start aujourd'hui (`gainAdvantage`
  = Redoutable seul ; `spendAdvantage` op = inutilisé — Déstabilisante passe par le coût de Flow, routé). Si un
  futur sort/effet émet un de ces ops MID-combat, ajouter un `reconcileAdvantageToPool(get, cible)` à CE site.
- **Table d'Avantage initial** : auto-dérive Surnombre + Surprise ; Menace / Manœuvrabilité / Terrain
  attendent une entrée d'éditeur (la fonction les supporte, testée).
- **Talents en mode groupe** :
  - ~~*Cavalier émérite*~~ ✅ **RÉSOLU** (AA l.4369) : `fearSourceFor(self, foe, selfSizeForSize?)` prend une
    Taille effective ; `riderFearSize(battle, self)` la fournit = Taille de la MONTURE quand le porteur monté a
    le Talent (mode groupe). Seul le versant **Taille** est immunisé — un `causesPeur`/`causesTerreur` de statbloc
    (démon/mort-vivant) fait toujours peur (RAW « uniquement par la Taille »).
  - ~~*Impitoyable*~~ ✅ **RÉSOLU** : LDB (l.591) modélisé — garde niveau Avantages au Sacrifice + Désengagement
    possible sans supériorité stricte ; AA (l.4418) — coût de Retraite stratégique = 1.
  - ~~*Battement*~~ ✅ **RÉSOLU** (effet) : `resolveBattement` retire de l'Avantage adverse — LDB « −1, −1 par DR »
    (Avantage individuel du foe) ; AA « −1, +1 à 6 DR » (réserve du camp adverse). Wiring IA fait (un PNJ porteur,
    Engagé, l'utilise quand l'adversaire a de l'Avantage à retirer). **RÉDUIT** : pas d'affordance HÉROS interactive
    (déclaration + jet influençable en modale) — chantier UI dédié ; le héros porteur ne peut pas la déclarer.
  - ~~*Distraire*~~ ✅ **RÉSOLU** (effet) : `resolveDistraire` (Test opposé Athlétisme/Calme) pose `distractedRounds`
    → `campGain` refuse tout gain d'Avantage du distrait jusqu'à la fin du prochain Round (décrémenté au
    franchissement). Wiring IA fait. **RÉDUIT** : idem Battement — pas d'affordance HÉROS interactive.
  - **Porte-bouclier (variante AA active)** : la capacité AA l.4428 (dépenser 2 Avantages pour infliger des Dégâts
    en défense OU repousser 2 m et se désengager, 1×/Round au bouclier) n'est PAS câblée (aucune réaction de
    défense active correspondante n'existe) → `descAA` seul. Le GAIN LDB de *Porte-Bouclier* (`shieldAdvantage`)
    reste géré et est neutralisé en mode groupe par la variante AA (`shieldAdvantageLevel`→0). Chantier : une
    réaction défensive « dépenser N Avantages de la réserve pour un effet » (nouvelle brique de défense).

### Économie (#57)
- ~~**Recherche active de Disponibilité « journée entière + Ragot »**~~ ✅ **RÉSOLU** (LDB 59 l.50 :
  « Les pourcentages de Disponibilité peuvent être augmentés de +10 % ou +20 % si un Personnage […]
  passe une journée entière à effectuer des achats et des Tests de Ragot ») : action `searchAvailability`
  au marchand (bouton « 🔎 Chercher activement (1 journée) » dans l'onglet Acheter). Elle consacre UNE
  JOURNÉE (`advanceTime(MINUTES_PER_DAY)` → cascade #T3), jette un Test de Ragot du groupe
  (`partyAssisted(party,'ragot','Soc')` + `rollTest`, Soutien LDB 12) et, sur un succès, tire un RÉASSORT
  FRAIS avec `gossipDay:true` → `availabilitySearchBonus` ajoute +10 % (cumulable avec la Carrière
  cohérente Marchand/Receleur déjà câblée, jusqu'au plafond +20 %). Réutilise le tirage de stock EXISTANT
  (helper `rollFreshStock`, partagé avec `openMerchant`) + l'horloge + `engine/disponibilite`. No-op en
  marché simplifié (`market-mode` sans Test de Disponibilité). Testé : `search-availability.test.ts`
  (journée avancée, réassort distinct succès≠échec, no-op simplifié).

### Commerce de cargaison terrestre MSRC (#58)
- **Rumeur commerciale cross-Lieu** : adaptée au Lieu courant ; la version « ce bien se vend le double
  à tel AUTRE port » (index géographique du Reikland) reste une feature de scénario future (nécessite
  un index géographique mappé à la carte + un board de rumeurs persistant).

### Compagnon de Mort sur le Reik (MSRC) — apports au-delà du commerce
- ~~**Navigation fluviale (ch.5)**~~ ✅ **RÉSOLU** (commit caa98539) : descente jouée jour par jour (Test de
  Navigation Voile/Ramer par étape, Savoir Voies fluviales +1 DR, Agilité de rame, vents, chavirage/naufrage
  en BE tours, périls Débris/Barrage/Rochers/Bas-fonds), réutilise la machinerie navale, câblée sur le Reik.
  Résidus : présentation inline (pas de modale par jet) ; **Force de renflouage à l'échouage** ✅ chiffrée
  (malus = Enc PROPRE du bateau, `VehicleData.enc`, converti en cran de difficulté — actif pour tout bateau à
  Enc chiffré, ex. coracle ; l'Enc de la CARGAISON reste non suivie pendant la descente → résidu) ; option
  **déblayage manuel du barrage** (3d10 objets / 4d10 Enc) non modélisée — nécessite un choix mid-descente
  (bélier vs déblayer) = affordance de combat de bateau (chantier ci-dessous). RESTE (partiel).
- ~~**Améliorations de bateau (ch.10 : Blindage, coque…)**~~ ✅ **RÉSOLU** (majorité déjà couverte) : le
  système d'Améliorations navales MDG ch.12 (`naval-traits.json` + `install`/`passive`) EST le MÊME mécanisme
  que MSRC ch.10. Blindage, Lissage, Sabord, Cabine de luxe, Clinfoc, Ralentisseurs latéraux, Propulsion à
  vapeur, Bélier étaient DÉJÀ présents (recouvrement MDG/MSRC) → ne PAS dupliquer. Ajoutées les entrées
  PROPRES à MSRC sur le canal EXISTANT : **Bouteur** (`moveMod −1`) et **Murs blindés** (`deckCover` = couverture
  totale) — installables au chantier du Port (`installCost`) et mécaniquement actives (manœuvre/pont). RESTE :
  les Améliorations MSRC dont l'effet ne se mappe PAS sur le canal plat (Coque de course = 2×M, Safran = Test
  de Force du barreur, Plat-bord = couvert PARTIEL ≠ total, Allégement, Gréement de course, avirons/Fourquines)
  — un `moveMod`/`deckCover` mentirait → à câbler quand un champ de domaine dédié existera (chantier ci-dessous).
- ~~**Combat de bateau fluvial (ch.5 : dégâts/localisation d100, Critiques rames/gouvernail)**~~ ✅ **RÉSOLU**
  (commit bd6d37ad) : le bateau fluvial est une coque endommageable en combat via le MÊME moteur naval (MDG),
  sélectionné en DONNÉE (`hull.locationTable='navire-fluvial'` + `hull.criticalTable='river-criticals'`, champs
  déjà typés désormais LUS). Table `navire-fluvial` + `river-criticals.json` (MSRC verbatim, SOURCE UNIQUE
  partagée avec le voyage) + États Dérive/Gouvernail brisé. `applyCrewHit` généralise le Test d'équipage
  (poste MDG vs pont MSRC). Zéro doublon.
- **Bestiaire fluvial (ch.13) — 7 Traits** ✅ livrés en donnée (`traits.json`, MSRC ch.13) avec RÉDUCTIONS documentées :
  - `s-accrocher-pour-se-nourrir`, `engloutir` (corrige l'orphelin d'Amibe), `salive-anticoagulante`,
    `hallucinogene` : cœur tactique FIDÈLE (drain/Empêtré/aura à Test). RÉDUCTIONS : détachement auto « après
    BE Blessures extraites » (pas de compteur de PB drainées), « +1 Blessure quand la victime se dégage »,
    relâche sur Effrayé (s-accrocher) ; gating de Taille + non-attaque de la victime engloutie (engloutir) ;
    **Sonné « par niveau d'échec »** rendu comme **1 Sonné fixe** — l'op `condition.valuePerSL` n'échelonne pas
    sur un DR NÉGATIF (branche `fail` d'un nœud `test`) ; généraliser `perDegreeOfFailure` (psychology) au nœud
    `test` du Flow le corrigerait (chantier moteur, `flowCore`).
  - ~~`rampant`, `salive-analgesique`~~ ✅ **RÉSOLU** (câblés + testés) : `rampant` porte la capability `noRun`
    (`traits.json`, consommée par `runMultiplier=0` dans `engine/traits/dispatch.ts`, testée `traits/parity.test.ts`) ;
    `salive-analgesique` porte `wakelessBite` (consommée `state/combat/hitModifiers.ts`, testée). Seul `capricieux`
    reste **desc verbatim seule** — aucun canal ne module le DR d'un Test de Sociabilité d'un PJ *envers* une
    créature-cible (niche : négociation Naïade). RESTE (`capricieux` seul, extension de vocabulaire).
- **Bestiaire fluvial (ch.13) — 4 statblocs** ✅ livrés (`creatures.json`, VERBATIM MSRC, vérifiés stat par stat) :
  Anguille du Reik, Sangsue géante + variante Arbres, Naïade. Le **Filet de gobelin** (ZI) est porté comme atout
  `filet` (ranged/entraves, Portée 6, qualité Immobilisante → Empêtré ; le « 3 » de « À distance (Filet 3) » non
  modélisé — ni Dégâts (+0) ni Indice, rien inventé). **Rigs** : réutilisent des espèces EXISTANTES (Serpent/
  Sangsue/humain) — fonctionnel, la Taille de combat vient du Trait, pas du rig ; des rigs propres = polissage
  d'art optionnel (pas d'art à l'aveugle).
  **Forme de guerrière naïade** : socle FIDÈLE (`onCombatStart` → grantTrait Peur 2 + Armure 2) ; les **4 aspects
  tournants** (Déluge/Eau calme/Rapides/Sinueuse, un choix par Round) = RÉDUCTION documentée (choix par tour = hook
  d'IA de combat dans `combatFlow`/`ai`, verrouillé par la session // — laissés verbatim en `desc`).
- ~~**Brochet du Stir — réconciliation inter-livres**~~ ✅ **RÉSOLU (décision utilisateur : les deux ont le droit
  d'exister)** : le même élément avec un profil DIFFÉRENT d'un livre à l'autre = DEUX entrées distinctes qui
  coexistent (le jeu référence tout par `id`, pas par libellé — cf. `id-collisions.test.ts` « inoffensives à
  l'exécution »). `brochet-du-stir` (ZI, dossier Zoo Impérial, harvest/3 Chance/Queue agile PRÉSERVÉ) **et**
  `brochet-du-stir-fluvial` (MSRC ch.13, dossier Bestiaire fluvial) coexistent, même libellé, ids distincts,
  même rig (`appearance.species` partagé). Ni réconciliation ni écrasement : les deux versions sont valides.
- ~~**Scénario jouable de combat fluvial**~~ ✅ **LIVRÉ** : `src/scenes/test-scenarios/16-embuscade-fluviale.ts`
  (menu « 🧪 Tests — scénarios » → « Embuscade fluviale ») — barge + barque fluviales (coques MSRC), pirates
  (équipage exposé), Anguille du Reik. Test bout-en-bout `16-embuscade-fluviale.test.ts` : un Critique sur la
  coque pose un État FLUVIAL (Dérive/Gouvernail brisé/Voie d'eau) et JAMAIS `en-flammes-navire` (table Cargaison
  MDG absente) → prouve le routage par données de bout en bout.
- **Améliorations MSRC à effet non-plat + déblayage manuel de barrage** (choix mid-combat) : RESTE — le scénario
  de combat démontre les Critiques de coque, mais pas encore le choix bélier-vs-déblayage ni les upgrades
  Coque-de-course/Safran/Plat-bord (nécessitent un champ de domaine dédié + une affordance de choix mid-voyage).
- ~~**Maladies transmises par l'eau (ch.14)**~~ ✅ **RÉSOLU** : la descente `15-commerce-fluvial` EXERCE
  désormais l'Effet EXISTANT `waterExposure` — nouveau champ `MapRoute.riverExposure` (tirage d'étape à flot,
  source d'eau + mode ingestion/immersion) qui, via `applyEffects`, ouvre la cascade de Test de Résistance →
  maladie contractée. Réutilise le canal d'Effet + le moteur `engine/waterExposure.ts` (aucune mécanique
  neuve), éditable en donnée (route). Testé (cascade ouverte + contraction sur échec).

### Naval (MDG)
- **Artilleur haut-elfe** : la substitution de compétence par espèce (MDG 09) n'a aucun siège moteur
  (les carrières sont sans dimension d'espèce) → règle laissée verbatim dans le `desc` de la carrière.
- **Baliste portée 100 (MDG) vs 150 (AA)** : collision de variante entre livres, différée au dossier
  « collisions entre livres » (décision projet).
- **Désertion à la relâche** (`desertionRoll`) : équipage PNJ abstrait tenu par les PJ (MDG 14 l.39) →
  pas de cible applicable en l'état.

### Divers
- **Faxtoryll** : l'effet `preventInfection` (hors-RAW) a été RETIRÉ (LDB 72 l.22 ne le mentionne pas).
- **Filets ZI** (États, #41) : la section « Filets » du .md ZI est OCR-inexploitable → l'entrave
  aléatoire générique (`escapeStrength` 1d10×5) est prête à les porter dès décodage de la source.

---

## B. Lacunes jouabilité / éditabilité (audit transversal — 40 trous / 75 systèmes)

Source : audit adversarial par domaine (juillet 2026). Statut = jouable (scénario au menu) × éditable
(Effet + édition, ou champ de carte, ou donnée Codex).

### 🔴 Ni jouable ni éditable

| Système | Domaine | Ce qu'il manque |
|---|---|---|
| ~~Commerce terrestre/fluvial MSRC (`MapPlace.market`)~~ ✅ **RÉSOLU** (commit c77bc2cb) | Économie | Scénario `15-commerce-fluvial` (28 villes réelles du Reik, indices verbatim MSRC ch.11) + section « Marché » éditable dans WorldMapEditor + boucle achat/barge/revente prouvée. |
| Poursuites terrestres (`pursuit`) | Voyage | Flux de poursuite dans `travelFlow` (UI, sur le modèle `seaVoyageFlow`) + scénario + Effet `startPursuit`. `pursuit.ts` FAIT. |
| ~~Jeux de taverne~~ ✅ **RÉSOLU** | Économie | Effet `openTavernGames` ajouté (union `Effect` + handler `combatEffects` gaté sur `rule('tavern-games')` + édition `EffectList` sans champ, comme `restoreFortune`). `TavernGameModal` monté dans `CampaignView` (plus seulement dans l'Interlude). Atteignable : scénario `marche-equipement` (Aubergiste → dialogue « Une partie ? », `rules: { 'tavern-games': true }`). Testé (`health-effects.test.ts`). |
| ~~Troc (objet ↔ objet)~~ ⚪ **FAUX POSITIF** | Économie | L'UI de troc est DÉJÀ câblée : `renderBarter()` dans `MerchantPanel.tsx` (onglet « Troc » + sélecteurs Céder/Acquérir + devis de ratio de Disponibilité + bouton Échanger), et le connecteur `MerchantPanel()` passe bien `onBarter={barterExchange}` (store). Live en jeu dès l'ouverture du marchand (commit `0aa7f552`). Rien à faire. |
| ~~Suffocation (Souffle)~~ ⚪ **FAUX POSITIF** | Santé | Authorable via l'Effet GÉNÉRIQUE `ops` : `op: 'suffocate'` (ops.ts, pose le drapeau `suffocates` → `suffocationTick` par Round) est SÉLECTIONNABLE dans le `GameOpEditor` (groupe « 🌫️ Divers »). Un Effet `inflictSuffocation` dédié ferait doublon. `suffocation.ts` + op FAITS. |
| ~~Ivresse & alcool~~ ⚪ **FAUX POSITIF** | Santé | Authorable via l'Effet GÉNÉRIQUE `ops` : l'op `intoxicate` (ops.ts → `applyAlcoholTest`, déjà consommé par 2 boissons de `trappings.json`) est SÉLECTIONNABLE dans le `GameOpEditor`. Un Effet de scène dédié ferait doublon. `drunkenness.ts` + op FAITS. |
| Trauma psy. (`ambitionLost`) | Santé | Champs d'édition dans `EffectList.tsx` + trigger de scénario. **Handler déjà présent.** |
| Escalade hors-combat | Voyage | Trancher : « Test de compétence normal » (doc) OU Effet `climbTest`/`extendedTest` + scénario. |
| Création de personnage | Progression | Effet `startCharacterCreator` (ouvre l'assistant en jeu) + scénario. `CharacterCreator.tsx` existe. |
| Avancement / changement de carrière | Progression | Effet `partyAction`/`changeCareer` ouvrant l'écran avancement + scénario fin de chapitre. Actions `partyFlow.ts` FAITES. |
| Fin de séance (PX Ambition/Détermination) | Progression | Effet `sessionEnd` (= `heroSessionXp` + `regainDetermination`) + scénario de bilan. `session.ts` FAIT (aujourd'hui : entrée GameMenu hors éditeur). |
| Roster persistant | Progression | Discutable (save auto marche). Vrai manque = Effets d'auteur `addHero`/`removeHero`/`swapHero`. |

### 🟠 Jouable mais pas éditable par l'auteur

| Système | Domaine | Ce qu'il manque |
|---|---|---|
| ~~Ports maritimes (`PortProfile`)~~ ✅ **RÉSOLU** | Voyage | Section « Port » ajoutée dans `WorldMapEditor.tsx` (miroir de « Marché ») : checkbox Port → taille/richesse/production (cargaisons maritimes + Commerce/Minimum vital)/surplus/demande/`cosmopolite`/`lighthouse`. Round-trip stable (préservé par `parseProject`, testé). |
| ~~Voyage maritime (route `sea`)~~ ✅ **DÉJÀ FAIT** | Voyage | WorldMapEditor porte déjà la checkbox `sea` + select `seaHeading` (passe antérieure). |
| ~~Navire de campagne (`vessel`)~~ ✅ **RÉSOLU** | Voyage | Effet `setVessel` ajouté (union `Effect` + handler `combatEffects` groupe Navigation → pose `state.vessel` : navire de `vehicles.json` (facette `ship`) via select, Moral/coque initiaux authorés + édition `EffectList`, `refs` valident le navire). Testé (`health-effects.test.ts`). |
| ~~Postes d'équipage (`shipRole`)~~ ✅ **RÉSOLU** | Voyage | `ShipRolesPanel` (analogue `TravelRolesPanel`, `OptionChooser` + `crewRoles` + `defaultCrewRole` + `setShipRole`) rendu à l'appareillage (route maritime + navire présent) dans `WorldMapView`. Édite `shipRole` sur le groupe AVANT le départ. Testé (`ShipRolesPanel.test.tsx`). |
| Disponibilité (LDB 59/60) | Économie | Exposer `market-guild`/`market-mode`/`market-tenir-comptes` comme champs du marchand. |
| Marchandage / Évaluation / Réparation | Économie | Exposer en flags de l'entité marchand (déjà jouables via `openMerchant`). |
| Commerce maritime/port | Économie | Effet `openPort` pour SCRIPTER l'accès (aujourd'hui auto à l'accostage). |
| ~~Exposition Froid/Chaleur~~ ✅ **RÉSOLU** | Santé | Effet `exposureNight` ajouté (union + handler → moteur `exposureNight()` en cascade `count` Tests, kind froid/chaleur, cible party/hero + édition `EffectList`). Testé (`health-effects.test.ts`). |
| ~~Faim & Soif (provisions)~~ ✅ **RÉSOLU** (Faim) | Santé | Effet `inflictHunger` ajouté (union + handler → `applyFaimTest` × `days`, cible party/hero + édition `EffectList`). La Soif partage le moteur (`applySoifTest`) — un `inflictThirst` symétrique s'ajouterait pareillement si un scénario le demande. Testé (`health-effects.test.ts`). |
| Repas (`mealParty`) | Santé | Champs d'édition optionnels dans `EffectList`. |
| Psychologie combat (Peur/Terreur/Frénésie) | Combat | Quasi-OK par design (hooks auto + Traits/États du Codex). Option : Effet `inflictPsychology` (source de peur scénique). |
| Engagement/Désengagement, Empoignade | Combat | **OK par design** — actions de combat (choix modal). À DOCUMENTER, pas à coder. |

### ⚠️ FAUX POSITIFS de l'audit — magie/religion DÉJÀ couvertes par `magie.ts`

Le scénario `src/scenes/test-scenarios/magie.ts` (« Aelindra, Haute Sorcière multi-domaine + Nécromancie »
+ **10 Prêtres, un par dieu de combat** dont Manann, IA caster des DEUX camps) exerce déjà, EN JEU :
**Imparfaites** (casters sous pression), **Contre-sort / Dissipation** (IA des deux camps), **Surincantation**
(ZdE + augmentation au clic), **Colère des dieux** (Grand Prêtre à 3 Péchés), **Corruption/mutation** (zone de
Malepierre). L'audit les a classés « SCÉNARIO-MANQUANT » sur preuve trop mince (il n'a pas vu le setup réel) —
**faux positifs, aucun scénario à créer.** Reliquats éventuels, NARROW (à confirmer, ne PAS mass-créer) :
- **Magie des Mers en contexte NAVAL** : Manann est présent dans `magie.ts` (terrestre) ; un lancer en mer
  n'est pas spécifiquement exercé — mineur.
- **Petites Prières** (non-Béni sur site sacré, Effet `petitePriere`) : distinct des Prêtres Bénis de `magie.ts` ;
  narrow, un simple trigger sur un autel suffirait — pas un scénario dédié.
- **Retrait de Péché** : op `sinMod` déjà là ; manque le contenu Miracle « Absolution » (LDB 42) si voulu.

> **Leçon (cf. [[feedback-audit-nest-pas-ordre-de-travail]])** : une liste d'audit est des PISTES À VÉRIFIER,
> pas un ordre de travail. Vérifier contre la réalité (scénarios existants) AVANT de créer — ne jamais
> produire de contenu redondant.

### 🟡 Éditable/auto mais aucun scénario ne l'exerce (moteur déjà fait & testé en Vitest)

| Système | Domaine | Ce qu'il manque |
|---|---|---|
| Critiques & Traumatismes (`inflictTrauma`) | Santé | Trigger `inflictTrauma` dans un scénario (ex. `opera.ts`). Éditeur DÉJÀ là. **À CONFIRMER contre l'existant.** |
| Soins & infirmerie (`medicalAid`) | Santé | Effet `medicalAid` dans un scénario (médecin). Éditeur DÉJÀ là. |
| ~~Exposition hydrique (`waterExposure`)~~ ✅ **RÉSOLU** | Santé | `15-commerce-fluvial` l'exerce : `MapRoute.riverExposure` déclenche l'Effet à chaque étape de descente. Effet éditable. |
| Chute hors-combat (`fall`) | Voyage | Scénario (trappe/balcon effondré → `fall`). Effet DÉJÀ là. |
| Activités d'Altdorf | Progression | Scénario `altdorf-interlude` (groupe à Altdorf, interlude → activités taguées `altdorf`). |

### Priorisation recommandée (issue de l'audit)
1. **Vague 1 (max de couverture / min de code)** : les scénarios magie-religion + les triggers santé —
   tous petits, moteur déjà testé, transforme ~11 systèmes « non-jouables » en « jouables » et prouve la
   conformité RAW EN JEU.
2. **Vague 2 (éditabilité à bas coût)** : Effets `inflictHunger`/`exposureNight`/`intoxicate`/
   `inflictSuffocation` + champs WorldMapEditor (`sea`/`seaHeading`, Port) + `vessel`/`shipRole`/`openPort`.
3. **Vague 3 (chantiers lourds, moteur partiel)** : Commerce terrestre MSRC + Marchés (mutualisés),
   Poursuites terrestres, Jeux de taverne, Troc.
4. **Vague 4 (décision de design)** : méta-flux Création / Avancement / Fin de séance — les scripter
   in-game (Effet ouvrant l'écran existant) ou les laisser hors-scénario.
5. **Ne pas coder** : Engagement/Empoignade/Psychologie (design OK — documenter), Roster (save auto).

### Réserves de fiabilité de l'audit lui-même
- Verdicts « magie OK » adossés à un seul scénario (`magie.ts`) — couverture en LARGEUR plus faible que
  le « OK » ne le suggère.
- Critère à deux vitesses sur le déclenchement RNG : *Mutations* jugé OK (corruption proche du seuil)
  mais *Colère des dieux* recalé en SCÉNARIO-MANQUANT sur le même argument → uniformiser vers un
  scénario GARANTI dans les deux cas.
- Pas d'Effet `castSpell`/`forceCast` : on ne peut pas SCRIPTER un lancer de sort depuis un
  dialogue/trigger (éditable comme donnée/PNJ seulement) — décision de design à trancher.
