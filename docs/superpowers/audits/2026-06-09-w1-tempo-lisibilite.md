# Audit lisibilité combat — W1 (tempo / mouvement / attaque-défense / file de modales)

Problèmes confirmés : 26

## Findings confirmés

### [majeur] (Ouverture & tempo du combat) Aucun plan d'ensemble du champ avant le 1er jet — la modale Initiative recouvre le plateau dès l'ouverture
- **Symptôme**: « modale-sur-modale sans voir le champ de bataille ; ça démarre DIRECT sur INITIATIVE ». À startCombat, le tout premier élément à l'écran est la modale Initiative, dont l'overlay assombrit tout le plateau.
- **Cause**: startCombat (store.ts:1609-1619) empile une RevealEntry 'Initiative' juste après set({battle,mode:'battle'}). RevealModalView (RevealModal.tsx:14) la rend dans un .modal-overlay position:fixed inset:0 background rgba(0,0,0,.6) (styles.css:254-261) → le champ EST rendu derrière (IsoStage, CampaignView.tsx:102) mais voilé et non lu. Aucune phase « Début du Round / vue de la situation » n'est jouée avant. Le RAW l'exige pourtant : « Le MJ va devoir décrire la situation – où chacun se trouve et à quoi ressemble votre environnement immédiat […] vous aider à préparer votre plan d'action » (LDB 13 l.86) et le résumé du combat met explicitement une étape « 2. Début du Round » AVANT « 3. Les Personnages effectuent leur tour » (LDB 13 l.26-28).
- **Preuve**: src/state/store.ts:1606-1621 ; src/ui/RevealModal.tsx:14-38 ; src/ui/styles.css:254-261 ; src/ui/CampaignView.tsx:101-117,141
- **RAW**: LDB 13 l.86 ; LDB 13 l.26-28
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Direction confirmée et précisée. Matérialiser l'étape « Début du Round » du RAW (LDB 13 l.26) en une PHASE D'OUVERTURE LISIBLE, non bloquante :

1) À startCombat (store.ts:1606+), NE PAS pousser d'emblée l'overlay plein écran. D'abord rendre le champ visible : la liste des combattants existe déjà (`order`/`all`, store.ts:1614-1617) — l'afficher comme étiquettes/halos sur les pions (camps colorés via teamColors.ts déjà livré, cf. lot 0 playtest) plutôt qu'en texte dans une modale.

2) Convertir l'« Initiative » d'un `.modal-overlay` plein écran (z-index:100, inset:0) en un panneau latéral / liste d'ordre persistante dans `BattlePanel` (déjà rendu, CampaignView.tsx:120) — l'ordre d'Initiative est une info de référence permanente, pas un jet ponctuel ; il n'a pas besoin de bloquer la vue. Garder éventuellement les `surpriseLines` en bandeau non-modal cadré sur le plateau.

3) Si une confirmation d'ouverture est souhaitée (« Lancer le combat »), la rendre dans une carte cadrée laissant voir les deux camps (pas inset:0 noir à 60 %), p.ex. réutiliser le pattern `RoundStartModal` (qui montre déjà l'ordre + permet la Chance) mais ÉLARGI à l'ouverture du round 1 : poser `pendingRoundStart:{round:1}` à startCombat plutôt qu'un reveal — cela donnerait gratuitement (a) l'affichage de l'ordre, (b) le 3ᵉ usage de la Chance au tout 1er round (actuellement indisponible au round 1), (c) une étape « Début du Round » conforme RAW. Vérifier alors que `confirmRoundStart` (store.ts:2324) enchaîne bien sur `maybeRunEnemyTurn`.

4) Découpler clairement « Initiative = info persistante (panneau) » de « Surprise = événement à acquitter une fois » pour cesser le modale-sur-modale.

GARDE-FOU : `maybeRunEnemyTurn` bail sur `pendingReveals.length` (combatFlow.ts:1837) — si on retire la révélation Initiative au profit d'un panneau, s'assurer qu'une autre garde (pendingRoundStart) empêche l'IA de jouer avant que le joueur ait vu le champ, sinon on réintroduit la « téléportation » à l'ouverture.

### [majeur] (Ouverture & tempo du combat) Perte d'initiative = l'IA agit sans aucun préavis ni télégraphe d'intention en mêlée
- **Symptôme**: « Si on perd l'initiative : le 1er ennemi se téléporte sur toi […] puis une modale de DÉFENSE surgit sans contexte (qui ? d'où ? a-t-il chargé ?) ». Aucune transition « c'est le tour de l'ennemi » n'est jouée.
- **Cause**: Après dismissReveal, si l'acteur actif est un ennemi, maybeRunEnemyTurn enchaîne directement (store.ts:2762-2769 → combatFlow.ts:1835-1841, setTimeout 450ms → runEnemyAI). Le déplacement (move) émet ANIM_MOVE et arme l'attaque à 350ms (combatFlow.ts:2175,2191) ; pour le TIR il existe un télégraphe enemyAim de 750ms (combatFlow.ts:2128-2130, réticule), mais pour la MÊLÉE il n'y a AUCUN télégraphe d'intention/cible avant l'ouverture de la défense. Rien n'annonce « tour de l'ennemi X » côté UI. Le RAW décrit le combat comme une expérience que le MJ doit DÉCRIRE (qui agit, d'où) avant la réaction (LDB 13 l.83-86).
- **Preuve**: src/state/store.ts:2762-2769 ; src/state/combatFlow.ts:1835-1841,2160-2192,2083-2098,2123-2131
- **RAW**: LDB 13 l.83-86
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Trois leviers ciblés, par ordre d'impact :

1) TÉLÉGRAPHE DE MÊLÉE (parité avec le tir). Avant attackThenAdvance en mêlée, poser un état d'« intention de mêlée » analogue à enemyAim (combatFlow.ts:2128) : une flèche/ligne attaquant→cible + halo sur la cible, ~500-700ms, rendue dans IsoStage (réutiliser le bloc targeting 457-464). À armer aussi bien dans case 'melee' (2133) que dans case 'move' juste avant attackThenAdvance (2191).

2) SYNCHRONISER L'OUVERTURE DE LA MODALE À LA FIN DE LA GLISSE. Remplacer le 350ms fixe (combatFlow.ts:2098) par max(350, walkDuration = path.length × STEP_MS) pour le cas 'move', afin que la défense n'apparaisse qu'une fois le pion arrivé au contact — supprime la perception de téléportation. (Ne pas toucher au cas mêlée déjà-adjacent.)

3) NE PAS OBSCURCIR LE CHAMP. La DefenseModal est un overlay centré opaque (DefenseModal.tsx:37) : la rendre non-modale/translucide ou la décaler en panneau latéral pour que la position de l'attaquant (et son éventuel pictogramme « a chargé » — chargedThisTurn existe déjà, combatFlow.ts:2188) restent visibles derrière. Afficher dans la modale un indice « Charge » quand attacker.chargedThisTurn.

NB : ne PAS prétendre « il n'y a pas de bannière de tour » — elle existe (BattlePanel turn-banner). Le travail porte sur le télégraphe spatial + la synchro d'animation + la visibilité du champ pendant la défense.

### [majeur] (Ouverture & tempo du combat) La modale de défense peut s'ouvrir pendant que le pion glisse encore (collision tempo)
- **Symptôme**: L'ennemi « bouge mais c'est si rapide qu'on ne perçoit rien », puis la défense surgit — l'animation de déplacement et la demande de défense se chevauchent.
- **Cause**: Le 'move' IA lance une glisse rAF de durée (path.length-1)*160ms (IsoStage.tsx:47 STEP_MS=160, walkPath.ts:21) mais arme l'attaque à 350ms fixe (combatFlow.ts:2191) puis +350ms dans attackThenAdvance (2084) ≈ 700ms. Pour une approche ≥5 cases la glisse (≥640-800ms+) n'est pas finie quand la modale de défense (.modal-overlay plein écran) s'ouvre et VOILE le plateau → la fin du mouvement est masquée. La cadence d'attaque n'est pas synchronisée sur walkDuration du chemin réellement parcouru.
- **Preuve**: src/state/combatFlow.ts:2169-2192,2083-2098 ; src/gameIso/IsoStage.tsx:47,141-164,355-363 ; src/gameIso/walkPath.ts:21-23
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Synchroniser l'ouverture de l'attaque/défense sur la FIN RÉELLE de la glisse plutôt que sur un délai fixe. Concrètement :

1) Remplacer, dans le case 'move' (combatFlow.ts:2160-2193), le setTimeout(350) de attackThenAdvance par une attente = walkDuration(path, STEP_MS) + petite marge (« il vient d'arriver au contact » ~120-200 ms) AVANT d'appeler doAttack/maybeOpenDefense. attackThenAdvance prend déjà la cible en argument ; lui passer le délai calculé (ou un paramètre delayMs) plutôt que le 350 codé en dur.

2) Source unique de la durée : exporter STEP_MS (ou un helper walkDelay(path)) depuis walkPath.ts et le réutiliser dans combatFlow ET les 3 hooks d'anim, pour supprimer le 160 dupliqué et garantir que combat et rendu partagent la même horloge. Idéalement, émettre un évènement « fin de marche » sur le bus (à la suppression de walksRef dans IsoStage.tsx:152) que l'IA attend, ce qui couvre aussi les futures variations de cadence (taille, monture) sans recalcul.

3) Garder le délai fixe (350) UNIQUEMENT pour le case 'melee' sans déplacement (l.2133-2135) et le tir (l.2123-2131, déjà télégraphié à 750 ms) — eux n'ont pas de glisse.

4) Bonus lisibilité (le symptôme « il se téléporte puis la défense surgit sans contexte ») : ne PAS voiler immédiatement le plateau. Soit retarder l'overlay plein écran jusqu'à la fin de la glisse, soit alléger/retirer le fond `.modal-overlay` (rgba 0.6) de la DefenseModal pour laisser voir d'où vient l'attaquant, et marquer l'attaquant (halo/flèche d'origine, déjà fait pour le tir via enemyAim l.2128) afin que le joueur sache QUI charge et D'OÙ avant la demande de défense.

