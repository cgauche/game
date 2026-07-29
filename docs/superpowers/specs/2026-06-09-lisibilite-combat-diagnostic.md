# Diagnostic-maître — Lisibilité du combat (« on ne comprend pas le combat »)

> Consolidation des 4 audits multi-agents du 2026-06-09 (W1 tempo/mouvement/modales, W2 moment du jet,
> W3 ciblage, W4 heuristiques tactiques). **77 problèmes confirmés à la source** (code file:line ET RAW LDB FR).
> Spec de design : point de départ, **rien n'est verrouillé**. Aucune règle inventée — tout est tracé.
>
> Sources des findings :
> - `docs/superpowers/audits/2026-06-09-w1-tempo-lisibilite.md` (26)
> - `docs/superpowers/audits/2026-06-09-w2-moment-du-jet.md` (8)
> - `docs/superpowers/audits/2026-06-09-w3-ciblage.md` (14)
> - `docs/superpowers/audits/2026-06-09-w4-heuristiques-tactique.md` (29)

---

## 1. Résumé exécutif

Vu du joueur, le combat est une **boîte noire rapide**. Il s'ouvre sur une modale d'Initiative qui voile un
plateau jamais montré ; s'il perd l'initiative, un ennemi « se téléporte » et une modale de défense surgit
sans contexte (qui ? d'où ? a-t-il chargé ?). Au moment d'agir, il ne sait pas qui il peut viser, ni quels
bonus s'appliquent, ni les dégâts probables ; il valide à l'aveugle. Le dé ne « roule » jamais (résultat
instantané), et la seule ressource pré-jet du RAW (Résilience avant le jet) est inexécutable. Tout l'état
tactique — Engagé, couvert, fumée, zones d'effet, menace ennemie, budget Action/Mouvement — est **calculé mais
jamais dessiné**. Un coup ne se ressent pas, une mort n'a pas de moment, et rien n'a de légende.

**Constat clé : les 77 symptômes remontent à 10 causes racines d'architecture.** La majorité ne sont pas des
correctifs ponctuels mais des **socles manquants** (un event de fin d'animation, un séquenceur de modales, une
couche d'overlay de ciblage/prévision, un canal de flottants typés, le câblage des données déjà présentes vers
l'UI). Corriger ces 10 racines éteint l'écrasante majorité des symptômes. **4 écarts sont des bugs de fidélité
RAW** (à traiter en priorité, hors UX). Le combat dispose déjà de tout le moteur nécessaire (IA pure
déterministe, `attackModifiers` étiqueté, `lineOfSightCover`, `etats.json`, `spells.json`) : le mandat
« information parfaite » (Into the Breach / XCOM) est surtout un **travail de câblage et de chorégraphie**, pas
de nouvelles règles.

---

## 2. Causes racines systémiques

> Chacune des 10 racines, corrigée une fois, éteint plusieurs findings. La couverture vise les **77** : chaque
> finding est rattaché à au moins une racine (voir la table de couverture en fin de section).

### R1 — Résolution AVANT l'animation (état logique téléporté à la destination)

**Défaut.** L'état logique saute instantanément à la destination (`enemy.pos = action.to`,
`combatFlow.ts:2170`) puis l'animation n'est qu'un placage par-dessus un état déjà arrivé. Pire, l'ouverture
de l'attaque/défense est armée sur un **délai fixe de 350 ms** (`combatFlow.ts:2084,2098,2191`) totalement
décorrélé de la durée réelle de glisse `walkDuration = (path.length-1)*160` (`walkPath.ts:21-22`, STEP_MS=160
`IsoStage.tsx:47`). Le déplacement étant 4-connexe, une charge diagonale « 5 cases » fait ~10 pas (~1600 ms)
alors que la modale s'ouvre toujours à 350 ms → **téléportation perçue + modale qui voile la fin de la
marche**. La caméra, elle, cadre `active.pos` (= destination déjà écrite, `IsoStage.tsx:471-472`) et non la
position interpolée `walkPosOf`, donc elle arrive avant le token et l'attend.

**Findings résolus (W1, W4) :**
- Modale de défense ouverte avant la fin de la marche (350 ms vs 640-1600 ms) [bloquant, 2×]
- Position logique fixée avant l'anim (LdV/dégâts/ciblage voient l'ennemi déjà arrivé)
- Caméra saute à la destination logique au lieu de suivre le trajet interpolé
- Halo/stroke d'acteur actif ancré à la destination, pas au token mobile
- Glisse trop rapide sans anticipation (dash multi-cases lu comme téléportation)
- Désync des durées de marche (off-by-one clip rig/plan `length*160` vs glisse `(length-1)*160`)
- Cadence globale du tour IA trop serrée pour percevoir move→attaque→défense comme des beats
- (W4 D7) Aucun cadrage automatique d'ensemble (zoom jamais auto-ajusté à `startCombat`)

