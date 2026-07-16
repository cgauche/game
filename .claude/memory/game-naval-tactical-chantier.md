---
name: game-naval-tactical-chantier
description: "Combat naval tactique (MDG ch.12-14) — découpage en dalles D3a..D3h, avancement, et fait « je suis seul sur le naval »."
metadata: 
  node_type: memory
  type: project
  originSessionId: bd617961-a8fe-4d3c-891e-1a881b057251
---

Chantier **combat naval tactique** (Dalle 3 du plan « Swift Sutton »), sur la fondation navale déjà
construite (navire = Combattant-coque `bodyShape:'vehicule'`, crewIds, Critiques de navire, états navals
tickés, Moral hebdo). Plan/découpage écrit dans `~/.claude/plans/fancy-riding-sun.md` :
D3a rôles d'équipage → D3b manœuvre/cap → D3c postes d'artillerie → D3d arcs de tir/bordées → D3e tir de
batterie → D3f collisions/éperonnage → D3g abordage+répartition → D3h (opt) course-poursuite abstraite.
Décisions actées : combat rapproché SUR LA GRILLE iso (navires=Combattants) ; chase RAW = approche abstraite optionnelle/tardive.

**Avancement (2026-06-23) :**
- **D3a fait & commité** (`4d25893d`) : `resolveCrewTestByRoles` + `crewRoleValue` (engine/crewMorale.ts),
  accessors `findCrewRoleById`/`findCrewTestTypeById` (data/index.ts), catalogues `crew-roles.json` +
  `crew-test-types.json` (étaient commités ORPHELINS sans consommateur). Rôle essentiel ×2, double-rôle
  +2 crans, Manque de bras plafonné au Succès Minime. Bonus de chant Chansonnier NON chiffré par le RAW → non modélisé.
- **D3b cœur moteur fait & commité** (`ca49fcc1`) : `progressionMovement` + `resolveShipManeuver`
  (engine/shipNavigation.ts) + table `naval-progression.json`. RESTE D3b : flux `FLOWS.shipManeuver` + action de combat (virer le Dir8 + avancer).
- **D3d arcs/bordées fait & commité** (`63470d9a`) : state/fireArc.ts `targetArc`/`inFireArc`, modèle BORDÉE
  (proue/poupe 1 octant, bâbord/tribord 3 octants), réutilise `facingToward`. Interprétation 90°-vs-bordée à valider.
- **D3f collisions/éperonnage fait & commité** (`f61a07b9`) : engine/collision.ts `collisionIndex` + `resolveCollision` (frontal/milieu/poupe/s'éloigne/manœuvre).
- **D3c (1/n) placement fait & commité** (`c4bf0e5e`) : state/shipPostes.ts `placementPenalty` (poids/facing vs Contenance).
  RESTE D3c : modèle `ShipPoste {weaponRef, side, sabord?, crewIds}` (liste LIBRE, PAS de slots — vérifié FR+VO),
  câblage spawn (`grantWeapon` + mountSide + couvert Sabord), tir restreint par l'arc, authoring Inspector.
- **D3c step1 types fait & commité** (`ea290bc6`) : `mountSide` (= FireArc) sur `Weapon`+`ItemInstance`, propagé par `recomputeLoadout`.
- **crewedPenalty fait & commité** (`aa1e96ac`) : engine/crewedWeapon.ts — sous-effectif Arme d'équipe (MDG ch.12 l.448-460), GÉNÉRAL sol+naval.

**MODÈLE VALIDÉ (spec `docs/combat-naval-modele.md`, commit `ea07cea9`) — corrige mon esquisse :**
- Une pièce SERVIE (Arme d'équipe) = concept GÉNÉRAL **sol + navire** ; le poste naval = spécialisation
  « montée sur une coque ». Le cas héros-équipé (`de595ce8`) reste intact.
- La pièce appartient au **SUPPORT** (coque / affût au sol), PAS au servant (re-servable, survit aux pertes,
  Critique « Canon perdu »). « **Servir la pièce** » = une source d'`availableAttacks` (PAS l'arme équipée).
- Arme d'équipe multi-servants : Indice = équipage requis (qualité `arme-d-equipe`) ; recharge = effort
  d'équipage (Soutien LDB sur le Test étendu existant) ; chef de pièce nominé ; Incident → tous les servants.
- **Arc + portée INTRINSÈQUES à `availableAttacks`** (UN endroit pour réticule/clic/IA ; `inFireArc` général,
  cap du support). Tourner le navire re-mappe tous les arcs.
- Navigateur DISPONIBLE (Playwright MCP + `__wfrp`, dev server `npm run dev`) — recette en combat MANUEL.

**Décision A actée (kind-agnostique) :** le canon = arme DÉRIVÉE taguée `mountSide` sur le chef de pièce (comme
un tentacule : dans `weapons`, hors inventaire ; vérité = `hull.postes`). Tir = chemin d'arme normal → réutilise
tout (réticule/clic/IA). « servir la pièce » comme attaque SÉPARÉE (pure-B) écartée : forke la résolution.

**Commits intégration :** `aa1e96ac` crewedPenalty · `3a2a9ae1` helpers d'arc (shipOfCrew + mountedWeaponBears,
PURS kind-agnostiques) · `df4cfc78` garde d'arc dans `firedAttackBlock` (réticule+clic, raison `arc`, INERTE
tant qu'aucune arme n'a `mountSide`).