### [mineur] (Ouverture & tempo du combat) Glisse trop rapide et sans anticipation : un dash multi-cases lit comme une téléportation
- **Symptôme**: « il bouge mais c'est si rapide qu'on ne perçoit rien » / « se téléporte sur toi ».
- **Cause**: STEP_MS=160ms par tuile, linéaire, sans easing ni accélération de caméra/zoom sur l'acteur actif (IsoStage.tsx:47, walkXY linéaire walkPath.ts:8-18). Un déplacement de Marche M (souvent 4-5 cases) se fait en <1s, sans signal préparatoire, et la caméra ne suit pas l'acteur ennemi. Combiné au manque de surbrillance de l'acteur actif, le mouvement passe inaperçu.
- **Preuve**: src/gameIso/IsoStage.tsx:47,141-164,355-363 ; src/gameIso/walkPath.ts:8-23
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Direction affinée (ordre de priorité d'impact) :
1. SÉQUENCER déplacement → attaque côté store : ne pas appeler attackThenAdvance synchronement à la fin du move (combatFlow.ts:2191). Attendre la fin RÉELLE du slide (walkDuration(path, STEP_MS), ~640ms) AVANT d'ouvrir la modale de défense, avec une petite pause de respiration. C'est le correctif #1 — il supprime la cause directe (modale qui coupe le slide à 350ms). Le delay de 350ms d'attackThenAdvance (l.2084) est trop court face au slide.
2. FAIRE SUIVRE LA CAMÉRA au pion qui bouge : caler le focus sur la position INTERPOLÉE (walkPosOf) pendant un ANIM_MOVE ennemi, pas sur active.pos logique déjà à destination (IsoStage.tsx:470-481). Optionnel : léger zoom-in sur l'acteur actif au début de son tour.
3. ANCRER LE HALO/STROKE ACTIF SUR LE PION, pas sur la destination : pendant le slide, dessiner la surbrillance d'acteur actif à walkPosOf au lieu de active.pos (corrige le marqueur qui attend à l'arrivée → casse l'illusion de téléport).
4. SIGNAL PRÉPARATOIRE AVANT le move (parité avec le télégraphe de tir existant enemyAim) : surligner fortement l'ennemi actif + flasher son chemin (tracé fantôme) ~300-500ms AVANT qu'il ne s'élance, et afficher « X charge » si chargeAdvantage>0.
5. EASING + cadence : passer walkXY d'un lerp linéaire (walkPath.ts:17) à un ease-in-out, et envisager un STEP_MS plus lent pour l'IA seulement (laisser le joueur « voir » qui vient). Secondaire une fois 1-4 faits.

### [mineur] (Ouverture & tempo du combat) Première modale (Initiative) n'enseigne rien d'actionnable : densité de modales à l'ouverture
- **Symptôme**: « modale-sur-modale » : la 1re modale (Initiative) ne fait que lister des nombres, puis (perte d'initiative) une 2e modale (Défense) surgit aussitôt après fermeture — deux interruptions avant que le joueur ait rien compris.
- **Cause**: Conception « un jet = une modale » appliquée à l'Initiative (store.ts:1608-1619, commentaire l.1608) : un jet purement informatif (ordre) est promu en interruption plein écran bloquante, gardant l'IA en pause (maybeRunEnemyTurn no-op si pendingReveals, combatFlow.ts:1837). Résultat : la séquence d'ouverture = [modale Initiative] → [clic] → 450ms → [glisse] → [modale Défense], deux overlays consécutifs avant le moindre repère spatial.
- **Preuve**: src/state/store.ts:1606-1621,2759-2771 ; src/state/combatFlow.ts:1835-1841 ; src/ui/RevealModal.tsx:41-46
- **RAW**: LDB 13 l.26-28
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Sortir l'Initiative du flux de modales bloquantes. Concrètement : (a) ne plus `pushReveal` l'Initiative dans startCombat (store.ts:1608-1619) ; matérialiser l'ordre de tour en frise/HUD persistante (un bandeau d'initiative listant les combattants dans l'ordre, acteur actif surligné), affiché DÈS l'ouverture sur le champ de bataille visible. (b) Réserver les overlays plein écran aux vraies décisions (Défense, Chance/Résilience). (c) Tempo d'ouverture : avant de laisser l'IA ennemie agir (le setTimeout 450ms de combatFlow.ts:1840), laisser au joueur un battement pour voir le champ + la frise (p.ex. une courte phase « le combat commence » non-modale, ou un délai/anim de cadrage caméra sur l'ennemi qui va agir). (d) Quand la modale de Défense surgit après une perte d'initiative, l'enrichir du contexte spatial manquant (qui attaque, depuis où, a-t-il chargé ?) — sinon le retrait de la modale Initiative ne fait que déplacer la confusion. Ces points (c)/(d) débordent le finding strict mais voyagent avec le symptôme « tout va trop vite / défense sans contexte » et devraient être traités dans le même lot.

### [bloquant] (Rendu du mouvement (téléportation perçue)) La modale de défense s'ouvre AVANT que l'ennemi ait fini de marcher (delai fixe 350 ms vs marche 640-1120 ms)
- **Symptôme**: L'ennemi « se téléporte sur toi » puis une modale de défense surgit sans contexte (qui ? d'où ? a-t-il chargé ?).
- **Cause**: Dans runEnemyAI, le move au contact enchaîne sur attackThenAdvance qui fait setTimeout(doAttack, 350) (combatFlow.ts l.2191 → l.2084,2098). Or l'anim de marche dure (path.length)*STEP_MS avec STEP_MS=160 (useRigAnim l.67, usePlanAnim l.53, walkPath.walkDuration). Pour une approche de 4-7 cases la marche dure 640-1120 ms : la modale de défense (maybeOpenDefense l.970) s'ouvre à 350 ms, donc pendant que le token glisse encore. Le joueur voit la modale alors que l'attaquant n'est pas perçu comme arrivé. Le délai 350 ms est CONSTANT, indépendant de la longueur réelle du trajet.
- **Preuve**: C:/Users/gauch/PhpstormProjects/Foundry/Game/src/state/combatFlow.ts:2084-2098,2160-2193; C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/useRigAnim.ts:62-72; C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/usePlanAnim.ts:50-55; C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/walkPath.ts:21-23
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Synchroniser l'ouverture de la défense sur la FIN du glissement visible, pas sur un délai magique de 350 ms.

Concrètement, dans la branche `case 'move'` au contact (combatFlow.ts:2191), passer la durée réelle du trajet à `attackThenAdvance` : `const moveMs = walkDuration(path, STEP_MS)` (= `(path.length-1)*160`, exactement la valeur qu'IsoStage utilise déjà l.152/361). Faire de `attackThenAdvance` un paramètre `delayMs` (défaut 350 pour les attaques sans déplacement préalable : branches 'melee' l.2135, 'shoot', cavalier l.2108) et l'utiliser à la place du 350 codé en dur dans son `setTimeout` (l.2084,2098). Ainsi : pas d'approche → 350 ms inchangé ; approche de N pas → la modale s'ouvre à N*160 ms, après l'arrêt du pion.

Garantir en plus un BEAT DE PRÉSENCE court (≈150-250 ms) APRÈS la fin du glissement et avant la modale : l'attaquant immobile, déjà orienté vers la cible (l'orientation est posée par `faceFromPath` l.2173, donc déjà correcte). Cela donne au joueur le temps de percevoir « qui est arrivé, d'où, et qu'il a chargé » (l'Avantage de charge est déjà calculé l.2184). Implémentable comme `delayMs = moveMs + PRESENCE_MS`.

Alternative plus robuste à long terme : émettre/écouter un évènement `ANIM_MOVE_DONE` (le rAF d'IsoStage l.150-156 sait exactement quand un glissement se termine — il `delete walksRef.current[id]`) et n'armer `attackThenAdvance` qu'à sa réception, plutôt que dupliquer le calcul de durée des deux côtés. Cela évite toute dérive si STEP_MS ou la formule de durée changent dans un seul des deux fichiers (risque déjà présent : hooks d'anim en `length*STEP_MS` vs IsoStage/walkDuration en `(length-1)*STEP_MS`).

### [majeur] (Rendu du mouvement (téléportation perçue)) La caméra saute à la destination logique au lieu de suivre le trajet interpolé
- **Symptôme**: « Il bouge mais c'est si rapide qu'on ne perçoit rien » — le déplacement est imperceptible.
- **Cause**: Le focus caméra lit active.pos (IsoStage.tsx l.471-472), or enemy.pos est écrit instantanément à action.to (combatFlow.ts l.2170) AVANT l'anim. La caméra glisse donc vers la destination (transition transform 0.3s, l.594) pendant que le token, lui, part seulement de l'origine via walkPosOf (l.358-363). La caméra arrive avant le token et l'attend : le mouvement relatif token↔cadre est minimisé, d'où la sensation de téléportation. walkPosOf (interpolation existante) n'est jamais consulté pour le cadrage.
- **Preuve**: C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/IsoStage.tsx:466-483,357-363,594; C:/Users/gauch/PhpstormProjects/Foundry/Game/src/state/combatFlow.ts:2170
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Faire suivre à la caméra la position VISUELLE de l'acteur actif, pas sa pos logique. Dans le bloc focus (IsoStage.tsx:470-480), remplacer focus = active.pos par la position interpolée : const wp = walkPosOf(active.id, active.pos.x, active.pos.y); focus = wp; (focus doit alors accepter des coordonnées fractionnaires — tileCenter est purement arithmétique, donc OK). La rAF setWalkTick (l.146-164) re-rend déjà chaque frame pendant la marche → le focus se recalcule par frame et la caméra suit le trajet ; le token reste mobile dans le cadre, la marche devient perceptible. Garde-fous : (a) une fois la caméra qui SUIT le token, la transition CSS 0.3s sur le transform (l.594) va fighter avec la mise à jour par-frame (double lissage / traînée) — pendant une marche active (walk présent dans walksRef), désactiver/réduire la transition transform, sinon la caméra retarde encore de 0,3 s sur le token ; (b) n'appliquer le focus-visuel qu'au combattant ACTIF en marche, conserver le centrage destination au repos pour éviter une dérive ; (c) cohérent d'étendre au groupe (l.446) et à la monture (l.421) qui interpolent déjà. Recette navigateur (Playwright) : perte d'initiative → 1er ennemi qui s'approche, vérifier trajet visible et non « téléporté ». Ce correctif ne traite que la perception du MOUVEMENT, pas l'absence de télégraphe (qui m'attaque, d'où, a-t-il chargé) ni le démarrage direct sur Initiative — défauts de tempo voisins à traiter séparément.

### [majeur] (Rendu du mouvement (téléportation perçue)) Position logique fixée avant l'animation : tout (LdV, dégâts flottants, ciblage) voit l'ennemi déjà arrivé
- **Symptôme**: Le trajet est imperceptible et les chiffres/effets ne sont pas reliés au mouvement qu'on n'a pas vu.
- **Cause**: enemy.pos (et geom.pos pour la monture) est muté vers action.to en tête de case 'move' (combatFlow.ts l.2170-2171), puis SCENE_DIRTY re-render (l.2179). L'anim de marche (ANIM_MOVE) n'est qu'un placage visuel par-dessus un état déjà à destination. Conséquences en chaîne : la résolution d'attaque (resolveAttack l.508, combatDistance), la Ligne de Vue (lineOfSightCover l.520) et les floats de dégâts (IsoStage l.182-193, lit target.pos logique) opèrent tous sur la position d'arrivée — il n'existe aucune fenêtre où l'état logique correspond à ce que l'œil voit pendant le glissement. C'est la même logique pour le joueur (battleClickTile l.2215, charge l.2271) mais là le joueur a initié l'action donc le saut est moins choquant.
- **Preuve**: C:/Users/gauch/PhpstormProjects/Foundry/Game/src/state/combatFlow.ts:2167-2179,508-520; C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/IsoStage.tsx:182-193,533-540
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Garder le modèle état-logique-instantané + placage visuel (sain pour un moteur pur testable) ; cadencer la PRÉSENTATION sur la fin du glissement, comme le font déjà les floats (gating sur ANIM_IMPACT). Concrètement : remplacer le beat fixe setTimeout(350) de attackThenAdvance (combatFlow.ts:2084) ET la transition move→attaque (l.2191) par un délai DÉRIVÉ de walkDuration(path, STEP_MS) — le path est déjà calculé en 2169. Émettre un signal « glissement terminé » (ou passer la durée du chemin) pour n'ouvrir la modale de défense / le télégraphe qu'après la fin du glide, puis un court « settle » (~150-250ms) avant le télégraphe d'attaque. Idéalement centraliser une notion « durée d'animation en cours » consultée par le flux IA (move→beat→attaque→défense) pour bannir les constantes magiques découplées de la distance. Appliquer la même attente au gain d'Avantage de Charge et à approachFearTrigger pour qu'ils coïncident avec l'arrivée visuelle.

### [majeur] (Rendu du mouvement (téléportation perçue)) Aucun télégraphe d'approche pour une attaque de MÊLÉE (le réticule n'existe que pour le tir)
- **Symptôme**: La modale de DÉFENSE surgit sans contexte : on ne sait pas qui attaque, d'où il vient, ni s'il a chargé.
- **Cause**: enemyAim (réticule + ligne + cadrage des deux + délai 750 ms) n'est armé que pour l'action 'shoot' (combatFlow.ts l.2123-2131 ; rendu IsoStage l.459-464,602-619). Pour un move-au-contact-puis-mêlée, il n'y a AUCUN équivalent : pas de surlignage de l'attaquant, pas de ligne attaquant→cible, pas de pré-cadrage avant que pendingDefense s'ouvre (l.970). Le joueur passe d'un ennemi qui glisse à une modale de défense, sans le beat « X charge Y » montré à l'écran (le journal le dit, mais hors-champ visuel).
- **Preuve**: C:/Users/gauch/PhpstormProjects/Foundry/Game/src/state/combatFlow.ts:2123-2131,2191; C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/IsoStage.tsx:459-464,601-619
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Ajouter un télégraphe de mêlée symétrique à enemyAim, mais piloté par le tempo réel du glissement (pas un délai fixe). (a) Dans combatFlow.ts `case 'move'` (l.2160-2194), quand l'ennemi finit au contact, ne PAS lancer attackThenAdvance sur le setTimeout(350) fixe : attendre la fin du glissement = walkDuration(path, 160) AVANT d'enchaîner, sinon la modale surgit pendant la glisse (cause de la « téléportation perçue »). (b) Réutiliser le mécanisme enemyAim en le généralisant (le renommer logiquement en « ciblage ennemi », pas « tir ») : après l'arrivée, l'armer aussi pour la mêlée pour tracer attaquant→cible + cadrer les deux pendant ~400-600 ms AVANT `maybeOpenDefense`/pendingDefense, en plus d'un halo/ring transitoire sur l'attaquant déjà arrivé (distinct des anneaux d'identité permanents). (c) Si chargedThisTurn / gainedAdvThisRound, étiqueter le télégraphe « X charge Y » (l'info existe déjà l.2186-2188, juste non affichée). (d) Côté IsoStage.tsx:457-464/601-619, autoriser un style de télégraphe « mêlée » (trait plein court attaquant→cible + halo) distinct du réticule de tir, mais en réutilisant la même tuyauterie targeting/focus pour ne pas dupliquer le cadrage. Le rendu de la ligne devra suivre la position FRACTIONNAIRE du glissement (walkXY) si on télégraphie pendant l'approche, ou la position finale si on attend l'arrivée (option recommandée : attendre l'arrivée → moins de bruit visuel).

### [mineur] (Rendu du mouvement (téléportation perçue)) Désynchronisation des durées de marche entre les hooks d'anim et l'interpolation visuelle
- **Symptôme**: « Tout va trop vite » et le mouvement est saccadé/imperceptible.
- **Cause**: Trois conventions de durée coexistent pour la MÊME marche : (a) l'interpolation de position walkDuration = (path.length-1)*160 (walkPath.ts l.21-22, IsoStage l.152), (b) le clip rig/plan dure (path.length)*160 (useRigAnim l.67, usePlanAnim l.53) — soit une tuile de trop, donc le clip 'walk' tourne ~160 ms après l'arrêt du glissement, et (c) le move d'EXPLORATION avance d'une tuile toutes les 150 ms (IsoStage moveAlong l.578) alors que STEP_MS=160 pour l'interpolation, créant une dérive token-vs-pas. Ces écarts brouillent la lecture du trajet.
- **Preuve**: C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/walkPath.ts:21-22; C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/IsoStage.tsx:47,152,578; C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/useRigAnim.ts:13,67; C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/usePlanAnim.ts:10,53
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: 1) Source UNIQUE de durée : exporter STEP_MS + walkDuration(path) depuis walkPath.ts ; supprimer les trois littéraux STEP_MS=160 (useRigAnim.ts:13, usePlanAnim.ts:10, IsoStage.tsx:47) et le 150 codé en dur (IsoStage.tsx:578) ; tous les consommateurs importent la même valeur/fonction. 2) CORRIGER l'off-by-one (b) — bug réel : dans useRigAnim.ts:67 et usePlanAnim.ts:53, remplacer « length * STEP_MS » par « walkDuration(path) » (= (length-1)*STEP_MS), pour que le clip de marche s'arrête EXACTEMENT quand le glide s'arrête (fin des jambes-qui-marchent-sur-place). 3) Aligner le pas d'exploration (IsoStage.tsx:578) sur STEP_MS (160) au lieu de 150 — cosmétique mais retire la double cadence. 4) RE-CADRER l'objectif : ces correctifs nettoient un glitch « jambes persistantes » et une incohérence, mais NE résolvent PAS « téléportation perçue » / « tout va trop vite ». Pour ces symptômes, diagnostiquer séparément : (i) l'IA/combatFlow attend-elle la fin du glide (≈ walkDuration) avant ANIM_ATTACK/résolution ? sinon l'ennemi semble se téléporter puis frappe ; (ii) STEP_MS=160 ms/tuile est rapide — l'augmenter (≈220-280) rendrait le trajet lisible, ce qui n'est légitime QU'APRÈS l'unification (sinon les trois conventions divergent davantage).

### [mineur] (Rendu du mouvement (téléportation perçue)) Cadence globale du tour IA trop serrée pour percevoir move → attaque → défense comme des beats distincts
- **Symptôme**: « Tout va trop vite. »
- **Cause**: Les délais d'orchestration IA sont des setTimeout constants empilés et indépendants de l'anim : maybeRunEnemyTurn lance runEnemyAI après 450 ms (l.1840), attackThenAdvance attend 350 ms puis tape (l.2098), advanceTurn enchaîne après 350-500 ms (l.2096,2192,2157,2121). Aucun de ces délais n'est calé sur la durée réelle d'un glissement ou d'un clip d'attaque (ANIM_IMPACT existe mais n'est pas attendu par le flux). Les beats se chevauchent : on ne distingue pas l'arrivée, la frappe et la demande de défense.
- **Preuve**: C:/Users/gauch/PhpstormProjects/Foundry/Game/src/state/combatFlow.ts:1840,2084-2098,2096,2121,2157,2192; C:/Users/gauch/PhpstormProjects/Foundry/Game/src/gameIso/IsoStage.tsx:182-193
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Le défaut est réel et le move/charge en est l'épicentre. Corrections par ordre d'impact :

1) Émettre un vrai signal de fin de glisse. Créer `EVT.ANIM_MOVE_DONE` (bus.ts) et l'émettre quand la glisse se termine — soit depuis la boucle rAF d'IsoStage (l.152, quand `now - start >= walkDuration`), soit depuis le walkTimer d'useRigAnim (l.68). Source unique de durée : `walkDuration(path, STEP_MS)`.

2) Caler l'attaque/charge sur cette fin de move, pas sur 350 ms. Dans le case `move` (l.2160-2193), ne PAS appeler `attackThenAdvance(tgt)` synchronement après l'emit ANIM_MOVE : attendre ANIM_MOVE_DONE, ajouter un beat de télégraphe minimal garanti (p.ex. 200-300 ms « il arrive au contact / il s'apprête à frapper »), PUIS doAttack/ouvrir la modale de défense. Cela donne 3 beats lisibles : arrivée → télégraphe → frappe+défense.

3) Garantir un délai plancher entre arrivée et ouverture de `pendingDefense`, indépendant de la longueur du chemin (un déplacement d'1 case ne doit pas non plus court-circuiter le beat).

4) Optionnel mais cohérent : dériver les autres délais (cast l.2121, recover l.2157, advance post-attaque l.2096) de la durée du clip concerné plutôt que de constantes, pour que tout le tour IA respire au même rythme.