**Socle commun :** exporter `STEP_MS` + `walkDuration` d'un seul module ; créer l'event `ANIM_MOVE_DONE`
(`bus.ts`, inexistant aujourd'hui) émis à la fin réelle de la glisse ; faire attendre le flux IA cet event +
un beat de présence (~150-250 ms) avant toute modale. **Garder le modèle état-instantané+placage** (sain pour
un moteur pur) — c'est la PRÉSENTATION qu'on cadence, comme le font déjà les floats (gating sur `ANIM_IMPACT`).

### R2 — Pas de séquenceur de modales ni de beats de respiration

**Défaut.** Les ~24 modaux sont montés **côte à côte, inconditionnels** (`CampaignView.tsx:121-144`), chacun
s'auto-masque si son pending est nul mais rien ne garantit l'unicité ; tous partagent `.modal-overlay`
z-index:100 (`styles.css:254-261`) → l'empilement dépend de l'ordre JSX, pas de la priorité sémantique. Les
gardes existent au niveau STORE (`maybeRunEnemyTurn`/`advanceTurn` testent `pendingReveals.length`,
`combatFlow.ts:1837`) mais ne sérialisent pas les modaux concurrents (reveal 'calme' d'approche + défense). Les
attaques gratuites enchaînées (Morsure→Caudale→Piétinement) rappellent `aiCreatureFreeAttacks`
**synchronement** depuis `defenseConfirm`/`defenseCancel` (`store.ts:2984,3006`) → prompts en rafale sans
anim ni ligne journal entre eux.

**Findings résolus (W1, W2, W4) :**
- Plusieurs modaux peuvent coexister (siblings inconditionnels, sans arbitre ni z-ordre) [majeur]
- Modales en chaîne sans respiration : Morsure/Caudale/Piétinement enchaînées [majeur]
- Combat démarre direct sur Initiative posée sur un champ jamais montré [majeur, 2×]
- Première modale (Initiative) n'enseigne rien d'actionnable : densité de modales à l'ouverture
- Initiative en modale bloquante alors que BattlePanel affiche déjà l'ordre — double emploi
- Aucun plan d'ensemble avant le 1er jet (étape « Début du Round » RAW absente)
- Délais de tempo IA en dur (450/350/500/750 ms) non centralisés ni alignés sur l'anim
- (W2 C) 12 implémentations dupliquées du `show={mauvaise issue}` Résilience (factoriser la PHASE d'offre)

**Socle commun :** un sélecteur central `pickActiveModal(state)` à priorité explicite
(FateSave > Fumble > Deviation > Cleave/Trample > Reveal > Defense > Psych > RoundStart > actions joueur) qui ne
rend QUE la plus haute, les autres en file ; un **point unique** pour insérer le beat de respiration
(~300-500 ms, fond grisé + portrait du combattant concerné) entre deux modaux ; phase d'établissement
non-bloquante à l'ouverture. C'est aussi le bon endroit pour factoriser la phase d'offre Résilience (pré/post).

### R3 — Le jet est révélé, pas lancé (pas de pré-roll, pas de frisson)

**Défaut.** Au clic « Lancer », le store tire le dé ET pose le résultat dans le **même `set()`**
(`attackRoll` `store.ts:2665-2678`, `testRoll` `:3282-3286`, `defenseRoll` `:2921-2931`) ; la modale re-rend
directement le nombre final figé. **Aucun `@keyframes` de dé**, aucun état « rolling ». En conséquence il
n'existe **aucune décision de ressource avant le lancer** : la Chance est légitimement post-jet (fidèle), et la
Résilience pré-jet (mode RAW primaire) est inexécutable (cf. RAW-1). Le désengagement pré-tire en plus le d100
de l'adversaire à l'ouverture du menu (`combatFlow.ts:595`), renforçant le « dés déjà lancés ».

**Findings résolus (W2) :**
- Pas de frisson du lancer : dé non animé, révélation instantanée [majeur, 2×]
- Aucune décision possible avant le lancer (sauf cible/mode) [mineur]
- Désengagement : jet d'attaque du foe pré-tiré à l'ouverture (révéler au clic, les 2 d100 ensemble) [mineur]
- (lié RAW-1) Résilience pré-jet impossible — voir RAW-1
- (W1) Modificateurs « show= » dupliqués 12× — voir R2

**Socle commun :** un beat de roulement **purement cosmétique** (état UI-local `rolling` dans le composant,
PAS dans le store — déterminisme RNG seedé intact), classe `.rolling` + 1 `@keyframes` partagé via `RollLine`,
honorant `prefers-reduced-motion`. Révéler ChanceButtons/ResilienceButton/verdict à la fin du roulement.
Harmoniser : les deux d100 d'un Test opposé se révèlent ENSEMBLE au clic (désengagement + défense).

### R4 — Pas de couche de ciblage / aperçu unifiée

**Défaut.** Tout l'appareil d'aide au ciblage est gaté sur `aimWeapon` (`IsoStage.tsx:246-249`), qui n'existe
**que** pour une arme `type==='ranged' && range`. `battle.reachable` n'est rempli **que** pour `move`/`charge`
(`store.ts:1648-1683`) ; en mode `attack`/`cast` la Map reste vide → aucune case « valide » peinte. La teinte
d'équipe rouge/vert/jaune (`IsoStage.tsx:276-285`) est inconditionnelle (toutes cases occupées, jamais filtrée
par éligibilité). Le moteur calcule pourtant TOUT, étiqueté, dans `attackModifiers` (`combat.ts:196-250`)
+ `env` scène — **aucun fichier de `src/ui` ne l'importe**. La validation portée/LdV/sort n'arrive qu'à la
résolution → flux gâché et faux « manqué ».

**Findings résolus (W3, W4) :**
- Aucune surbrillance des cibles VALIDES (mêlée comme distance) [majeur]
- Asymétrie mêlée vs distance : le tir a un embryon, la mêlée n'a rien [majeur, 2×]
- Aucun aperçu des MODIFICATEURS avant le jet [majeur]
- Le total de touche n'est JAMAIS montré avant de valider [majeur]
- Cible distance hors-portée / sans LdV : feedback tardif, flux gaspillé [majeur]
- Incantation : ciblage libre, aucune portée ni LdV (range jeté par `SpellLike`) [mineur]
- Bande de portée affichée même quand l'attaque sera résolue en mêlée (arme mixte) [polish]
- Décomposition des modificateurs disparaît silencieusement quand le plafond mord [majeur]
- L'indicateur de portée n'affiche QUE le mod de bande (occulte ~9 autres mods) [majeur]
- Modificateurs étiquetés de façon opaque (États regroupés sous « État »/« Cible vulnérable ») [mineur]
- (W4 E3) Sort : portée/durée/cibles non découvrables avant l'incantation [majeur]
- (W4 C2 part) Total avant le jet enrichi du couvert — voir R7 pour le rendu terrain

**Socle commun :** un concept unique « cibles atteignables par l'action courante » se spécialisant
mêlée/distance/sort, remplaçant `aimWeapon`. (A) `eligibleTargetIds` dérivé dans `battleSelectAction` avec les
**mêmes prédicats que la résolution** (source unique) → halo/anneau « cible valide » sur les TOKENS +
inéligible grisé. (B) sélecteur pur `previewAttack(get, attacker, target, location?)` qui rejoue le bloc `env`
de `resolveAttack` SANS tirer le d100, via un helper partagé `attackEnv(...)` consommé par preview ET
résolution, affiché par le `RollLine` existant + au survol (infobulle décomposée mêlée ET distance).
**Corrections transverses embarquées :** `showMods` ne gate plus sur l'égalité fragile (exposer le total capé
décomposé depuis `combineMods`) ; libellés nommant l'État décisif ; range restauré dans `SpellLike`.

### R5 — Pas de surface d'inspection ni de prévision de la menace

**Défaut.** Cliquer/survoler un ENNEMI n'ouvre rien d'inspectable : le clic part en attaque. Toute la donnée
existe sur le Combatant (`types.ts:216-261` : CC/CT/F/E, armes, PA, causesPeur/Terreur, traits) mais aucun
chemin UI ne l'affiche (`CharacterSheet` est couplé à `party.find` + sections hero-only). Surtout,
`chooseEnemyAction` (`ai.ts:70`) est **100 % pure et déterministe** (ne tire aucun dé) — elle calcule l'action
exacte de chaque ennemi — mais n'est appelée **qu'au moment où l'ennemi agit déjà** (`combatFlow.ts:2070`),
jamais en prévision. Aucune zone de danger, aucun télégraphe d'intention pendant le tour du joueur.

**Findings résolus (W4) :**
- Aucun panneau d'inspection ennemi (CC/CT, armes, PA, États, Peur/Terreur) [majeur]
- Aucune prévision de l'action ennemie alors que l'IA est pure et déterministe [majeur]
- Aucune zone de danger / portée de menace (où serait-on engagé au tour suivant) [majeur]
- Source de Peur qui s'approche : Test de Calme jamais anticipé ni signalé [mineur]

**Socle commun :** un sélecteur pur `forecastEnemyActions(battle, scene)` reconstruisant les inputs déjà
assemblés dans `runEnemyAI` (`combatFlow.ts:2056-2078`), rendu via la tuyauterie `targeting` existante (flèche
ennemi→cible / case fantôme + chemin). Borne = budget Marche réel (charge montée ×2 incluse). Recalcul gratuit
à chaque mutation joueur (IA pure). Test golden : `forecast == action réellement jouée` sur état figé. Panneau
d'inspection DÉDIÉ (déclencheur : clic sur ligne de l'Ordre de bataille). `fearSourceFor` (pur) surfacé en
amont (badge « 😨 Peur N »).