**✅ TIR EN BORDÉE (arc) COMPLET & PROUVÉ bout-en-bout** (`b7e1b439` mannedPoste + `3e3a9d26` test intégration) :
`Combatant.postes`/`mannedPoste` (engine/types) + recomputeLoadout dérive le canon (mountSide) du poste servi
(comme un tentacule, hors inventaire) → `firedAttackBlock` renvoie `arc` hors-bordée. SUITE COMPLÈTE 5758 VERTS
(la parité traits pré-existante est repassée verte upstream). Régression navigateur OK (tir normal propre, 0 console).

**✅ CHAÎNE D'AUTHORING COMPLÈTE** (`de1746f9` applyShipPostes, `b997b046` câblage) : `postes` traverse
`AuthoredEnemy`→`SceneEntity`→`SpawnExtras`→spawn pose `hull.postes` ; `startCombat` appelle `applyShipPostes(all)`
→ sert chaque poste à son chef (mannedPoste) + OCTROIE le canon dérivé via `mannedPosteWeapon` (builder PARTAGÉ
recompute héros / octroi statbloc ennemi → kind-agnostique). Un poste est ÉDITABLE sur un navire. Suite 5760 verts.

**RESTE :** A) **scénario 🧪 party-sur-navire** + recette navigateur VISUELLE (aligner bordée, tirer) — NB : ne pas
toucher `25-bataille-navale.ts` (WIP parallèle), créer un nouveau ; B) **Inspector** (édition postes) ;
C) **IA** : même prédicat `mountedWeaponBears`
dans `ai.ts` (canon ennemi aussi arc-restreint) ; C) **recharge d'équipe** (Soutien sur poste) ; D) **batterie** D3e ;
E) **flux manœuvre** D3b (tourne le Dir8 → re-mappe les arcs) ; F) abordage/distribution D3g + Critiques canon sur
`hull.postes` ; G) **scénario 🧪 party-sur-navire** (recette navigateur visuelle : aligner la bordée, tirer).

**Réutilisation vérifiée (question user) :** le concept rôles+Test d'équipage est RAW-spécifique **MDG ch.14**
— ABSENT du Compagnon de Mort sur le Reik (qui n'a que Personnage à la barre + Soutien LDB, déjà au moteur
via `partyAssisted`) et d'Aux Armes (n'apporte que l'Atout « Arme d'équipe », utile à D3c). Le « Personnage à
la barre / Test de Navigation Voile-Ramer » EST partagé fluvial↔maritime → garder D3b/D3c **book-agnostic**.

**Post-review (2026-06-25, commits `40a60ee4` + `9674a9bc`) :** revue du module → 3 correctifs RAW/cohérence.
(1) `bestHelmsman` ne désigne qu'un marin APTE (via `exposedCrew`). (2) `maneuverShip` CONSOMME enfin
`placementPenalty` (poids des pièces/bord vs Contenance, −M/−Man/−DR ; était testé mais inerte). (3) **`crewedPenalty`
branché AU TIR** : nouveau `crewedFireWeapon(weapon, present)` (engine) bake les Défauts effectifs (recharge ×2 /
Imprécise / Dangereuse) ET **retire** `arme-d-equipe` → l'hypothèse « toujours solo » de `dispatch.crewedTeamIndice`
(ex-`crewedSoloIndice`, désormais EXPORTÉ) ne se cumule plus ; effectif COMPLET = tir net. `servingCrewPresent(chef,
combatants)` (state). Seam UNIQUE = `firedWeapon(...,combatants?)` (aperçu+résolution+modale+**re-jet** Chance/Résilience)
+ recharge dans `combatSlice`. Le −10 si l'arme possède DÉJÀ le Défaut ajouté (l.460, commit `579c7756`) est baké
en `Weapon.crewedTohitPenalty` et surfacé par `attackModifiers` → **`crewedPenalty` RAW-complet**. Sous-systèmes
purs encore SANS point d'entrée jouable : `resolveBattery` (D3e) et la commande HUD « Manœuvrer » (`maneuverShip`).