Note d'implémentation : ne PAS référencer un ANIM_MOVE_DONE inexistant — le créer d'abord. Le télégraphe de tir existant (l.2126-2130, enemyAim + 750 ms) est un bon modèle de « beat de contexte » à répliquer pour la mêlée/charge.

### [majeur] (Lisibilité attaque/défense (arme, dégâts, valeurs, qui-est-qui)) On ne choisit pas l'arme : firedWeapon prend la 1ʳᵉ arme de mêlée du tableau, sans sélecteur
- **Symptôme**: Avec plusieurs armes de mêlée équipées (ex. épée + dague), le joueur ne sait pas avec laquelle il frappe et ne peut pas la changer : la modale n'affiche QUE le nom retenu d'office, sans alternative.
- **Cause**: attackWeapon() résout l'arme par `weapons.find((w) => w.type === 'melee')` / `…'ranged'` — le PREMIER élément de l'ordre du tableau, sans tenir compte d'un choix joueur. firedWeapon() ne fait que l'envelopper (munition). RollModal n'expose aucun picker : le nom est purement décoratif (affichage), pas un contrôle.
- **Preuve**: src/engine/combat.ts:300-305 (attackWeapon : weapons.find melee/ranged) ; src/state/combatFlow.ts:445-453 (firedWeapon) ; src/ui/RollModal.tsx:70 (weapon = firedWeapon(...)) et 80-82 (affichage nom seul, état pré-jet 84-107 = uniquement boutons de localisation, aucun choix d'arme)
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Faire de l'arme un CHOIX explicite, stocké dans l'état, lu par tout le flux (pas re-dérivé). Concrètement :

A) Ajouter `weaponUid?: string` (ou `weaponName`) à PendingAttack (store.ts:237). Le munir d'un `attackSetWeapon(uid)` (comme attackSetLocation).

B) Pré-sélectionner sur firedWeapon au démarrage de l'attaque (store.ts ~2703/combatFlow.ts:509 startAttack), mais modifiable.

C) Centraliser la résolution : une fonction `chosenWeapon(attacker, target, pa)` qui retourne l'arme du choix (uid) augmentée de la munition, sinon firedWeapon par défaut. La faire lire par TOUS les points qui appellent aujourd'hui firedWeapon dans le flux d'attaque : attackRoll/résolution, attackReroll (store.ts:2703), attackConfirm (2724), attackForceSuccess (3157), et les logs de combatFlow.ts:993/999. Sinon le picker mentirait à mi-flux.

D) Exposer un picker dans l'état pré-jet de RollModal (84-107), juste avant/à côté de la Localisation : lister les armes de `attacker.weapons` compatibles avec la distance (melee si combatDistance≤1, ranged + Atout Pistolet sinon), filtrer les doublons triviaux (garder Crochet/Mains nues mais les marquer « repli »), bouton actif = choix courant. Réutiliser le style btn small comme la grille de localisation.

E) Filtre de distance : réutiliser exactement la logique de attackWeapon (canFireWhileEngaged au contact) pour ne proposer que des armes légalement utilisables — ne pas laisser choisir un arc au contact sans Atout Pistolet.

F) Minimum viable si on ne fait pas le picker tout de suite : rendre le nom d'arme saillant dans la modale (icône groupe/forme via le registre d'armes defs/, + estimation de Dégâts) pour que le joueur RÉALISE quelle arme part — ça adresse le symptôme « on ne sait pas avec quoi on frappe » même sans contrôle. (cohérent avec le thème global « lisibilité » : afficher l'arme + l'estimation de dégâts = priorité ; le picker ferme la boucle.)

Note tempo/lisibilité (problème caché qui voyage avec) : le MÊME défaut existe côté IA et côté affichage des LOGS (combatFlow.ts:993/999 re-dérivent firedWeapon pour le message « tire sur »), donc le journal peut nommer une arme différente de l'intention si la feature évolue — centraliser via chosenWeapon protège aussi la cohérence des messages.