### R6 — Pas de HUD d'économie d'action ni de garde-fous

**Défaut.** Le tour RAW est exactement « un Mouvement et une Action » (LDB 13 l.17), mais le seul retour est un
`✓` collé à 4-6 boutons (`ActionBar.tsx:329,337,346,367`) ; la carte d'acteur rend les réserves
(Chance/Résilience/Destin) mais jamais les deux ressources du tour. `battleEndTurn` → `advanceTurn` direct sans
détection d'épuisement (`store.ts:2310`) ; « Fin du tour » exécute immédiatement même si rien n'a été dépensé
(LDB 13 l.88 attend pourtant un avertissement) ; un clic de case dépense le Mouvement **irréversiblement**
(`battleClickTile` `store.ts:2215-2223`, aucun snapshot). La nature Gratuit/Action/Mouvement de chaque action
vit implicitement dans le store, jamais exposée comme métadonnée d'UI.

**Findings résolus (W4) — c'est aussi la demande « zone verte/orange » :**
- Aucun compteur de budget Action / Mouvement [majeur]
- Pas de fin de tour automatique quand il ne reste ni Action ni Mouvement [majeur]
- Aucun garde-fou de confirmation avant un tour gâché (la « zone orange ») [majeur]
- Aucune annulation d'un déplacement déjà commité [majeur]
- L'UI ne distingue jamais Gratuit / coûte l'Action / coûte le Mouvement [mineur]

**Socle commun :** deux pastilles « 🦶 Mouvement / ⚔️ Action » (plein=dispo, grisé=dépensé) alimentées par
`battle.moved`/`acted` (pierre angulaire). Prédicat pur partagé `hasMeaningfulOption(active, battle)`
réutilisant EXACTEMENT `canFreeDisengage`/`canTrample`/`removableConditions` d'ActionBar (extrait en sélecteur
state↔UI) → pulse de `.ab-end` + confirmation légère nommant ce qui est perdu. Move pur réversible (snapshot
`{pos, facing, mountPos, smallerDisplaced}` + `cancelMove()`, verrouillé dès `fromCharge`/jet). Métadonnée de
coût déclarative par action, grisé sélectif (bouton-Action grisé par `acted`, pas par `moved`).

### R7 — État tactique calculé mais jamais dessiné (Engagé / couvert / fumée / AoE)

**Défaut.** Les états positionnels qui pilotent toute la couche tactique sont des données **purement
logiques**, jamais rendues (grep `engaged|cover|smoke|aoe` dans `src/gameIso` = aucun rendu tactique).
`engagedWith[]` conditionne 7 conséquences (déplacement libre, Charge, Désengagement, −20 tir-mêlée, flanc/dos,
tir dévié, Brisé) pour zéro pixel ; `lineOfSightCover` retourne `{blocked, cover}` consommé seulement à la
résolution ; `battle.smoke[]` bloque la LdV et fait échouer le tir **en silence** (`combatFlow.ts:521`
`return null`) ; les zones d'effet (Souffle/Vomi/Hurlement) calculent leur empreinte inline à la résolution,
sans aperçu.

**Findings résolus (W4, W3) :**
- L'état Engagé (zone de contrôle) n'est dessiné nulle part [majeur]
- Le couvert est calculé mais jamais montré (décors / cible / « à couvert ») [majeur]
- Les nuages de fumée bloquent la LdV mais sont invisibles [majeur]
- Les zones d'effet (Souffle/Vomi/chaîne) n'ont aucun aperçu avant déclenchement [majeur]
- L'arc avant/aveugle du défenseur (Flanc/dos +20) jamais indiqué [mineur]
- (W3) Les bandes de portée et l'éligibilité ignorent la LdV / le Couvert [majeur] — voir aussi R4/RAW-4

**Socle commun :** passes d'AFFICHAGE pures qui consomment l'état moteur existant (mémoire
« combat-optionnel, pas dupliquer » — ne recalculer aucune règle). Calque highlights d'IsoStage : tether de
mêlée entre paires `engagedWith` (déduplicable id<otherId) + bordure « verrouillé » sur l'actif engagé ; carte
de couvert au survol + marqueur bouclier « à couvert » ; calque iso fumée animé + compteur de Rounds + retour
explicite « LdV coupée par la fumée » ; télégraphe d'empreinte AoE ennemie (`battle.aoeAim`) avant résolution.