**Manœuvre JOUABLE (2026-06-25, commit `a66e3c28`) :** flux différé `shipManeuver` (calqué sur `focus`/`run`) +
modale `ShipManeuverModal` (RollFlowShell + OptionChooser 5 virages) + bouton HUD « Manœuvrer » (gate `shipOfCrew` +
`!battle.acted`, coûte l'Action). `maneuverShip` SCINDÉ : `rollShipManeuver` (PUR) / `applyShipManeuver` (vire+avance).
Init du cap au spawn DÉJÀ fait (`faceAtCombatStart` lit `SceneEntity.facing`). Recette navigateur OK (0 console).
Gating d'influence = RAW (relance/Pacte/Résilience = échec seulement ; +1 DR toujours) — NE PAS rendre Pacte/Résilience
visibles sur un succès (règle maison écartée, RAW prime).
**Fix RAW réussite du virage (commit `100ccf47`) :** la réussite de la manœuvre = réussite du **Test de Navigation
(d100 ≤ cible)**, PAS `dr ≥ 0`. Étude : le **Man est un modificateur de DR** (MDG ch.12 l.48-50, stat-bloc « −1 DR »
l.92/94, Peu maniable l.173), pas de difficulté → il échelonne le DR (mouvement via Progression ch.13 l.68-75 +
IC de collision), il ne bascule pas la réussite (ch.13 l.304 « virement de bord = Test réussi… en cas d'échec, le
bateau se déplace normalement, sans bonus »). `deriveManeuver.success = nav.success`. Scénario démo `26-manoeuvre-navale`
NON commité (rend un VIDE noir — terrain `eau` + échelle-personnage → le LOOK naval = couche Mer §3.5, différée).

**COUCHE MER ⇄ PONT (chantier 2026-06-25, plan velvety-puzzling-kettle, scope MAXIMAL choisi par le GM : navire-unité
+ abordage couplé).** 5 phases A/B/C/C′/D. **Phase A committée** (`380d4a95` `Scene.metresPerTile`=10 ; `7c0b23b4`
empreinte navire DÉCOUPLÉE de la Taille créature — cf. [[game-footprint-taille-decouplage]] : `ship.footprint` autoré,
`footprintN`, plus de Peur de Taille parasite). **Phase B sub-step 1 committé** (`37f6b190`) : à l'échelle MER, l'ÉQUIPAGE
d'une coque est PASSAGER (hors `battle.order`) — `isPassengerInBattle`/`combatOrder` PUR, gate `isMerScene` (case ≥ 4 m,
proxy de la couche Mer). RESTE Phase B : router le HUD sur le NAVIRE à son tour (Manœuvrer/Bordée/Éperonner), `shipAI`.
Scénario démo `26-mer-ouverte` (terrain `eau`, footprint 3) gardé LOCAL (bancal sans le HUD navire).

**Phase B FINIE + committée (`59f310f5`)** : HUD navire jouable (`ActionBar` branche `isShip` via `isVehicle(c)` —
prédicat NOMMÉ source unique ; le gate de rendu des slots testait `isHero` seul → corrigé `isHero||isShip`) ;
`battleShipManeuver` accepte le navire ACTIF (barreur dérivé `shipHelmsman`) ; **équipage abstrait au RENDU**
(IsoStage skip `isPassengerInBattle` → plus de jeton-marin sur la mer) ; scénario `26-mer-ouverte` committé
(crewIds = TOUT le groupe → frise = 2 navires). Crash corrigé : un actif SANS arme (navire) plantait
`outOfSightTargetIds`/`eligibleAttackTargetIds`→`previewAttack`→`.type` → garde PARTAGÉE `activeHeroAttacker`
(par CAPACITÉ « a une arme », pas par type). Recette navigateur OK (navire = acteur, 0 jeton-marin, Manœuvrer → modale).