### [majeur] (Lisibilité attaque/défense (arme, dégâts, valeurs, qui-est-qui)) Aucune estimation de dégâts avant validation (la donnée moteur existe pourtant)
- **Symptôme**: Avant de lancer — et même après, dans le verdict — le joueur n'a aucune idée de ce que l'attaque peut faire : pas de fourchette de dégâts, pas de Dégâts d'arme, pas de soak (BE+PA) de la cible affiché. On valide à l'aveugle.
- **Cause**: L'état pré-jet de RollModal ne contient que les boutons de localisation et « Lancer » ; aucun calcul d'estimation n'est branché. La brique pure existe (effectiveWeaponDamage(weapon, BF) + formule Dégâts = arme + DR, soak = BE + PA via woundsFromHit) mais n'est jamais importée par la modale.
- **Preuve**: src/ui/RollModal.tsx:84-107 (état pré-jet sans estimation) ; src/engine/weaponDamage.ts:23-29 (effectiveWeaponDamage, pur, non importé par les modales) ; src/engine/combat.ts:284-288 (woundsFromHit : soak = BE+PA) ; grep RigPortrait/teamColors dans RollModal.tsx = aucun match
- **RAW**: LDB 13 l.157-160 (Dégâts = Dégâts d'Arme + DR) ; LDB 13 l.165-169 (PB subis = Dégâts − (Bonus d'Endurance + PA))
- **Vérif**: haute / codeConfirmed=True
- **Direction**: PRÉ-JET (RollModal.tsx état !res, lignes 84-107) : importer effectiveWeaponDamage et woundsFromHit (déjà purs) et afficher un encart « Estimation » SOUS la grille de localisation. Le soak de la cible est DÉTERMINISTE (BE + PA de la localisation visée, ou PA min/max si « Au hasard ») → l'afficher exactement ; seul le DR est inconnu avant le jet → montrer une FOURCHETTE : Dégâts d'arme (effectiveWeaponDamage(weapon, bonus(F attaquant))) + DR plausible (p.ex. 0 à +SL-typique), moins (BE + PA). Bien gérer ranged (Dégâts plats type +9, géré par flatDamage) vs mêlée (+BF). Réutiliser le label d'arme déjà résolu (weapon.name, RollModal.tsx:70-81) pour lever l'ambiguïté « avec quelle arme ». VERDICT (état res, lignes 114-127) : transformer la phrase res.log en mini-tableau structuré « Dégâts d'arme + DR − (BE+PA) = Blessures ». Comme le terme soak n'est PAS un champ d'AttackResult, soit le re-dériver côté UI (damage − woundsLost, déjà fait dans le log), soit — plus propre — ajouter un champ optionnel soak?: number (= BE+PA) sur AttackResult renvoyé par applyHit (combat.ts:587-603) pour éviter de re-parser une chaîne. Le moteur reste pur ; seule la couche UI gagne la lisibilité.

### [majeur] (Lisibilité attaque/défense (arme, dégâts, valeurs, qui-est-qui)) On ne sait pas QUI EST QUI : les modales n'ont ni portrait, ni couleur d'équipe, ni PV
- **Symptôme**: En attaque comme en défense, attaquant et cible ne sont que deux noms en gras. Dans la cohue (« qui d'où ? »), impossible de relier le jet à un pion sur la carte ; les chiffres (cible, DR) ne sont rattachés visuellement à personne.
- **Cause**: RollModal et DefenseModal n'affichent l'identité que via `<strong>{name}</strong>` dans `rm-vs`. Les composants d'identité du jeu (RigPortrait, HERO_RING/ENEMY_RING, hpColor) sont utilisés dans ActionBar mais jamais importés dans les modales — la modale est déconnectée du langage visuel du champ de bataille.
- **Preuve**: src/ui/RollModal.tsx:79-82 (rm-vs, name seul) ; src/ui/DefenseModal.tsx:40-43 (idem) ; src/ui/ActionBar.tsx:12-13,294-308 (RigPortrait + HERO_RING + hpColor + barre PB existants, réutilisables) ; grep RigPortrait|teamColors|HERO_RING|hpColor sur RollModal.tsx = No matches
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Réutiliser dans les DEUX modales (RollModal + DefenseModal) les briques d'identité déjà présentes dans ActionBar — ne rien réinventer : (1) Dans `.rm-vs`, remplacer chaque `<strong>{name}</strong>` par un bloc identité = `<RigPortrait combatant={c} size={...} ring={...} />` + nom + PV `{wounds.current}/{wounds.max}` coloré via `hpColor(ratio)`, de part et d'autre du `→`. L'anneau : HERO_RING[idx] pour un héros (calculer idx via party.findIndex comme ActionBar.tsx:80-81), ENEMY_RING pour un ennemi. Données déjà en main (attacker/target, attacker/defender). (2) Pour rattacher chaque RollLine à son propriétaire SANS casser la sémantique succès/échec du liseré gauche existant : préfixer chaque RollLine d'une petite vignette-portrait (ou pastille de couleur d'équipe) du combattant correspondant — l'attaquant pour attackerDetail, le défenseur pour defenderDetail —, et NE PAS détourner le liseré ok/fail. (3) Importer HERO_RING/ENEMY_RING/hpColor/RigPortrait dans les deux modales (ActionBar.tsx:12-13 est le modèle d'import). Vérification : recette navigateur Playwright (charger un combat de test, ouvrir l'attaque puis subir une défense IA, screenshoter les deux modales avec portraits/anneaux/PV) ; pas de nouveau test moteur nécessaire (UI pure).

### [majeur] (Lisibilité attaque/défense (arme, dégâts, valeurs, qui-est-qui)) Les modificateurs (« +30 » = Avantage×3) ne sont expliqués que par intermittence et sans la logique ×10
- **Symptôme**: Le joueur voit « base + 30 = cible » sans comprendre d'où sort le +30 ; quand le détail s'affiche, « Avantage +30 » ne dit pas que c'est 3 Avantage × 10. Pire : sur plusieurs chemins (Chance +1 DR, re-dérivation) le détail étiqueté disparaît SILENCIEUSEMENT et il ne reste qu'un total opaque.
- **Cause**: RollLine n'affiche les chips de mods que si `mods.reduce(sum) === d.modifier` (réconciliation stricte). Or attackBonusSL (Chance) et rederivePassiveAttack reconstruisent le breakdown SANS la bande de portée → la somme ne réconcilie pas → repli silencieux sur le total nu. Et le libellé « Avantage +30 » n'expose pas le facteur ×10 (Avantage×10), donc la valeur reste un nombre magique.
- **Preuve**: src/ui/RollModal.tsx:16-17 (showMods = mods.length>0 && reduce===d.modifier) et 34-43 (chips) ; src/engine/combat.ts:640-650 (rederivePassiveAttack : attackModifiers SANS distanceTiles, commentaire « le détail des modificateurs d'un tir omet la bande de portée → la somme ne reconcilie pas → l'UI retombe sur l'affichage groupé ») ; src/engine/combat.ts:203-204 (Avantage = attacker.advantage*10, libellé 'Avantage' sans ×10)
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Ne JAMAIS tout masquer : faire de RollLine un rendu robuste qui montre toujours la décomposition disponible. (a) Afficher les chips connus + une ligne de reliquat « Autres/Plafond −N » égale à `d.modifier − somme(chips)` quand l'écart ≠ 0, au lieu du repli binaire actuel. Ainsi le total reste toujours expliqué (chips + reliquat = modifier), que l'écart vienne de la bande de portée omise, des plafonds Combiner-les-Difficultés, ou d'un futur chemin. (b) Propager `distanceTiles` dans `rederivePassiveAttack` (et donc dans `attackBonusSL` store.ts:2710 + l'autre appel store.ts:3164) pour que la bande de portée figure aussi après Chance — l'info de distance est dans `pendingAttack`/scène (resolveAttack combatFlow.ts:533 la calcule déjà via `dist`). (c) Enrichir le libellé d'Avantage pour exprimer la mécanique : « Avantage ×3 = +30 » (et idem défense l.257), en passant le compte `attacker.advantage` dans le ModLine ou en construisant le libellé `Avantage ×${attacker.advantage}`. (d) Si on garde un repli, rendre la ligne « Plafond appliqué (LDB 14) » explicite plutôt qu'un total nu, pour que le joueur comprenne POURQUOI base+chips ≠ cible. Tests : étendre combat-breakdown.test.ts pour vérifier que la décomposition reconcilie (chips+reliquat===modifier) sur tir Bout portant/Longue après +1 DR, et sur un cas où les plafonds mordent.

### [majeur] (Lisibilité attaque/défense (arme, dégâts, valeurs, qui-est-qui)) La modale de Défense surgit sans aucun contexte de l'attaque entrante (« d'où ? a-t-il chargé ? »)
- **Symptôme**: Quand l'IA attaque, la modale de défense apparaît brutalement : on voit « ennemi (arme) attaque → héros » et deux boutons, mais rien sur l'attaque déjà figée (le jet est résolu côté moteur), ni sur la distance/charge/origine. Le joueur décide Parade/Esquive sans informations.
- **Cause**: pendingDefense porte pourtant atk (TestResult figé), weapon et location, mais DefenseModal n'affiche dans l'état pré-défense (`!res`) que le nom+arme et les valeurs de Parade/Esquive — il ne montre PAS l'attaque entrante figée ni ne contextualise (charge, portée, qui/où). L'IA est suspendue mais l'UI ne tire pas parti de l'information déjà disponible.
- **Preuve**: src/ui/DefenseModal.tsx:40-66 (état pré-défense : rm-vs nom+arme + boutons Parade/Esquive, rien sur pd.atk ni le contexte) ; src/state/store.ts:332-348 (PendingDefense contient atk: TestResult figé, weapon, location) ; src/engine/combat.ts:351-376 (finishMelee : mêlée = Test opposé, le jet attaquant est déjà déterminé)
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Enrichir la branche pré-défense (`!res`) de DefenseModal.tsx pour utiliser les données DÉJÀ figées dans pendingDefense (zéro nouvelle plomberie pour la majeure partie) :
1. Identité de l'attaquant : portrait (rig) + couleur d'équipe via attackerId → battle.combatants (cf. finding identité/teamColors.ts du lot 1).
2. Menace lisible sans spoiler le dé : afficher la valeur de toucher de l'attaquant (pd.atk.target) en comparatif « son Attaque {pd.atk.target} vs ta Parade {paradeVal} / Esquive {esquiveVal} » — garde le d100 caché jusqu'à « Défendre ».
3. Nature de l'attaque : si pd.freeKind est présent, l'annoncer (« Morsure », « Caudale », « Piétinement ») au lieu du seul nom d'arme — déjà disponible.
4. Indice sur la carte AVANT que la modale capte l'œil : surligner l'attaquant / tracer la ligne d'attaque attaquant→défenseur (répond au « qui, d'où »).
RÉSERVE : la « charge/portée » du finding n'est PAS dérivable de l'existant (pas de flag charge, mêlée forcément à dist ≤1). Soit l'omettre, soit ajouter un petit flag (ex. propager si l'attaquant a chargé ce round) — à trancher, ne pas le présenter comme gratuit.