### R8 — Feedback cause→effet pauvre + caméra passive

**Défaut.** Une touche ne se ressent pas : la seule réaction est le clip rig 'hit' (torse 14°,
`clips.ts:62-67`), invisible à distance ; `usePlanAnim` (gabarits) **n'écoute même pas `ANIM_IMPACT`** → un
monstre touché ne bronche pas. Pas de flash, pas de shake, pas de hitstop. Les flottants n'existent QUE pour
une touche qui blesse (`if (!d?.result?.hit) return`, `IsoStage.tsx:185`) — un raté/parade/esquive/soin/coup
soaké/État ne produit aucun retour au-dessus du pion. La caméra ne suit jamais un tir DU JOUEUR (le cadrage
milieu-paire `enemyAim` est posé UNIQUEMENT côté IA) → asymétrie inversée : on voit mieux ce que fait l'IA que
soi-même. La mort n'a pas de moment (clip 'fall' orphelin, pose statique « bakée »).

**Findings résolus (W4) :**
- Une touche ne se ressent pas (ni flash, ni shake, ni hitstop ; gabarits sourds à l'impact) [majeur]
- Flottants seulement pour une touche qui blesse (miss/parade/esquive/soin/État muets) [majeur]
- Caméra ne suit pas un tir/sort DU JOUEUR (asymétrie inversée vs IA) [majeur]
- Application d'un État sans feedback transitoire [mineur]
- La mort n'a pas de « moment » [mineur]
- États-malus sans durée/empilement sur le PION [mineur]
- Flottants superposés au même pixel + COLLAPSE des enchaînements (feedback perdu) [polish]

**Socle commun :** **canal de flottants typés** (`Float` + `kind: 'damage'|'miss'|'block'|'dodge'|'heal'|
'condition'|'death'`, map kind→couleur) = infra fondatrice de 5 feedbacks. État 'struck' transitoire partagé
bipède+gabarit dans BodyToken (abonné `ANIM_IMPACT`, id===d.to). `enemyAim`→`actionAim` neutre posé côté IA ET
joueur (découpler cadrage et réticule). Event `ANIM_DEATH` jouant 'fall'. Shake dans un `<g>` wrapper interne
dédié (PAS le `<g>` caméra à transition 0.3s). **Le journal comme fil de lecture** : journaliser chaque beat IA
(« X avance vers Y », « X charge ! ») AVANT l'ouverture de la modale ; allonger/marquer-par-Round la fenêtre.

### R9 — Pas de légende ni accessibilité (données canon mortes côté UI)

**Défaut.** 13 emojis d'États + 4 codes couleur sans aucune clé de lecture (grep `légende/glossaire/aide` dans
`src/ui` = 0). Les pastilles d'État affichent l'icône mais jamais l'effet chiffré, alors que le texte canonique
existe dans `src/data/etats.json` (typé/exporté, **0 consommateur hors `src/data`**). L'appartenance
allié/ennemi repose UNIQUEMENT sur la couleur vert/rouge (barrière daltonisme ~8 % des hommes). Les slots
d'action primaires (Attaquer/Déplacer/Incanter) n'ont pas d'infobulle. La fiche perso n'affiche aucun État ni
buff actif. Aucune sémantique a11y (aria/role/alt n'existent que dans MerchantPanel).

**Findings résolus (W4) :**
- Aucune légende des icônes d'État / couleurs d'équipe [majeur]
- Pastilles d'État sans effet CHIFFRÉ au survol (etats.json mort côté UI) [majeur]
- Sort : portée/durée/cibles non découvrables — voir aussi R4 [majeur]
- Distinction allié/ennemi par la couleur seule (daltonisme) [majeur]
- Slots d'action PRIMAIRES sans infobulle [mineur]
- Fiche perso n'affiche aucun État ni buff actif [mineur]
- Combat UI sans aucune sémantique a11y ni navigation clavier [mineur]

**Socle commun :** câbler `effectIcons.ts` à `src/data/etats.json` (source unique, déjà typée) →
`<LegendePanel>` filtré-au-présent + effet chiffré dans chaque `chipTitle()`/title. Canal d'appartenance
INDÉPENDANT de la teinte (anneau plein vs tirets, cocarde d'équipe via le pipeline `icons`, axe bleu-jaune),
centralisé `teamShape(isHero)`. Dictionnaire de tooltips de slots. Bloc « États & effets » dans CharacterSheet
(sourcer le combattant VIVANT). aria-label via les composants partagés (EffectChips, RigPortrait).

### R10 — Identité visuelle absente des modales (déconnexion modale↔champ)

**Défaut.** RollModal et DefenseModal n'affichent l'identité que via `<strong>{name}</strong>` — ni portrait,
ni couleur d'équipe, ni PV, ni arme choisie. Les briques d'identité du jeu (`RigPortrait`, `HERO_RING`/
`ENEMY_RING`, `hpColor`, `teamColors.ts`) sont utilisées dans ActionBar mais **jamais importées dans les
modales**. On ne choisit même pas l'arme : `attackWeapon` prend la 1ʳᵉ arme de mêlée du tableau
(`combat.ts:300-305`) sans sélecteur, et chaque consommateur re-dérive `firedWeapon` indépendamment. Le verdict
et le log accolent des chiffres (DR net, Blessures, Avantage) sans dire à qui ils appartiennent.

**Findings résolus (W1) :**
- On ne sait pas QUI EST QUI : modales sans portrait, couleur d'équipe, PV [majeur]
- On ne choisit pas l'arme : `firedWeapon` prend la 1ʳᵉ de mêlée, sans sélecteur [majeur]
- Aucune estimation de dégâts avant validation (briques pures non importées) [majeur]
- La modale de Défense surgit sans contexte de l'attaque entrante [majeur, 2×]
- Le verdict et le log mélangent les chiffres sans dire à qui ils appartiennent [mineur]

**Socle commun :** réutiliser dans les DEUX modales les briques d'identité d'ActionBar (portrait + anneau
d'équipe + PV de part et d'autre du `→`). `weaponUid?` dans `PendingAttack` + `attackSetWeapon` + fonction
unique `chosenWeapon(attacker,target,pa)` lue par TOUS les points (sinon le picker mentirait à mi-flux) +
picker pré-jet. Estimation « Dégâts d'arme + DR − (BE+PA) = Blessures » (briques `effectiveWeaponDamage`/
`woundsFromHit` déjà pures). Enrichir la défense du contexte déjà figé (`pd.atk.target`, `freeKind`).

---

### Table de couverture (77 findings → 10 racines)

| Racine | Lentille dominante | Findings (approx.) |
|---|---|---|
| R1 Résolution avant l'anim | W1 tempo/mouvement | 8 |
| R2 Séquenceur de modales | W1 file de modales + W2 factorisation | 8 |
| R3 Jet révélé pas lancé | W2 moment du jet | 4 (+RAW-1) |
| R4 Couche ciblage/aperçu | W3 ciblage + W4 sort | 12 |
| R5 Inspection & prévision menace | W4 prévision | 4 |
| R6 HUD économie + garde-fous | W4 économie d'action | 5 |
| R7 État tactique dessiné | W4 position/terrain + W3 LdV | 6 |
| R8 Feedback + caméra | W4 juice/caméra + W1 journal | 8 |
| R9 Légende & accessibilité | W4 onboarding | 7 |
| R10 Identité visuelle modales | W1 attaque/défense | 6 |

(Total ≈ 68 UX + 4 bugs RAW + chevauchements croisés = 77 confirmés ; plusieurs findings sont co-listés sur 2
racines — ex. « bandes ignorent LdV » relève de R4 et R7, « Résilience pré-jet » de R3 et RAW-1.)

---

## 3. Bugs de FIDÉLITÉ RAW (prioritaire — écarts de RÈGLE, pas d'UX)

> Ces 4 écarts violent une règle du Livre de base. Ils sont distincts des manques UX et doivent être corrigés
> en TDD (moteur pur). Citations vérifiées dans `Source/Warhammer v4 - Livre de base version corrigée/`.

### RAW-1 — Résilience « Je ne faillirai pas ! » : le mode PRIMAIRE (avant le jet) n'existe pas

**Règle.** LDB 17 l.68 : « **au lieu de lancer les dés pour un Test, vous choisissez le résultat** […]. S'il
s'agit d'un Test opposé, vous l'emportez avec au moins DR +1. **Vous pouvez même** faire ce choix **après** un
Test qui a échoué. » → deux fenêtres : (1) **pré-jet = mode nominal**, (2) post-échec = concession (« même »).

**Code.** Seule la fenêtre (2) est codée, et restreinte aux issues défavorables. `ResilienceButton.tsx:7`
(`if (resilience<=0 || !show) return null`), rendu uniquement post-résultat (`RollModal.tsx:131`
`!!res && !res.hit`, + 11 modales identiques), et toutes les `*ForceSuccess` early-return tant que le dé n'est
pas tiré (`store.ts:3138` `pt.roll==null`, `:3148` `!pa.result`, `:3170`, `:3182`, `:3196`). Aucun chemin store
ne pose `success` sans `result`/`roll` préexistant.

**Correctif.** Exposer la Résilience dans la branche pré-jet (`!res`/`!rolled`/`phase==='choice'`), libellée
« 🔥 Je ne faillirai pas ! », conditionnée à `resilience > 0` seul. Ajouter `forceSuccessFromScratch` qui
fabrique un succès sans tirer : Test simple → `success:true, sl = max(requireSL, 1)` ; Test opposé → l'emporte
`sl = max(advSL+1, 1)`. Garder la fenêtre post-échec (les deux coexistent). Consommer 1 Résilience,
court-circuiter la révélation. **Factoriser la PHASE d'offre avant** (cf. R2 ; le `show=` est dupliqué 12×).

### RAW-2 — « Je ne faillirai pas ! » : choix du résultat + localisation du critique non implémentés

**Règle.** LDB 17 l.68 : « vous **choisissez le résultat** » et « Si vous infligez un Coup Critique, vous
pouvez **choisir la Localisation atteinte**, plutôt que de la laisser au hasard. » L'exemple l.75 en dépend
(choisir 11 → Critique → localisation).

**Code.** `attackForceSuccess` (`store.ts:3146-3166`) force seulement `success`+`sl`. Pire,
`combatFlow.ts:654` : `const loc = isCoupCritique ? critLocationRoll(battleRng(), target.bodyShape) :
location;` → quand c'est un Coup Critique (précisément le cas RAW), la localisation est **tirée au hasard** et
l'argument `location` est ignoré.

**Correctif.** Quand un succès forcé produit `res.critical`, réutiliser la grille de localisation existante
(`RollModal.tsx:88-97` + `HIT_LOCATION_LABELS`) en mode post-forçage, et transmettre la loc choisie jusqu'à
`applyCriticalToTarget` pour court-circuiter `critLocationRoll`. Respecter le `bodyShape`/footprint de la cible.
Choix du d100 lui-même = étage de fidélité supérieur (optionnel) ; à défaut, fabriquer un `roll` cohérent
(≤ target) pour ne pas casser l'affichage `🎲 null` ni les calculs critique/double.

### RAW-3 — Portée d'engagement de mêlée codée en dur à 1 case (Allonge ignorée)

**Règle.** LDB 62 l.211 (Très longue : Engage jusqu'à 4 m) ; LDB 62 l.213 (Considérable : 6 m) ; LDB 15 l.55
(1 case = 2 m). → Très longue = 2 cases, Considérable = 3 cases. **NE PAS** implémenter l'Option « Longueur
d'Arme / Combat au Contact » (LDB 62 l.215-222, marquée optionnelle).

**Code.** L'éligibilité mêlée est `chebyshev(active.pos, target.pos) <= 1` (`store.ts:2288`) et la résolution
rejette `dist > 1` (`combatFlow.ts:510`) sans jamais lire `weapon.reach` (l'Allonge existe pourtant sur
`character.ts:296`).

**Correctif.** Fonction pure `reachTiles(weapon)` dans `engagement.ts` ({ 'Très longue': 2, 'Considérable':
3, défaut: 1 }, citant LDB 62 l.211/213 + LDB 15 l.55), partagée aux TROIS points (`store.ts:2288`,
`combatFlow.ts:510`, `combatFlow.ts:446/firedWeapon`) ET l'IA (`combatFlow.ts:966,1019,1088,…`) sinon
asymétrie héros/ennemi. Préférer `combatDistance` (empreinte) à `chebyshev` brut pour cumuler avec le footprint
T6. Exposer le même `reachTiles` à IsoStage pour peindre la zone d'engagement (corrige aussi R4).

### RAW-4 — Modificateur de surnombre (2c1/3c1) calculé nulle part (+ faux-ami « Assailli ×N »)

**Règle.** LDB 14 l.92 : 2 contre 1 = +20 ; LDB 14 l.85 : 3 contre 1 = +40. Règle 1 « ne rien laisser au MJ de
ce que le canon définit ».

**Code.** Aucun modificateur de surnombre n'existe dans le moteur (`attackModifiers` ne le calcule pas). Le
compteur `assailliN` (`ActionBar.tsx:84-86`, teinte danger) est purement cosmétique ET concerne les ennemis au
contact du HÉROS (perspective DÉFENSIVE), pas le surnombre offensif que le héros impose à sa cible. Rien
calculé, quelque chose montré, et à l'envers.

**Correctif.** Implémenter le ModLine offensif dans `attackModifiers` branche mêlée : nombre d'alliés de
l'attaquant engagés/adjacents à la CIBLE (attaquant inclus) → 2c1 = +20, 3c1 = +40, plafonné à +40, calculé
sur la case de la CIBLE. `attackModifiers` étant pur, passer `opts.outnumber?: number` calculé par combatFlow
(comme `env`). Requalifier/retirer le « ⚔️ ×N » défensif trompeur en même temps.

> **À NE PAS « corriger » (faux positifs de fidélité)** :
> - **La Chance est légitimement post-jet** (LDB 17 l.24 relance après échec, l.26 +1 DR après le Test) —
>   `fortune.ts`/`ChanceButtons.tsx` sont fidèles. Ne PAS la déplacer en pré-jet.
> - **Le pré-tirage du d100 adverse au désengagement** (`combatFlow.ts:595`) est mécaniquement nécessaire
>   (stabilité des relances ciblées) — pas une violation RAW, juste un défaut d'affichage (révéler au clic).
> - **Réf de commentaire « l.72 »** : trivial mais à corriger (l.72 = « Je te renie ! », l.73 = « Je ne
>   faillirai pas ! ») partout (ResilienceButton + 12 flux store).

---

## 4. Modèle de chorégraphie proposé (point de départ, NON verrouillé)

Séquence cible d'un tour LISIBLE (exemple : tour ennemi « charge au contact »). Remplace la cascade de
`setTimeout` magiques par une **chaîne pilotée par les fins d'animation**.

| # | Étape | Ce qui se passe | Racines adressées |
|---|---|---|---|
| 0 | **Plan d'ensemble / « Début du Round »** | Champ visible (~0,8-1,2 s, AUCUNE modale), caméra fit-to-combatants, anneaux des deux camps, bandeau « Le combat commence ! ». Initiative = frise persistante (BattlePanel), pas une modale. Surprise = beat distinct. IA gelée par `establishing`. | R1 (fit-to-combatants), R2 (établissement), R5 (vue des forces) |
| 1 | **Inspection & prévision de la menace** | Au survol d'un ennemi : statbloc inspectable + télégraphe d'intention (`forecastEnemyActions`) + zone de danger. Badge « 😨 Peur N ». État Engagé/couvert/fumée DESSINÉS. | R5, R7 |
| 2 | **Sélection d'action + cibles valides + aperçu** | Cibles éligibles surlignées (tokens), inéligibles grisées ; au survol, aperçu décomposé des modificateurs + total de touche + estimation de dégâts. HUD budget Action/Mouvement + coût a priori par bouton. | R4, R6, R10 (estimation) |
| 3 | **Décision pré-jet (Résilience)** | Bouton « 🔥 Je ne faillirai pas ! » dispo AVANT « Lancer » (mode RAW primaire). Garde-fou « tour gâché » si Fin du tour avec ressources non dépensées. | RAW-1, RAW-2, R3, R6 |
| 4 | **Lancer animé (frisson)** | Beat de roulement cosmétique (~400-600 ms, RNG seedé intact), puis révélation. Les 2 d100 d'un Test opposé roulent ensemble. | R3 |
| 5 | **Résolution** | Le moteur résout (déjà instantané/pur, inchangé). Surnombre/Allonge correctement appliqués. | RAW-3, RAW-4 |
| 6 | **Mouvement animé + caméra qui suit** | Glisse `walkXY` avec easing ; `focus = walkPosOf` pendant la marche ; halo/stroke ancré au token mobile ; journal « X avance / charge ! ». Attendre `ANIM_MOVE_DONE` + beat de présence. | R1, R8 (caméra/journal) |
| 7 | **UNE modale contextualisée** | Via `pickActiveModal` : Défense avec portrait+PV+couleur des deux, menace (`pd.atk.target` vs Parade/Esquive), nature (charge/free attack), case attaquante surlignée derrière une modale non-opaque. | R2, R10 |
| 8 | **Beat / journal** | Free attacks (Morsure/Piétinement) intercalées d'anim + ligne journal + court délai, jamais synchrones au clic. Flottants typés + 'struck' + feedback de mort. | R2, R8 |
| 9 | **Fin de tour** | Auto-fin/pulse sur budget épuisé ; confirmation si tour gâché ; multiplicateur global de vitesse pour le ressenti « trop vite ». | R6, R1 (cadence) |

**Chemin critique** (socle qui débloque le reste) : event `ANIM_MOVE_DONE` + `STEP_MS` unifié (R1) ·
sélecteur `pickActiveModal` (R2) · couche d'overlay `previewAttack`/`eligibleTargetIds` (R4) · canal de
flottants typés (R8). Ces 4 briques rentabilisent ~10 des 26 gaps W4 et l'essentiel de W1/W3.

---

## 5. Découpage en LOTS (priorisés, ordonnés, dépendances)

> Convention : **MOTEUR** = risqué, à tester TDD (modifie `engine`/résolution) · **AFFICHAGE** = sûr
> (rendu/UI pur, recette navigateur). Ordre = bloquant → polish, en respectant les dépendances.

### LOT 0 — Bugs de FIDÉLITÉ RAW (MOTEUR, TDD) — *en tête, indépendant*
- **Objectif :** corriger les 4 écarts de règle avant toute UX (sinon les aperçus afficheraient un total faux).
- **Ferme :** RAW-1, RAW-2, RAW-3, RAW-4 + réf commentaire l.72→l.73.
- **Fichiers :** `engine/combat.ts` (surnombre, critLocation), `engine/engagement.ts` (`reachTiles`),
  `state/combatFlow.ts` (510/446/654/2070-zone IA), `state/store.ts` (`*ForceSuccess`, `forceSuccessFromScratch`),
  `ui/ResilienceButton.tsx` + grille localisation, `ui/ActionBar.tsx` (étiquette surnombre).
- **Type :** MOTEUR (TDD obligatoire). Dépendance : aucune. RAW-3 alimente R4 (zone d'engagement).

### LOT 1 — Socle tempo : `ANIM_MOVE_DONE` + horloge unifiée (MOTEUR léger + AFFICHAGE)
- **Objectif :** tuer la « téléportation » et la modale-qui-coupe-la-marche.
- **Ferme :** R1 en entier (synchro glisse↔modale, caméra suit le token, halo ancré, off-by-one, cadence IA).
- **Fichiers :** `gameIso/walkPath.ts` (exporter STEP_MS+walkDuration), `gameIso/bus.ts` (event), `gameIso/
  IsoStage.tsx` (focus=walkPosOf, transition CSS désactivée en marche), `gameIso/useRigAnim.ts`/`usePlanAnim.ts`
  (clip=walkDuration), `state/combatFlow.ts` (attendre l'event + table BEAT + multiplicateur de vitesse).
- **Type :** MOTEUR (orchestration combatFlow, à tester) + AFFICHAGE (caméra). Dépendance : aucune.
  **Chemin critique.**

### LOT 2 — Séquenceur de modales + établissement (AFFICHAGE + store léger)
- **Objectif :** une seule modale à la fois, beats de respiration, ouverture lisible.
- **Ferme :** R2 (arbitre d'unicité, Initiative sortie du flux, free attacks espacées, établissement) + la
  factorisation de la PHASE d'offre Résilience (prérequis de LOT 0 RAW-1 côté UI).
- **Fichiers :** `ui/CampaignView.tsx` (`<ActiveModal/>`/`pickActiveModal`), `state/store.ts` (drapeau
  `establishing`, retrait pushReveal Initiative, `dismissReveal` garde), `state/combatFlow.ts` (free attacks en
  setTimeout), `ui/DefenseModal.tsx` (badge `freeKind`).
- **Type :** AFFICHAGE majoritaire + store. Dépendance : LOT 1 (point d'insertion du beat). Garde-fou statique
  « un jet = une modale » à ajuster si on retire le reveal Initiative.

### LOT 3 — Couche de ciblage / aperçu unifiée (MOTEUR pur + AFFICHAGE)
- **Objectif :** voir qui on peut viser, quels bonus s'appliquent, quel total/dégâts, AVANT de lancer.
- **Ferme :** R4 en entier (eligibleTargetIds, previewAttack, showMods robuste, libellés d'État, range sort,
  asymétrie mêlée/distance, bande LdV) + R10 partie estimation/arme.
- **Fichiers :** `engine/combat.ts` (`previewAttack`, total capé exposé, libellés d'État), `state/combatFlow.ts`
  (`attackEnv` partagé), `state/store.ts` (`eligibleTargetIds`, garde portée/LdV/sort au clic, `weaponUid`,
  `attackSetWeapon`), `engine/magic.ts` (range dans SpellLike), `gameIso/IsoStage.tsx` (halo cibles + survol
  mêlée + choix d'arme par cible + LdV dans bandes), `ui/RollModal.tsx` (branche pré-jet, picker, showMods),
  `engine/conditions.ts` (nom d'État retenu).
- **Type :** MOTEUR (sélecteur pur `previewAttack`, parité aperçu↔jet à tester) + AFFICHAGE. Dépendance :
  LOT 0 (RAW-3/RAW-4 pour un total correct). **Chemin critique.**

### LOT 4 — Identité visuelle des modales + pré-roll animé (AFFICHAGE + store léger)
- **Objectif :** savoir qui frappe qui, avec quelle arme, et ressentir le lancer.
- **Ferme :** R10 (portraits/PV/équipe dans les modales, contexte défense, verdict structuré) + R3 (beat de
  roulement, décision pré-jet, 2 d100 ensemble).
- **Fichiers :** `ui/RollModal.tsx`, `ui/DefenseModal.tsx`, `ui/DisengageModal.tsx`, `ui/teamColors.ts`/
  `RigPortrait.tsx` (réutilisation), `state/store.ts` (PendingDefense enrichi, état `rolling` UI-local),
  `ui/styles.css` (@keyframes dé, prefers-reduced-motion).
- **Type :** AFFICHAGE majoritaire. Dépendance : LOT 0/3 (estimation via previewAttack), LOT 2 (séquenceur).

### LOT 5 — Prévision de la menace + inspection (MOTEUR pur + AFFICHAGE)
- **Objectif :** le combat devient PLANIFIABLE (école information-parfaite).
- **Ferme :** R5 (forecastEnemyActions, panneau d'inspection, zone de danger, badge Peur).
- **Fichiers :** `state/ai.ts` + `state/combatFlow.ts` (extraire `forecastEnemyActions` pur), `gameIso/
  IsoStage.tsx` (rendu flèches/cases via `targeting`, zone de menace), `ui/BattlePanel.tsx` (clic ligne →
  inspection), nouveau panneau d'inspection dédié, `engine/psychology.ts` (fearSourceFor surfacé),
  `gameIso/effectIcons.ts` (catégorie trait inspiré).
- **Type :** MOTEUR pur (forecast, test golden forecast==action) + AFFICHAGE. Dépendance : LOT 3 (réutilise la
  couche d'overlay/targeting). **Levier n°1 d'impact.**

### LOT 6 — HUD d'économie d'action + garde-fous (AFFICHAGE + store léger)
- **Objectif :** la « zone verte/orange » — budget lisible, pas de tour gâché par mégarde.
- **Ferme :** R6 (pastilles Action/Mouvement, auto-fin/pulse, confirmation tour gâché, undo move, coût a priori).
- **Fichiers :** `ui/ActionBar.tsx` (pastilles + coût par bouton + grisé sélectif), `state/store.ts`
  (`hasMeaningfulOption` partagé, `cancelMove` + snapshot, garde confirmation), `state/combatFlow.ts`
  (détection épuisement à `finishPlayerAction`).
- **Type :** AFFICHAGE majoritaire + store (snapshot/undo à tester). Dépendance : LOT 2 (confirmation via
  l'arbitre de modales). **Levier n°2 (pierre angulaire de planification).**

### LOT 7 — État tactique dessiné (AFFICHAGE pur)
- **Objectif :** rendre visible Engagé / couvert / fumée / AoE / flanc-dos.
- **Ferme :** R7 (tether d'engagement, carte de couvert, calque fumée, télégraphe AoE, arc avant/dos).
- **Fichiers :** `gameIso/IsoStage.tsx` (calques highlights : engagement, couvert, fumée, aoeAim),
  `gameIso/anim.css` (keyframe fumée), `state/combatFlow.ts` (poser `battle.aoeAim` avant résolution ; raison
  explicite « LdV coupée »).
- **Type :** AFFICHAGE pur (lire l'état moteur, NE PAS recalculer). Dépendance : LOT 1 (calque highlights),
  LOT 3 (réutilise overlay). **Levier n°3.**

### LOT 8 — Feedback cause→effet + caméra (AFFICHAGE pur)
- **Objectif :** chaque coup/mort/soin/État se voit ; la caméra suit aussi les actions du joueur.
- **Ferme :** R8 (flottants typés, 'struck' partagé, actionAim, ANIM_DEATH, journal comme fil, fit-to-pair,
  collapse des enchaînements).
- **Fichiers :** `gameIso/IsoStage.tsx` (Float+kind, actionAim, fit), `gameIso/BodyToken.tsx` (état struck,
  count/rounds), `gameIso/useRigAnim.ts`/`usePlanAnim.ts` (ANIM_IMPACT/ANIM_DEATH partagés), `gameIso/bus.ts`
  (events), `state/store.ts` (float depuis healCommit), `state/combatFlow.ts` (journal des beats IA, ANIM_DEATH).
- **Type :** AFFICHAGE pur (calibrage recette navigateur). Dépendance : LOT 1 (event de fin d'anim). **Levier
  n°4 (canal de flottants = infra de 5 feedbacks).**

### LOT 9 — Légende, accessibilité, découvrabilité (AFFICHAGE pur)
- **Objectif :** clé de lecture pour un nouveau joueur, daltonisme, sorts découvrables.
- **Ferme :** R9 (LegendePanel, effet chiffré via etats.json, daltonisme, tooltips slots, fiche perso, a11y).
- **Fichiers :** `gameIso/effectIcons.ts` (câblage etats.json), `src/data/etats.json` (lecture),
  `ui/EffectChips.tsx`/`ui/BattlePanel.tsx` (chipTitle + LegendePanel), `gameIso/teamColors.ts` (teamShape),
  `gameIso/BodyToken.tsx` (cocarde/anneau), `ui/ActionBar.tsx` (tooltips slots + fiche sort), `ui/
  CharacterSheet.tsx` (bloc États), `ui/RigPortrait.tsx` (aria).
- **Type :** AFFICHAGE pur. Dépendance : LOT 8 (count/rounds sur le pion). Polish à fort gain pédagogique.

**Ordre recommandé :** LOT 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Les LOTS 0-3 sont bloquants (fidélité +
chemin critique) ; 4-8 sont la chair de la lisibilité ; 9 est le polish pédagogique. LOTS 5/6/7/8 sont
largement parallélisables une fois 0-3 posés.

---

## 6. Top 5 leviers (impact lisibilité / effort)

1. **R5 — Prévision déterministe de l'action ennemie (forecastEnemyActions).** L'absence n°1 vs le genre
   information-parfaite. `chooseEnemyAction` est DÉJÀ pure et calcule la réponse exacte sans dé ; il « suffit »
   de l'appeler en prévision et de la rendre via la tuyauterie `targeting` existante. Transforme le combat de
   réactif (« l'IA m'a chargé par surprise ») en planifiable. **Coût modéré (sélecteur pur + rendu réutilisé),
   impact maximal.** (LOT 5)

2. **R6 — Compteur Action / Mouvement + garde-fous (« zone verte/orange »).** Le tour WFRP4 EST « un Mouvement
   et une Action » (LDB 13 l.17) ; ne pas le voir d'un coup d'œil rend toute planification opaque. Pierre
   angulaire dont dépendent l'auto-fin, la confirmation de tour gâché, le coût a priori. **Coût faible (deux
   pastilles alimentées par `moved`/`acted`), impact structurel.** (LOT 6)

3. **R4 — Couche ciblage/aperçu (previewAttack + eligibleTargetIds).** « On sait difficilement qui on peut
   viser ni les bonus qui s'appliquent » : la donnée est calculée, étiquetée, et jamais montrée avant le jet.
   Un seul chantier (sélecteur pur rejouant l'env sans tirer le dé + halo de cibles) ferme 12 findings W3/W4 et
   l'asymétrie mêlée/distance. **Coût moyen, impact très large.** (LOT 3)

4. **R8 — Canal de flottants typés (miss/parade/esquive/soin/État/mort).** Le langage cause→effet est à moitié
   implémenté : sans « Raté »/« Paré »/« +N », un échange se lit comme deux pions immobiles. Infra fondatrice de
   5 feedbacks (D3 États, D5 mort, D6 caméra joueur, D8 collapse). **Coût faible (généraliser un canal
   existant), gain de compréhension immédiat à chaque coup.** (LOT 8)

5. **R1 — Socle tempo `ANIM_MOVE_DONE` + horloge unifiée.** C'est la cause directe de la « téléportation » et de
   la modale-qui-voile-la-marche — le symptôme le plus cité du retour brut. Exporter STEP_MS d'un seul module,
   créer l'event de fin de glisse, faire suivre la caméra au token. **Coût faible-moyen, débloque LOT 2 (beats)
   et LOT 8 (caméra) — chemin critique.** (LOT 1)

> Note transverse : ces 5 leviers partagent 4 briques de socle à construire d'abord — `ANIM_MOVE_DONE`+STEP_MS
> unifié (R1), `pickActiveModal` (R2), couche d'overlay `targeting`/`previewAttack` (R4), canal de flottants
> typés (R8) — plus les 4 bugs RAW (LOT 0). Les prioriser rentabilise l'essentiel des 77 findings.