**COUCHE « gérer mon navire » / 50 marins — P1-P3 FAITS & committés (2026-06-25, session énorme).**
- **P1** (`7bc571f`) : `Combatant.shipRole` + `setShipRole` (store) + `defaultCrewRole` (engine/crewMorale, rôle inféré
  par AVANCES : spécialiste→son rôle, généraliste→**Mousse** l.15, sinon null) + `state/shipCrew.ts`
  `shipCrewAssignments(ship,combatants,testTypeId)` (MULTI par rôle) + `shipMoraleScore` (pont campagne→combat). +
  doc fix : modale MULTI ajoutée à la table primitives CLAUDE.md — cf. [[game-multi-roll-modal-primitive]].
- **P2 → FICHE DU NAVIRE** (retour GM : la gestion va sur LA FICHE, pas un volet de droite « cassé ») : `ShipSheet.tsx`
  ouverte en cliquant le portrait du navire (ajouté au dock). **PAR RÔLE** : « Armes/postes » + « Rôles » (chaque rôle
  = équipage en PORTRAITS via `PortraitPicker`, plusieurs par poste ; survol→✕ retire ; +assigner) + pool « disponible ».
  Ancien volet `ShipRolesPanel` supprimé.
- **P3** (`80bb62c6`, fix `4b526d81`) : manœuvre = Test d'équipage via le flux MULTI existant (`makeRollFlow spec.multi`
  + `ParticipantRow` + patron `ForceDoorModal`). `pendingShipManeuver`=MultiPending ; `maneuverCrewTotal`/
  `deriveManeuverFromCrew` (Σ DR essentiel×2 + Moral ; **virage si DR final ≥ 1**, ch.14 l.13 — règle d'ÉQUIPAGE,
  distincte du `dr≥0` barreur-unique) ; `rollCrewRole`/`forceCrewRole`. **UN jet par POSTE** (RAW l.39 « les PJ
  représentent tout l'équipage » → les marins PNJ ne testent PAS chacun ; un PNJ ne teste QUE pour un poste sans PJ,
  et UN seul, l.41 ; plusieurs PJ au même poste OK, l.9).