### [mineur] (Lisibilité attaque/défense (arme, dégâts, valeurs, qui-est-qui)) Le verdict et le log mélangent les chiffres sans dire à qui ils appartiennent
- **Symptôme**: Le bandeau verdict (« Touché — Corps · 4 Blessure(s) · DR net +3 · CRITIQUE ») et la phrase de log accolent des nombres (DR net, Blessures, +Avantage) sans rattachement clair attaquant/défenseur ; combiné à l'absence de portraits, l'utilisateur « ne comprend pas les valeurs ».
- **Cause**: rm-verdict concatène des fragments hétérogènes (localisation, woundsLost, netSL, critical) en une seule ligne, et rm-log affiche res.log brut. Aucun de ces éléments n'est visuellement rattaché à un camp ; le DR net et l'Avantage gagné ne disent pas QUI en bénéficie.
- **Preuve**: src/ui/RollModal.tsx:114-128 (rm-verdict concaténé + rm-log brut) ; src/ui/DefenseModal.tsx:75-82 (idem côté défense) ; src/engine/combat.ts:598-603 (res.log = phrase brute « touche … : X dégâts − Y (BE+PA) = Z Blessures »)
- **RAW**: LDB 13 l.165-169 (PB subis = Dégâts − (Bonus d'Endurance + PA))
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Aligner l'APRÈS-jet sur l'AVANT-jet, qui est déjà bon (RollLine). Concrètement: (a) remplacer la ligne `rm-verdict` concaténée par un verdict structuré rattaché à un camp — qui touche QUI (réutiliser teamColors.ts déjà importé partout ailleurs pour teinter nom attaquant vs défenseur), qui PERD les Blessures, qui GAGNE l'Avantage (et l'afficher, car il est aujourd'hui absent alors que `advantageTo` est calculé). (b) Transformer la décomposition de dégâts, aujourd'hui noyée dans `res.log` en prose, en un mini-affichage explicite à la grammaire du RAW à deux étages: « Dégâts d'Arme {n} + DR {n} = Dégâts {n} » puis « − BE {n} − PA {n} = {Blessures} » (LDB 13 l.160 + l.169), au lieu du `damage - woundsLost` agrégé actuel — ce qui réutilise la même grammaire que l'estimation pré-jet et explicite les BE/PA séparément. (c) Étendre teamColors aux deux modales (non importé actuellement) pour que chaque nom/chiffre porte sa couleur d'équipe. Garder RollLine inchangé (déjà conforme). NE PAS inventer de nouvelle règle: la décomposition existe déjà dans le moteur (combat.ts:577-600), il s'agit de la STRUCTURER à l'affichage, pas de recalculer.

### [bloquant] (File de modales & temps de respiration) L'ennemi attaque (modale de défense) AVANT d'avoir fini de glisser à l'écran — d'où l'impression de téléportation
- **Symptôme**: Quand l'IA approche, « le 1er ennemi se téléporte sur toi » puis une modale de défense surgit sans contexte (qui ? d'où ? a-t-il chargé ?).
- **Cause**: Désynchronisation tempo. Le glissement visuel dure walkDuration = (path.length-1)*160ms (walkPath.ts:21, STEP_MS=160 IsoStage.tsx:47). Mais attackThenAdvance déclenche doAttack après un setTimeout FIXE de 350ms (combatFlow.ts:2098), indépendant de la longueur du chemin. doAttack -> maybeOpenDefense ouvre pendingDefense immédiatement (combatFlow.ts:991,957). Pour toute approche de 3 cases (480ms) ou plus, la modale de défense s'ouvre alors que le token est encore à mi-chemin -> ennemi figé en cours de route + prompt de défense. La modale n'attend PAS la fin de ANIM_MOVE.
- **Preuve**: src/state/combatFlow.ts:2083-2099,2160-2192,957-986; src/gameIso/walkPath.ts:21-23; src/gameIso/IsoStage.tsx:47,158-164
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Accrocher l'ouverture de pendingDefense à la FIN réelle du déplacement, pas à un délai fixe. Trois pistes par ordre de robustesse :

1. (recommandé) Émettre un évènement ANIM_MOVE_DONE quand le rAF de IsoStage termine un slide (walksRef supprime l'entrée à walkDuration, IsoStage.tsx:152) et faire attendre attackThenAdvance/le cas 'move' cet évènement avant doAttack. Cela couvre AUSSI la désynchro héros (store.ts:2220-2277 émettent le même ANIM_MOVE).

2. (plus simple, sans event bus) Dans le cas 'move', calculer la durée réelle et caler le délai : attackThenAdvance(tgt, Math.max(350, walkDuration(path, 160))). Passer le path/la durée en paramètre plutôt que la constante 350 codée en dur. Garder un beat de respiration (~150-200 ms) APRÈS l'arrivée pour rattacher l'ennemi à sa case avant le prompt.

3. Au passage, unifier les trois horloges : faire dériver la durée du clip de marche (useRigAnim.ts:67) de la MÊME walkDuration (path.length-1)*STEP_MS que le slide de position, pour supprimer l'off-by-one, et exporter STEP_MS d'un seul module au lieu de le redéclarer dans IsoStage.tsx:47 et useRigAnim.ts:13.

Compléter le remède de tempo par du CONTEXTE sur la modale de défense (le retour brut « qui ? d'où ? a-t-il chargé ? ») : la modale a déjà attackerId/defenderId/weapon/atk (combatFlow.ts:971-977) mais pas l'info de charge (enemy.chargedThisTurn est posé en 2188 juste avant) — l'exposer dans pendingDefense pour pouvoir afficher « X a chargé et t'attaque ». Hors périmètre strict du tempo mais voyage avec le même symptôme.

### [majeur] (File de modales & temps de respiration) La modale de défense ne porte aucun contexte spatial : ni distance, ni direction, ni « il a chargé », ni PV/valeurs des deux camps
- **Symptôme**: « une modale de DÉFENSE surgit sans contexte (qui ? d'où ? a-t-il chargé ?) » ; « on ne sait pas QUI EST QUI ni à qui appartiennent les chiffres ».
- **Cause**: DefenseModal n'affiche que le nom de l'attaquant + nom d'arme + ses propres Parade/Esquive (DefenseModal.tsx:40-56). Le pending PendingDefense (store.ts:332-348) ne transporte ni info de Charge (l'Avantage de charge est posé sur enemy.advantage mais jamais surfacé), ni localisation visée (location:null l.975), ni PV/Avantage des deux. Après le jet, les RollLine montrent des valeurs empilées sans dire à QUI elles appartiennent. Aucun portrait ni surbrillance de la case attaquante.
- **Preuve**: src/ui/DefenseModal.tsx:36-93; src/state/store.ts:332-348,970-983; src/state/combatFlow.ts:2183-2190
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Enrichir PendingDefense + DefenseModal sans inventer de règle (toute valeur déjà calculée par le moteur) : (a) snapshot dans le pending au moment du gel — PV (wounds/woundsMax), Avantage des deux camps, distance de combat (combatDistance, déjà dispo), et un drapeau charge dérivé de attacker.chargedThisTurn (déjà posé combatFlow.ts:2188) avec l'Avantage de charge effectif (chargeAdvantage, engine/engagement). (b) Modale : portraits issus du rig + barre PV des deux, badge « A chargé (+N Av) » quand le drapeau est vrai (Avantage RAW LDB 13/15-Dépl), localisation visée (ici null car l'IA ne vise pas — l'indiquer « localisation aléatoire » plutôt que rien). (c) Attribution des jets : préfixer chaque RollLine par le nom du propriétaire (« Attaque de X — Corps à corps », « Défense de Y — Parade ») — soit via une prop `owner` ajoutée à RollLine, soit en composant le label ; les mods détaillés (d.mods) étant déjà étiquetés, ils deviennent lisibles une fois rattachés au bon camp. (d) Iso : surligner la case attaquante + tracer un trait attaquant→défenseur le temps où pendingDefense est non-null (le tour IA est déjà suspendu, store.ts:332-348), ce qui répond au « il se téléporte / d'où vient-il ». Pré-requis : vérifier que la charge IA passe bien par doAttack→maybeOpenDefense en mêlée (case 'move' l.2191 attackThenAdvance) afin que chargedThisTurn soit lisible au moment du gel.

### [majeur] (File de modales & temps de respiration) Modales en chaîne sans respiration : Morsure/Caudale/Piétinement ouvrent des pendingDefense successifs immédiats
- **Symptôme**: « tout va trop vite », modale-sur-modale : après la défense principale, d'autres prompts de défense enchaînent sans pause ni explication de leur nature.
- **Cause**: aiCreatureFreeAttacks (combatFlow.ts:1409) parcourt pendingFreeAttacks dans un while (l.1431) ; chaque attaque gratuite appelle applyFreeAttack -> maybeOpenDefense (l.1219) qui rouvre IMMÉDIATEMENT une nouvelle pendingDefense dès confirmation de la précédente (defenseConfirm relance la file l.2984). Aucun beat ni ligne journal « X mord aussi » entre deux prompts ; la DefenseModal ne signale pas qu'il s'agit d'une attaque GRATUITE distincte (seul le nom d'arme change). Une créature Morsure+Piétinement enchaîne 2-3 modales d'affilée.
- **Preuve**: src/state/combatFlow.ts:1409-1443,1215-1225; src/state/store.ts:2982-2985,3003-3006
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Insérer le beat au point de transition INTER-MODALE (le rappel synchrone dans defenseConfirm store.ts:2984 et defenseCancel store.ts:3006), PAS à l'entrée IA déjà setTimeout-gatée. Au resolve d'une défense d'attaque gratuite : émettre son anim (emitCreatureAttackAnim / ANIM_ATTACK) + une ligne journal "X enchaîne : Morsure", puis programmer le prochain aiCreatureFreeAttacks via un court setTimeout (~350-500 ms) au lieu de l'appeler synchroniquement -> le joueur voit le coup précédent atterrir avant le prompt suivant. En parallèle, exposer pd.free/pd.freeKind dans DefenseModal.tsx comme badge distinct ("Attaque gratuite — Morsure") : la donnée est déjà présente (PendingDefense.free/freeKind), c'est un changement d'AFFICHAGE pur qui distingue un NOUVEAU coup d'un re-prompt.

### [majeur] (File de modales & temps de respiration) Le combat démarre directement sur une modale (Initiative) posée par-dessus un champ de bataille jamais montré
- **Symptôme**: « À l'ouverture : modale-sur-modale sans voir le champ de bataille ; ça démarre DIRECT sur INITIATIVE. »
- **Cause**: startCombat construit la bataille puis appelle pushReveal('Initiative') de façon synchrone (store.ts:1609) avant tout rendu interactif -> la RevealModal s'affiche au premier frame du mode battle, masquant l'iso. Aucun beat d'établissement (caméra cadrant le champ, surbrillance des camps, ligne « Le combat commence ! » visible) n'est laissé AVANT la modale. Si Surprise, les surpriseLines sont fusionnées DANS la même modale Initiative (l.1613) -> bloc dense d'emblée. Le RAW pose pourtant une séquence ordonnée : 1.Surprise, 2.Début de Round, 3.Tours (LDB 13 l.24-32).
- **Preuve**: src/state/store.ts:1606-1621; src/ui/CampaignView.tsx:117-141
- **RAW**: LDB 13 l.24-32
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Insérer une PHASE D'ÉTABLISSEMENT non bloquante entre `set(mode:'battle')` et la révélation, fidèle à LDB 13 l.24-32 + l.86 :

1) Beat 0 — Établissement (RAW l.86 « le MJ décrit la situation ») : ~0,8-1,2 s de champ visible, AUCUNE modale. faceAtCombatStart() reste, mais ajouter : caméra qui cadre l'ensemble des combattants (fit-to-combatants), surbrillance des deux camps (anneaux amis/ennemis déjà existants), et une ligne journal/bandeau « Le combat commence ! ». N'armer pushReveal('Initiative') qu'après ce délai (setTimeout dans startCombat, ou drapeau `establishing` consommé par un effet d'IsoStage). Garder maybeRunEnemyTurn gelé pendant l'établissement (déjà gardé par pendingReveals — il faudra une garde équivalente sur `establishing`).

2) Surprise = beat DISTINCT (étape 1 RAW), AVANT l'Initiative (étape 3) : si `surpriseLines.length`, pousser une révélation propre `kind:'round', title:'Surprise'` (qui ? est surpris/embusqué ?) puis SÉPARÉMENT la révélation Initiative. Retirer le spread `...surpriseLines` de l'entrée Initiative (l.1613) pour supprimer la duplication (les lignes sont déjà dans battle.log l.1601).

3) Reconsidérer la modale Initiative bloquante elle-même : l'ordre d'Initiative est DÉJÀ affiché en permanence dans BattlePanel. Option moindre friction = remplacer la modale Initiative par un bandeau/transition non bloquant (toast 1,5 s ou highlight de la liste d'Initiative dans BattlePanel), réservant les modales bloquantes aux jets à décision (Chance/Détermination). Cela respecte « un jet = une modale » pour les jets actionnables sans faire payer un clic « Continuer » à l'ouverture, là où il n'y a rien à décider.

Note d'implémentation : le piège fake-timers (vi.clearAllTimers, cf. store.test.ts:50) impose que tout setTimeout d'établissement soit testable/annulable au reset() ; le pattern pendingReveals/garde existant est le bon modèle à réutiliser pour le drapeau `establishing`.

### [mineur] (File de modales & temps de respiration) L'Initiative est révélée en modale bloquante alors que BattlePanel affiche déjà l'« Ordre de bataille » — double emploi, clic mort
- **Symptôme**: Modale supplémentaire à acquitter (« Continuer ») au tout début sans valeur ajoutée — contribue au sentiment de modale-sur-modale.
- **Cause**: La RevealModal d'Initiative liste « 1. Nom (init) … » (store.ts:1612-1618), exactement ce que BattlePanel rend déjà en permanence sous « Ordre de bataille » avec portraits + PV (BattlePanel.tsx:31-66). La révélation, justifiée par l'invariant « un jet = une modale », fait ici doublon avec un panneau persistant et coûte un acquittement bloquant avant même de voir agir qui que ce soit.
- **Preuve**: src/state/store.ts:1609-1619; src/ui/BattlePanel.tsx:31-66
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Supprimer la modale Initiative bloquante au démarrage du combat. L'ordre est déjà rendu en permanence et plus richement par BattlePanel « Ordre de bataille » (portraits + PV + acteur actif). Concrètement : retirer le pushReveal({kind:'round', title:'Initiative'}) de startCombat (store.ts:1609-1619). Pour ne PAS perdre les 2 data réelles : (a) router les surpriseLines vers battle.log (déjà initialisé avec surpriseLines à 1601 — donc elles sont DÉJÀ dans le journal, le doublon de la modale est total pour la Surprise) ; (b) si la valeur d'Initiative est jugée utile, l'afficher de façon non-bloquante dans BattlePanel (petit chiffre near le portrait) plutôt qu'en modale. Optionnellement remplacer par une brève mise en évidence/animation de l'ordre dans le panneau (toast auto-dismiss), sans acquittement. Garder l'invariant « un jet = une modale » pour les seuls jets À CONSÉQUENCE/DÉCISION (Chance/Détermination) ; l'Initiative n'en est pas un. ATTENTION garde-fou : il existe un test statique anti-régression (cf. mémoire « garde-fou statique » + game-jet-modale-exhaustif) qui peut exiger une modale pour tout jet du store — vérifier/ajuster ce test si on retire le reveal Initiative, sinon il cassera. Ce problème voyage avec le symptôme « modale-sur-modale au démarrage » du retour joueur (combat qui s'ouvre direct sur une modale avant qu'on voie le champ de bataille).

### [majeur] (File de modales & temps de respiration) Le journal de combat est sous-exploité comme fil de lecture : événements clés non journalisés, fenêtre courte, pas de focalisation animée
- **Symptôme**: « Tout va trop vite » ; le joueur ne reconstitue pas la séquence (qui a bougé, qui a chargé, quelle attaque gratuite) entre deux modales.
- **Cause**: Des beats majeurs n'écrivent RIEN dans battle.log : le déplacement d'un ennemi (case 'move' combatFlow.ts:2160-2192 ne push aucune ligne « X avance vers Y »), la Charge de l'IA (l.2182-2190 pose l'Avantage sans journaliser « X charge ! »), l'ouverture d'une défense (maybeOpenDefense ne logge pas avant le jet). Seul le tir est annoncé (doAttack l.993). BattlePanel n'affiche que 9 lignes (BattlePanel.tsx:70 slice(-9)) et le journal HUD gauche est MASQUÉ en combat (CampaignView.tsx:65). Le focus se recale instantanément au render sur battle.order[turn] (IsoStage.tsx:470-481) sans pan animé.
- **Preuve**: src/state/combatFlow.ts:2160-2192,957-986; src/ui/BattlePanel.tsx:68-73; src/ui/CampaignView.tsx:65; src/gameIso/IsoStage.tsx:470-482
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Faire du journal le fil de lecture du combat ET caler le tempo dessus.
(a) Journaliser chaque beat IA, dans l'ordre de perception : « X avance vers Y » (combatFlow.ts case 'move'), « X charge ! (+N Avantage) » au bloc l.2183-2190, et « X attaque Z » émis AVANT l'ouverture de la modale, depuis maybeOpenDefense (l.969, juste avant set pendingDefense) et symétriquement pour doAttack mêlée (l.994, parité avec le « tire sur » du ranged).
(b) Synchroniser le tempo sur l'animation au lieu d'un 350 ms en dur : dans attackThenAdvance (l.2083-2098) et le chaînage move→attackThenAdvance (l.2191), retarder l'ouverture de la défense de walkDuration(path, stepMs) (déjà calculable, cf. gameIso/walkPath.ts) plutôt que de 350 ms fixes, pour que la modale n'apparaisse qu'une fois le glissé fini. Optionnel mais conseillé : différer la mise à jour du focus/pos « logique » du store jusqu'à la fin du glissé, ou faire suivre le focus caméra par la position FRACTIONNAIRE animée (walkXY) plutôt que par enemy.pos déjà téléporté à la destination — sinon la caméra arrive avant le pion.
(c) Allonger/élever la fenêtre du journal de combat (BattlePanel.tsx:70, slice(-9) → davantage) et le marquer par Round (les séparateurs « — Round N — » sont déjà poussés, l.1736) ; envisager de réafficher le journal HUD-gauche en combat (CampaignView.tsx:65) ou de fusionner les deux fils.
Priorité : (a)+(b) corrigent le cœur du symptôme « trop vite / modale sans contexte » ; (c) est l'amplificateur de lisibilité.

### [majeur] (File de modales & temps de respiration) Plusieurs modaux peuvent coexister visuellement : rendus en siblings inconditionnels, sans arbitre d'unicité ni z-ordre garanti
- **Symptôme**: « modale-sur-modale » ; risque d'empilement de deux overlays (Reveal + Defense, ou Psych + Reveal) sans priorité claire.
- **Cause**: CampaignView monte TOUS les modaux côte à côte (CampaignView.tsx:121-144), chacun s'auto-masque si son pending est nul mais rien ne garantit qu'un seul soit visible. Les gardes existent surtout au niveau STORE (maybeRunEnemyTurn/advanceTurn/maybeOpenHeroPsych testent pendingReveals.length/pendingFateSave/pendingFumble — combatFlow.ts:1720,1726,1837,1984), ce qui empêche l'IA d'EN OUVRIR de nouveaux, mais ne sérialise pas les modaux de chemins concurrents (révélation 'calme' d'approche poussée pendant un move, puis défense). Tous partagent .modal-overlay sans z-index différencié -> l'empilement dépend de l'ordre JSX, pas de la priorité sémantique.
- **Preuve**: src/ui/CampaignView.tsx:121-144; src/state/combatFlow.ts:1720,1726,1837,1984; src/ui/DefenseModal.tsx:37; src/ui/RevealModal.tsx:15
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Introduire un SÉLECTEUR CENTRAL « modale active » : un seul point qui, à partir de tous les pending* du store, choisit LA modale de plus haute priorité et ne rend QUE celle-là ; les autres pending* restent en file. Priorité explicite proposée (du plus urgent au moins) : FateSave > Fumble > Deviation > Cleave/Trample (résolution d'effet en cours) > Reveal (témoin à acquitter) > Defense (réaction joueur) > Psych > RoundStart > actions joueur (Test/Roll/Reload/Heal/Cast). 

Concrètement :
- Remplacer les 24 siblings de CampaignView.tsx:121-144 par un unique <ActiveModal/> (ou un sélecteur `pickActiveModal(state)` dérivé) — supprime la dépendance à l'ordre JSX et garantit l'unicité visuelle par construction.
- Donner à chaque overlay le MÊME z-index est alors suffisant (un seul monté), mais on peut aussi réserver un sur-z-index pour un futur overlay « bloquant dur » (anim de dé).
- Insérer un BEAT de respiration entre deux modaux à ce point unique : courte transition (fond grisé + nom + portrait du combattant concerné ~300-500ms) avant la modale suivante, pour casser le « tout va trop vite » et le « qui est qui ».
- Au passage, harmoniser les gardes : tout poseur de pending lourd (maybeOpenDefense, et idéalement doAttack) devrait soit déférer si une révélation est en cours, soit s'enquêler via la même file — sinon le sélecteur masque le bug visuel mais le défenseur attendra que le joueur acquitte le 'calme' avant de voir SA défense, ce qui est en fait l'ordre souhaité (Reveal d'approche AVANT Defense). Le sélecteur central règle donc l'ordre sémantique « gratuitement ».
- Corriger aussi dismissReveal (store.ts:2763) pour inclure pendingDefense dans son garde de reprise IA (cohérence), même si bénin aujourd'hui.

### [mineur] (File de modales & temps de respiration) Délais de tempo IA en dur (450/350/500/750 ms) non centralisés ni alignés sur la durée réelle des animations
- **Symptôme**: Rythme « trop rapide » et incohérent : parfois la modale précède l'anim, parfois un blanc de 500ms ; aucun réglage global.
- **Cause**: Les setTimeout de cadence sont éparpillés et magiques : maybeRunEnemyTurn 450ms (combatFlow.ts:1840), resumeEnemyTurn 500ms (l.1721), attackThenAdvance pré-attaque 350ms (l.2098) + post-attaque 500ms (l.2096), move->advance 350ms (l.2192), enemyAim 750ms (l.2130). Aucun ne tient compte de walkDuration ni des durées d'anim (projectiles 340ms IsoStage.tsx:229, floats 850ms l.190). Le tempo ne respire pas aux bons endroits et est subi comme « trop rapide » sans pouvoir le ralentir.
- **Preuve**: src/state/combatFlow.ts:1721,1840,2096,2098,2130,2192; src/gameIso/IsoStage.tsx:190,229,234
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: 1) Piloter l'enchaînement post-mouvement par la FIN RÉELLE de l'animation plutôt que par un setTimeout deviné: émettre un event/callback ANIM_MOVE_DONE (ou faire dépendre le délai de walkDuration(path, STEP_MS) = (path.length-1)×160 + petite marge) avant d'armer attackThenAdvance (l.2191) et advanceTurn (l.2192). C'est le correctif le plus impactant car il supprime à la fois le « téléporte » (avance trop tôt) et le « blanc » (avance trop tard). 2) Centraliser TOUTES les constantes magiques dans une table unique (ex. BEAT = {enemyThink:450, postMove, preAttack:350, postAttack:500, aim:750}) calée sur les durées d'anim réelles (STEP_MS=160, projectile 340ms, float 850ms) — aujourd'hui éparpillées sur 7 sites de combatFlow.ts. 3) Exposer un multiplicateur global de vitesse de combat (réglage joueur) appliqué à la table, pour répondre au « tout va trop vite » sans toucher la logique. Idéalement ne réveiller l'IA suivante qu'après que l'anim ET la modale précédente soient consommées (chaînage évènementiel), ce qui rend le rythme reproductible.