- **Coquille `MultiRollShell`** EXTRAITE (retour GM : ne pas recoder le HTML d'une modale multi à chaque flux) —
  `ForceDoorModal` ET Manœuvre y passent. + Résilience PRÉ-jet dans `ParticipantRow` + « Tout lancer » (`onRollAll`) —
  primitives PARTAGÉES (`97d5cc84`).
- **(a) défaut d'assignation GLOBAL FAIT & commité (`a439b22c`)** : `shipDefaultRoles(crew,testTypeId)` (shipCrew.ts) —
  remplit l'ESSENTIEL d'abord avec le meilleur marin FORMÉ, puis les autres postes spécifiques (UN titulaire = on ÉTALE),
  reste → Mousse (l.15) ; épinglés respectés (multi l.9). FICHE + Test PARTAGENT cette fn. Vérifié : 2 PJ étalés
  (Capitaine + Chansonnier) + Timonier essentiel rempli par un marin. `BENCHED='repos'` déplacé dans shipCrew.
**RAW (le GM m'a rattrapé 2× — il délègue le RAW, vérifier MÊME ses affirmations) :** multi-par-poste = l.9 ; PJ
représentent l'équipage = l.39 ; Mousse rôle par défaut = l.15. Cf. [[feedback-source-user-claims]].

**BORDÉE jouable — EN COURS (plan `velvety-puzzling-kettle.md`, approuvé). Modèle RAW LU & tranché (ch.13-14) :**
- **Dégâts** par pièce = arme + **DR partagé** (le Test d'équipage Artilleur ★ remplace le jet de chaque pièce, ch.14
  l.128 « pour le meilleur et pour le pire ») − BE coque − blindage ; **plancher 0** (ch.13 l.569/605, DR négatif → réduits/nuls).
- **Localisation** = **1d100** (ch.13 l.571 « inversez le jet OU lancez 1d100 » — pas de jet de touche par pièce).
- **Critique** : ce 1d100 SUBSTITUE le jet de touche → **double dessus = Critique** (ch.13 l.656) ; + tout coup quand Blessures coque = 0.
- **Économie d'action** : combat naval RAW ABSTRAIT (pas de tour tactique) → adaptation = **2 jetons** (manœuvrer ET tirer,
  équipages parallèles ch.14 l.37) ; PAS une ligne RAW dure → adaptation fidèle assumée.
- **✅ Moteur `resolveVolley` (engine/volley.ts) FAIT + 4 tests + commité `a273b201`** : PUR, ne mute rien ; RÉUTILISE
  effectiveWeaponDamage/effectiveChar/effectiveArmourAt/shipHitLocation/mannedPosteWeapon — zéro nouvelle formule.
**✅ RÉSOLUTION + MODALE FAITES + commitées `03f11356` + VÉRIFIÉES navigateur** (la coque ennemie encaisse 4 PB, modale
rend cible+pièces+Résilience pré-jet+Tout lancer hérités) : (1) `crewTestContributors(ship,combatants,testTypeId,partyIds)`
EXTRAIT vers shipCrew.ts (PARTAGÉ manœuvre+bordée, battleShipManeuver refactoré) ; (2) `PendingShipBattery`/`ShipBatteryParticipant`
(pendings) + `FLOWS.battery` (rollFlows, réutilise rollCrewRole/forceCrewRole) + ligne `battery` (modalArbiter) + enregistrement
(stateFields/store) + `rollFlowActionsMulti('shipBattery'…)` ; (3) `battleShipBattery(shipId,targetId)`/`shipBatteryConfirm`/
`shipBatteryCancel` (combatSlice) : DR partagé `maneuverCrewTotal` → `resolveVolley` → `target.wounds.current -= totalWounds`
+ `applyCriticalToTarget` par double + `get().log(t('cs.bordee'…))` (NARRATION AU CATALOGUE i18n fr.ts — combatSlice EST guardé
Phase C, get().log littéral FR interdit ; manœuvre y échappe car elle logue dans shipManeuver.ts NON guardé) + `checkBattleOver` ;
(5) `ShipBatteryModal.tsx` (clone ShipManeuverModal) + registre ActiveModal. Suite 5947 verte (ship-battery flux bout-en-bout).
**✅ (4) ENTRÉE JOUEUR FAITE + commitée `790c31b5` + VÉRIFIÉE navigateur bout-en-bout** (tour navire → bouton → interlude →
clic ennemi réticule « Bordée proue » → modale → Feu ! → coque encaisse ; 0 erreur console) : `battle.action='battery'`
(ajouté au type, via `battleSelectAction`) ; `ActionBar` `isShip` bouton « 🎯 Bordée » (si `active.postes.length>0`) +
interlude de ciblage (patron Frappe Mortelle, « Désignez le navire à canonner — bord auto » + Annuler=selectAction(null)) ;
`targeting.ts hoverTargeting` branche battery (réticule si pièce du bord porte + à portée via metresPerTile, ⛔ `'arc'`/`'range'`) ;
`battleClickEntity` branche battery → `battleShipBattery` (bord dérivé `targetArc`). La bordée NE consomme PAS le tour →
re-déclenchable = MULTI-CIBLES (RAW du GM vérifié ch.14 l.128 : « Plutôt que de lancer pour CHAQUE canon » → tir canon-par-canon
= défaut, bordée = alternative all-on-one ; viser 2 navires = 2 bordées, un bord chacun, le bord s'auto-dérivant).
**LA BORDÉE EST JOUABLE À LA SOURIS.** Suite 5947 verte.
**⚠️ AUDIT ADVERSARIAL (2026-06-25) → REFONTE RAW R1-R3 (commits `3e4d9304`/`09b4b77b`/`84597005`, fiche `4d458b66`).** La
bordée jouable VIOLAIT le RAW sur 5 points, tous issus d'UN choix structurel : `resolveVolley` ré-implémentait son propre
calcul de Dégâts EN PARALLÈLE du tir individuel (larguait munitions/sous-effectif/qualités). **Fiche de référence créée AVANT
de coder : `docs/raw/combat-naval.md`** (cf. [[feedback-raw-reference-doc-before-impl]]). GM a tranché : **arc 3 octants gardé**,
**cumul AUTORISÉ à −2 crans**. Refonte :
- **R1** : `resolveVolley` orchestre les MÊMES fns AGNOSTIQUES que le tir individuel — `weaponWithAmmo` (munition du chef) +
  `crewedFireWeapon` (sous-effectif) + `attackDRAdjust`/`effectiveWeaponDamage`/`qualitySum` + `woundsFromHit` (BE/blindage/
  **Perforante**/bypass). `woundsFromHit` reçoit `minWounds=1` (additif ; navire passe **0**). Critique = double OU coque à 0.
  **`applyHit` ÉCARTÉ** (lié au modèle HUMAIN : `hitLocationByShape` + plancher 1) ; on GARDE la localisation/Critique NAVIRE.
- **R2** : `ShipPoste.reloadUntilRound` ; `bearingPostes(ship,side,round)` = filtre UNIQUE « bord qui porte ET chargé »
  (battleShipBattery + shipBatteryConfirm + targeting). Pièce tirée muette N Rounds (×2 sous-effectif). Modèle « N Rounds »
  = approx du Test étendu de recharge (refinement noté).
- **R3** : `battle.crewActed` (par navire, reset `enterRoundStartPause`) ; un marin qui fait manœuvre PUIS bordée le même Round
  → cumul **+2 crans** (`rollCrewRole(cumul)` → `easeDifficulty(-2)`, réveille la plomberie morte `doubleRole`). `withCrewActed`
  (shipCrew, dédup). Modale : « ⚠ −2 (cumul) ». **Ferme les trous d'audit #1/#2/#3/#5 (✅) + #4/#6 partiels (⚠️).**
Suite **5953 verte**. **Vérifié navigateur `bataille-navale`** : bordée 2 Pierriers (coque 50→42, « pour le pire » a réduit,
double → Critique Cabestan + Éclats), reload=5 (Round 1+Recharge 4), crewActed peuplé ; **0 console**.
**RESTE bordée (HORS PÉRIMÈTRE noté) :** munitions à ZONE (Explosion/Tir de zone, multi-cibles) ; Dangereuse→Incident (réutiliser
`rollOups`) ; qualités à chiffre des unités (Percutante/Dévastatrice/Empaleuse) en bordée ; Manque de bras GLOBAL (−2 DR plafond,
tranche 10 %, ≠ d'une pièce) ; picker de munition par poste + approvisionnement navires ; **IA navale** (réutilise resolveVolley) ;
overlay d'arcs SVG + anim de volée.
NB combatSlice→combatFlow = sens UNIQUE (pas de cycle). `applyCriticalToTarget(target,loc,isCrit,overkill,log,set,chosenLoc?,ctx?,
prerolled?,suppressReveal?,get?)` — ATTENTION 11 args (chosenCritLocation AVANT ctx). get().log → journal EXPLORATION (pas battle.log
combat-feed) — comme la manœuvre ; remonter au combat-feed (ev/battle.log) = polish commun.
Bug séparé NON naval noté : monture/cavalier désync de POSITION (RAW LDB 14 l.179, le cavalier utilise le Mouvement
de sa monture) — fix côté mouvement, pas en fusionnant les tours.

**LEÇON RAW (le GM m'a rattrapé) :** j'avais généralisé « passager » aux MONTURES — FAUX. RAW « Combat monté » LDB 14
l.182 : « une monture sans le Trait Nerveux est **un autre combattant à part entière**, et peut effectuer **sa propre
Action** » → une monture GARDE son tour ; l.179 : le cavalier utilise le **Mouvement de sa monture**. Donc navire-équipage
(abstrait, MDG ch.14) ≠ monture (combattant distinct, LDB) — la spécificité naval est RAW-justifiée, pas arbitraire. La
désynchro monture/cavalier signalée par le GM = bug de SYNCHRO DE POSITION/Mouvement (l.179), à corriger côté mouvement,
JAMAIS en fusionnant les tours. **Bugs multi-cases signalés (thème) :** (a) grande créature « une seule case attaquable »
(ciblage — touchera les navires footprint 3) ; (b) monture/cavalier désync de position. Réflexe : VÉRIFIER le RAW avant
d'affirmer (cf. [[feedback-source-user-claims]], [[game-no-mj-model-everything]]).

**Fait de contexte :** je suis **le seul à travailler le naval** sur `feat/wfrp4-rpg-foundation`. L'autre
session est laxiste et balaie dans SES commits des fichiers qui ne sont pas les siens (c'est ainsi que mes
`crew-roles.json` d'une session passée se sont retrouvés commités orphelins). → committer mes fichiers naval
**scopés** (`git commit -- <chemins>`) sous mon propre message ; ne PAS sur-investiguer de « collisions ». Voir [[git-commits-propres-wip-parallele]].

Pré-existant NON naval : `engine/traits/parity.test.ts` rouge (commit `b0cd965b` a ajouté 5 traits EDO sans les enregistrer dans les sets de couverture).