### [mineur] (File de modales & temps de respiration) Télégraphe de tir présent (enemyAim) mais aucun équivalent pour l'approche/charge en mêlée
- **Symptôme**: Asymétrie de lisibilité : on sait sur qui l'ennemi TIRE (réticule 750ms) mais l'attaque de mêlée arrive sans télégraphe — d'où « il se téléporte sur toi ».
- **Cause**: Le cas 'shoot' pose enemyAim {from,to} + cadrage + délai 750ms avant de tirer (combatFlow.ts:2123-2131, rendu IsoStage.tsx:457-463). Le cas 'move'+mêlée n'a AUCUN télégraphe analogue : pas d'intention affichée (« X vise Y »), pas de surbrillance de la cible ; marche et attaque s'enchaînent en 350ms. La machinerie de télégraphe est appliquée à moitié.
- **Preuve**: src/state/combatFlow.ts:2123-2131,2160-2192; src/gameIso/IsoStage.tsx:457-463
- **RAW**: aucune
- **Vérif**: haute / codeConfirmed=True
- **Direction**: Réutiliser exactement la machinerie enemyAim/targeting pour l'approche de mêlée, en deux temps cohérents avec le tir :

1) TÉLÉGRAPHE D'INTENTION avant le mouvement : dans le cas 'move'→mêlée ET le cas 'melee' direct, poser `enemyAim {fromId: enemy.id, toId: tgt.id}` (ou une variante `enemyApproach` avec un visuel charge plutôt que réticule de tir) AVANT d'émettre ANIM_MOVE, surligner la case du héros visé, et cadrer les deux comme le fait targeting (IsoStage.tsx:467-469).

2) SYNCHRONISER LE DÉLAI SUR LA GLISSADE, pas un 350 ms fixe : remplacer le `setTimeout(..., 350)` de attackThenAdvance par un délai = max(350, walkDuration(path) + petite marge) afin que la modale de défense n'ouvre JAMAIS avant la fin visible du déplacement. C'est le correctif qui tue réellement la sensation de téléportation — le réticule seul ne suffit pas si la modale arrive à 350 ms sur une glissade de 480 ms+.

3) Distinguer visuellement charge vs simple approche (l'info chargeAdvantage est déjà calculée l.2184) pour que le joueur comprenne pourquoi l'attaquant a l'Avantage. Garder le même langage visuel que le tir (ligne + cadrage) pour l'homogénéité demandée par le retour.

Cela referme l'asymétrie de lisibilité ET l'asymétrie de tempo en une seule passe, en partageant le code déjà éprouvé du télégraphe de tir.

## Diagnostic synthétisé
All call sites confirmed against the JSON: camera focus reads `active.pos` (logical/destination, IsoStage.tsx:471-472), the 24 modals are unconditional siblings (CampaignView.tsx:121-144, no arbiter), `attackThenAdvance` uses a fixed 350ms (combatFlow.ts:2098) decoupled from `walkDuration = (path.length-1)*stepMs` (walkPath.ts:21-22), and RollModal pre-roll shows only weapon name + location grid, no estimate/portrait/picker (RollModal.tsx:79-106). The diagnostic is fully grounded.

---

# DIAGNOSTIC — « On ne comprend pas le combat »

Symptôme racine commun : **l'état logique saute à la destination instantanément** (`enemy.pos = action.to`, combatFlow.ts:2170) et **tout le tempo est en délais fixes magiques décorrélés des animations**. Le plateau n'est jamais « établi » avant qu'une modale ne le voile. Quatre facettes, traitables en quatre lots.

---

## FACETTE 1 — OUVERTURE & TEMPO

**Ce que vit le joueur :** le combat démarre DIRECT sur une modale Initiative qui voile un plateau jamais montré ; il clique « Continuer » à l'aveugle ; si l'IA est première, un ennemi « se téléporte » et une 2e modale (Défense) surgit aussitôt. Deux interruptions avant le moindre repère spatial.

**LOT 1 (bloquant → polish) :**

1. **[majeur] Synchroniser l'ouverture de la défense sur la FIN de la glisse.** `attackThenAdvance` arme `doAttack`→`maybeOpenDefense` à 350ms fixe (combatFlow.ts:2084,2098), mais la glisse dure `(path.length-1)*160` ms (walkPath.ts:21-22 ; STEP_MS=160 IsoStage.tsx:47). Le déplacement est **4-connexe** (path.ts NEIGHBORS orthogonal) → une charge diagonale « 5 cases Chebyshev » fait ~10 pas (~1600ms) alors que la modale s'ouvre toujours à 350ms. **C'est le bug central de la téléportation.** Remède : dans le `case 'move'` (combatFlow.ts:2191), passer un `delayMs = walkDuration(path, STEP_MS) + ~150-200ms` (beat de présence) à `attackThenAdvance` (le paramétrer en `delayMs`, défaut 350 pour `melee`/`shoot`/cavalier déjà-adjacents l.2135/2123/2108). RAW : aucun (tempo UX).

2. **[majeur] Sortir l'Initiative du flux de modales bloquantes.** `pushReveal('Initiative')` (store.ts:1609-1619) est inconditionnel, voile le plateau (.modal-overlay inset:0 z:100, styles.css:254-261) et **gèle l'IA** tant que `pendingReveals.length>0` (combatFlow.ts:1837). Or `BattlePanel` rend DÉJÀ « Ordre de bataille » en permanence avec portraits+PV (BattlePanel.tsx:31-66) → la modale est un doublon à clic mort. Remède : supprimer le `pushReveal` Initiative ; router `surpriseLines` vers `battle.log` (déjà dans battle.log à 1601). RAW : LDB 13 l.38-47 (Initiative = I+1d10, comptabilité d'ordre, pas un jet à décision).

3. **[majeur] Matérialiser la phase « Début du Round » / établissement.** Aucune étape ne montre le champ avant le 1er jet. Remède : insérer un beat d'établissement non-modal (~0,8-1,2s : caméra fit-to-combatants, anneaux des deux camps, bandeau « Le combat commence ! »), garder l'IA gelée pendant (drapeau `establishing` testable au `reset()`, modèle `pendingReveals`). Surprise = beat DISTINCT avant l'Initiative. RAW : LDB 13 l.24-32 (séquence ordonnée 1.Surprise→2.Début de Round→3.Tours) + l.86 (« le MJ décrit la situation… vous aider à préparer votre plan d'action »).

4. **[majeur] Télégraphe de mêlée (parité avec le tir).** `enemyAim` (réticule + ligne + cadrage + 750ms) n'est posé QU'au `case 'shoot'` (combatFlow.ts:2128 ; rendu IsoStage.tsx:457-464,601-619). Le `case 'move'`+mêlée n'a aucun équivalent. Remède : généraliser `enemyAim` (le renommer « ciblage ennemi ») à la mêlée — halo sur l'attaquant arrivé + ligne attaquant→cible ~400-600ms AVANT `maybeOpenDefense`. Étiqueter « X charge » quand `chargedThisTurn`/`gainedAdvThisRound` (déjà posés l.2186-2188, jamais affichés).

5. **[mineur] Cadence IA en délais magiques épars.** 450ms (l.1840), 350ms (l.2098), 500ms (l.2096,2121), 750ms (l.2130), 350ms (l.2157,2192). Aucun calé sur l'anim. Remède : centraliser une table `BEAT` + multiplicateur global de vitesse de combat (répond directement à « tout va trop vite » sans toucher la logique).

---

## FACETTE 2 — RENDU DU MOUVEMENT (téléportation perçue)

**Ce que vit le joueur :** « il bouge mais c'est si rapide qu'on ne perçoit rien » / « se téléporte sur toi ». Le marqueur d'acteur actif (stroke jaune + halo doré) attend DÉJÀ à la case d'arrivée pendant que le corps glisse vers lui.

**LOT 2 :**

1. **[majeur] La caméra cadre la position LOGIQUE (destination), pas la position visuelle.** `focus = active.pos` (IsoStage.tsx:471-472) = destination déjà écrite (combatFlow.ts:2170) ; `walkPosOf` (l.357-363) n'est jamais consulté pour le cadrage. La caméra (transform transition 0.3s, l.594) arrive à la destination en 300ms et attend le token → mouvement relatif token↔cadre minimisé. Remède : pour l'acteur actif EN marche, `focus = walkPosOf(active.id, active.pos.x, active.pos.y)` (coords fractionnaires OK, `tileCenter` est arithmétique) ; la rAF `setWalkTick` re-rend déjà chaque frame. **Garde-fou :** désactiver/réduire la transition CSS 0.3s pendant la marche active (sinon double-lissage / traînée).

2. **[majeur] Le halo/stroke d'acteur actif est ancré à la destination.** Pendant la glisse, dessiner la surbrillance (IsoStage.tsx:287-290 stroke + BodyToken.tsx:65 halo) à `walkPosOf` au lieu de `active.pos` — casse l'illusion « la case d'arrivée est marquée avant que le corps n'y soit ».

3. **[majeur] Modèle « état-logique-instantané + placage visuel » : à acter, pas à défaire.** C'est sain pour un moteur pur testable. Ne PAS retarder la mutation d'état ; FAIRE ATTENDRE la PRÉSENTATION (déjà le pattern des floats, gating sur `ANIM_IMPACT`). Remède transverse au Lot 1.1 : centraliser une notion « durée d'anim en cours » consultée par le flux IA.

4. **[mineur] Off-by-one du clip de marche + 3 conventions de durée.** Glisse position = `(path.length-1)*160` (walkPath.ts:22) ; clip rig/plan = `path.length*160` (useRigAnim.ts:67, usePlanAnim.ts:53) → jambes qui marchent **160ms après l'arrêt**. Pas d'exploration = 150ms (IsoStage.tsx:578) ≠ 160. Remède : **exporter STEP_MS + walkDuration d'un seul module** (4 littéraux dupliqués aujourd'hui), corriger le clip en `walkDuration(path)`, aligner l'exploration sur 160. NB : cet off-by-one fait PERDURER la marche, il n'explique PAS « tout va trop vite » — STEP_MS=160 est objectivement rapide ; l'augmenter (~220-280) seulement APRÈS unification.

---

## FACETTE 3 — LISIBILITÉ ATTAQUE / DÉFENSE

**Ce que vit le joueur :** deux noms en gras, pas de portrait/couleur/PV, on ne sait pas avec quelle arme on frappe, aucune estimation de dégâts, des « +30 » magiques qui parfois disparaissent, un verdict qui accole des chiffres sans dire à qui ils appartiennent. En défense : aucun contexte de l'attaque entrante.

**LOT 3 :**

1. **[majeur] Pas de sélecteur d'arme.** `attackWeapon` prend `weapons.find(type==='melee')` = 1ʳᵉ du tableau (combat.ts:300-305) ; `recomputeLoadout` pousse épée ET dague (items.ts:104-137). Aucun champ `weaponUid` dans `PendingAttack` (store.ts:237) ; tous les consommateurs re-dérivent `firedWeapon` indépendamment (store.ts:2703,2724,3157 ; combatFlow.ts:509,993). Remède : `weaponUid?` dans PendingAttack + `attackSetWeapon` + une fonction unique `chosenWeapon(attacker,target,pa)` lue par TOUS les points (sinon le picker mentirait à mi-flux) + picker dans l'état pré-jet (RollModal.tsx:84-107), filtré par distance (réutiliser `canFireWhileEngaged`).

2. **[majeur] Aucune estimation de dégâts.** Les briques pures existent et ne sont jamais importées par la modale : `effectiveWeaponDamage(w,BF)` (weaponDamage.ts:23-29), `woundsFromHit` / soak=BE+PA (combat.ts:284-288). Remède pré-jet : « Dégâts d'arme + DR − (BE+PA cible) = Blessures » ; le soak est DÉTERMINISTE (afficher exact, ou PA min/max si « Au hasard »), seul le DR est une fourchette. RAW : **LDB 13 l.160** (Dégâts = Dégâts d'Arme + DR) ; **LDB 13 l.169** (PB subis = Dégâts − (BE + PA)).

3. **[majeur] Aucune identité visuelle dans les modales.** RollModal.tsx:79-82 / DefenseModal.tsx:40-43 = `<strong>{name}</strong>` seul. `RigPortrait`/`HERO_RING`/`ENEMY_RING`/`hpColor` existent (teamColors.ts, livré Lot 0) et sont importés par ActionBar.tsx:12-13,295-308 mais PAS par les modales (les Combatant complets sont déjà en main). Remède : portrait + anneau d'équipe + PV `current/max` de part et d'autre du `→` dans les deux modales. **Réserve :** ne PAS détourner le liseré gauche de RollLine (vert .ok/.fail succès/échec, RollModal.tsx:13-46) pour l'équipe — porter l'identité-camp sur une vignette/pastille distincte.

4. **[majeur] Modificateurs masqués silencieusement + « Avantage » nombre magique.** RollLine n'affiche les chips que si `somme(mods) === d.modifier` (RollModal.tsx:16-17). Trois voies cassent la réconciliation : (a) `rederivePassiveAttack` reconstruit SANS `distanceTiles` (combat.ts:640-650, commentaire le reconnaît) après une Chance « +1 DR » → bande de portée perdue ; (b) le plafond Combiner-les-Difficultés (+60/−30, combat.ts:178-188, LDB 14 l.126-131) mord même au 1er jet ; (c) libellé « Avantage +30 » n'expose pas `advantage*10` (combat.ts:203-204). Remède : **toujours montrer les chips connus + une ligne reliquat « Autres/Plafond −N »** (chips+reliquat===modifier) au lieu du repli binaire ; propager `distanceTiles` dans `rederivePassiveAttack` (dispo via `dist`, combatFlow.ts:533) ; libellé `Avantage ×${advantage} = +${adv}`.

5. **[majeur] Défense sans contexte de l'attaque entrante.** `PendingDefense` porte `atk` (TestResult figé), `weapon`, `freeKind` (store.ts:332-348 ; combatFlow.ts:971-983) mais DefenseModal pré-défense (`!res`, lignes 45-66) n'affiche que Parade/Esquive. Remède (données gratuites) : portrait+PV+couleur attaquant (via attackerId), menace sans spoiler le d100 (`pd.atk.target` vs Parade/Esquive), nature `freeKind` (« Morsure »/« Caudale »/« Piétinement »), surbrillance case attaquante + trait sur l'iso. **Réserve :** la « charge/portée » N'EST PAS dérivable sans nouveau flag (`chargedThisTurn` n'est pas transporté dans le pending) — l'ajouter explicitement ou l'omettre, ne pas le présenter comme gratuit.

6. **[mineur] Verdict & log : chiffres non attribués.** `rm-verdict` concatène localisation/woundsLost/netSL/CRITIQUE (RollModal.tsx:114-127 ; DefenseModal.tsx:75-81) ; `res.log` = prose brute (combat.ts:598-603). L'Avantage gagné (`advantageTo`, combat.ts:596) est carrément ABSENT de l'affichage. Remède : aligner l'APRÈS-jet sur l'AVANT-jet (RollLine est déjà bon) — verdict structuré teinté par camp, décomposition à deux étages RAW (LDB 13 l.160 + l.169 ; BE/PA séparés via un champ `soak?` optionnel sur AttackResult plutôt que re-parser la chaîne).

---

## FACETTE 4 — FILE DE MODALES & RESPIRATION

**Ce que vit le joueur :** modale-sur-modale, prompts de défense qui enchaînent (Morsure→Piétinement) sans pause ni distinction, deux overlays qui peuvent se cumuler sans priorité.

**LOT 4 :**

1. **[majeur] Aucun arbitre d'unicité des modales.** Les 24 modaux sont des siblings inconditionnels (CampaignView.tsx:121-144), même `.modal-overlay` z-index:100 (styles.css:254-261) → l'empilement dépend de l'ordre JSX, pas de la priorité sémantique. Chemin concurrent RÉEL : dans `case 'move'`, `approachFearTrigger` (l.2177) peut pousser un reveal 'calme', puis 350ms après `maybeOpenDefense` (sans garde sur `pendingReveals`) pose `pendingDefense` → DEUX overlays cumulés (fond double-assombri, DefenseModal recouvert par RevealModal monté plus tard). Remède : un sélecteur central `pickActiveModal(state)` à priorité explicite (FateSave > Fumble > Deviation > Cleave/Trample > Reveal > Defense > Psych > RoundStart > actions joueur) ne rendant QUE la plus haute ; les autres pending* en file. Point unique pour le beat de respiration. Corriger aussi `dismissReveal` (store.ts:2763) pour inclure `pendingDefense` dans son garde de reprise.

2. **[majeur] Attaques gratuites enchaînées sans beat.** `aiCreatureFreeAttacks` (combatFlow.ts:1409-1443) itère en `while` ; `defenseConfirm`/`defenseCancel` (store.ts:2984,3006) le rappellent **synchronement** → le prompt suivant surgit dans le tick du clic « Appliquer ». Ni anim, ni ligne journal entre deux. DefenseModal n'affiche pas `pd.free`/`pd.freeKind` (existent, posés l.982). Remède : au resolve d'une free attack, émettre son anim + ligne « X enchaîne : Morsure » + `setTimeout(~350-500ms)` avant le prochain ; badge « Attaque gratuite — Morsure » (affichage pur).

3. **[majeur] Journal sous-exploité comme fil de lecture.** Le `case 'move'` ne logge RIEN (« X avance vers Y »), la Charge ne logge rien (« X charge ! (+N Av) »), `maybeOpenDefense` ne pré-annonce pas la mêlée (seul le tir le fait, doAttack:993). BattlePanel = 9 lignes (BattlePanel.tsx:70) ; journal HUD-gauche masqué en combat (CampaignView.tsx:65). Remède : journaliser chaque beat IA AVANT l'ouverture de la modale ; allonger/marquer-par-Round la fenêtre ; pan caméra animé synchronisé sur ces lignes.

---

## DÉPENDANCES INTER-FACETTES

- **Synchro glisse↔modale (F1.1) ⇄ caméra suit le token (F2.1) ⇄ off-by-one/STEP_MS unifié (F2.4).** Les trois partagent la même horloge. **Prérequis commun : exporter `STEP_MS`+`walkDuration` d'un seul module et créer un event `ANIM_MOVE_DONE`** (inexistant — bus.ts n'a que ANIM_ATTACK/IMPACT/MOVE/TIME_ADVANCED ; la ligne 44 d'useRigAnim émet ANIM_IMPACT, pas un move-done). Faire ce socle EN PREMIER débloque proprement F1.1, F1.5 et F4.3.
- **Sélecteur central de modales (F4.1) débloque** la sérialisation Reveal-d'approche → Défense (règle « gratuitement » l'ordre sémantique du symptôme « modale-sur-modale ») ET fournit le point d'insertion unique du beat de respiration (F4.2) et de la phase d'établissement (F1.3).
- **teamColors/RigPortrait dans les modales (F3.3) est le socle visuel** réutilisé par l'enrichissement de la DefenseModal (F3.5) et le verdict teinté (F3.6).
- **Télégraphe de mêlée (F1.4) consomme** le contexte de charge que F3.5/F4.3 doivent aussi surfacer (`chargedThisTurn`/`gainedAdvThisRound`, déjà posés l.2186-2188) — un seul flag à transporter sert les trois.
- **`chosenWeapon` centralisé (F3.1)** protège aussi la cohérence des LOGS de F4.3 (combatFlow.ts:993/999 re-dérivent firedWeapon).

---

## MODÈLE DE CHORÉGRAPHIE proposé (point de départ, NON verrouillé)

Pour un tour ennemi « charge au contact », remplacer la cascade de `setTimeout` magiques par une **chaîne pilotée par les fins d'animation** :

1. **Plan d'ensemble (établissement).** À startCombat : champ visible, caméra fit-to-combatants, anneaux des deux camps, frise d'Initiative persistante dans BattlePanel (pas de modale). Surprise = bandeau distinct si embuscade. IA gelée par `establishing`.
2. **Annonce de tour.** Bannière « Tour de X » (existe déjà, BattlePanel turn-banner) + léger pan/zoom caméra sur l'acteur.
3. **Télégraphe d'intention.** Halo sur X + ligne X→cible (généraliser `enemyAim`), ~400-600ms ; étiquette « X charge » si Avantage de charge.
4. **Mouvement animé + caméra qui SUIT.** Glisse `walkXY` avec easing ; `focus = walkPosOf(...)` pendant la marche ; halo/stroke actif ancré au token mobile ; journal « X avance vers Y / charge ! ».
5. **Attendre `ANIM_MOVE_DONE`** (à créer) + beat de présence (~150-250ms) : X immobile, orienté (faceFromPath déjà posé).
6. **UNE modale contextualisée.** Via le sélecteur central : Défense avec portrait+PV+couleur des deux, menace (`pd.atk.target` vs Parade/Esquive), nature (charge/free attack), case attaquante surlignée derrière une modale **non-opaque** (alléger le voile rgba 0.6 pour laisser voir « d'où »).
7. **Respiration entre modales.** Free attacks (Morsure/Piétinement) intercalées d'anim + ligne journal + court délai, jamais synchrones au clic. Multiplicateur global de vitesse pour le ressenti « trop vite ».

Ce socle (event de fin d'anim + STEP_MS unifié + sélecteur de modales + identité visuelle partagée) est le **chemin critique** : il transforme les quatre symptômes (téléportation, modale-sur-modale, défense sans contexte, valeurs opaques) en un flux lisible « plan → télégraphe → mouvement suivi → une modale contextualisée → respiration ».

---

Fichiers à toucher par lot : **F1** `src/state/combatFlow.ts`, `src/state/store.ts`, `src/gameIso/walkPath.ts`, `src/gameIso/bus.ts` · **F2** `src/gameIso/IsoStage.tsx`, `src/gameIso/useRigAnim.ts`, `src/gameIso/usePlanAnim.ts`, `src/gameIso/BodyToken.tsx`, `src/gameIso/walkPath.ts` · **F3** `src/ui/RollModal.tsx`, `src/ui/DefenseModal.tsx`, `src/state/store.ts` (PendingAttack/PendingDefense), `src/engine/combat.ts`, `src/engine/weaponDamage.ts`, `src/ui/teamColors.ts`/`RigPortrait.tsx` (réutilisation) · **F4** `src/ui/CampaignView.tsx`, `src/state/combatFlow.ts`, `src/state/store.ts`, `src/ui/BattlePanel.tsx`, `src/ui/DefenseModal.tsx`.

