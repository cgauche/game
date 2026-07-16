---
name: game-combat-legibility-roadmap
description: "Refonte lisibilité du combat : LE plan = docs/superpowers/specs/2026-06-09-lisibilite-combat-diagnostic.md (10 racines, 4 bugs RAW, LOTS 0→9). NE PAS improviser d'items hors de ce fichier."
metadata: 
  node_type: memory
  type: project
  originSessionId: e8da4937-e7c9-443e-bf71-432062e78922
---

La refonte « on ne comprend pas le combat » a UN document de référence, construit à partir de **4 audits multi-agents** (W1 tempo/mouvement, W2 moment du jet, W3 ciblage, W4 heuristiques tactiques) :

**`docs/superpowers/specs/2026-06-09-lisibilite-combat-diagnostic.md`** (+ extraits `docs/superpowers/audits/2026-06-09-w{1,2,3,4}-*.md`, + design HUD `2026-06-08-lot1-lisibilite-combat-hud-design.md`).

77 symptômes → **10 causes racines** (R1 résolution-avant-anim · R2 séquenceur de modales · R3 jet révélé-pas-lancé · R4 couche ciblage/aperçu · R5 inspection & prévision menace · R6 HUD éco-action + garde-fous · R7 état tactique dessiné · R8 feedback+caméra · R9 légende/a11y · R10 identité visuelle modales) + **4 bugs de FIDÉLITÉ RAW**.

**Découpage en LOTS (ordre 0→9)** : LOT 0 bugs RAW (MOTEUR/TDD) → 1 socle tempo `ANIM_MOVE_DONE` → 2 séquenceur modales → 3 couche ciblage/aperçu `previewAttack` → 4 identité modales + pré-roll → 5 prévision menace `forecastEnemyActions` → 6 HUD éco-action → 7 état tactique dessiné → 8 feedback+caméra → 9 légende/a11y. 0-3 bloquants ; 5/6/7/8 parallélisables après.

⚠️ **NE PAS inventer d'items hors de ce fichier** (post-compact j'avais halluciné « bug KO 38 tours » inexistant et sorti « auto-fin de tour » comme thème alors que c'est un sous-item de R6/LOT 6). Quand on reprend : relire le diagnostic, pas la mémoire.

**Avancement (2026-06-09)** :
- **LOT 0 — LIVRÉ INTÉGRALEMENT.** RAW-1 Résilience pré-jet (propagée aux 12 modales) ✓ ; RAW-4 surnombre `outnumberMod` ✓ ; RAW-3 Allonge `reachTiles`/`meleeReachTiles` (commit 99ff219, cf. [[game-split-movement-decision]] voisin) ✓ ; RAW-2 choix localisation sur Critique forcé (commit 7067285) ✓ ; refs commentaire l.72→l.73 ✓.
- Hors-plan mais livré en // (décision utilisateur) : Mouvement décomposable + tir « Je ne bouge pas » ([[game-split-movement-decision]]).
- **LOT 1 (R1) LIVRÉ** (commit c84e820) : caméra+halo suivent le token qui glisse (walkPosOf), transition caméra coupée en marche, clip de marche = walkMs (off-by-one corrigé), STEP_MS dédupliqué. (Synchro modale↔marche via walkMs(path) était déjà là.)
- **LOT 2 (R2) CŒUR LIVRÉ** : arbitre de modales `pickActiveModalKey`/`ActiveModal` (une seule modale à la fois par priorité, commit 993735e) + plan d'ensemble d'ouverture `establishing` (Initiative hors modale → frise BattlePanel, champ montré ~1 s, IA gelée, bandeau, commit 7f24977). **DÉFÉRÉ (détails visuels, à régler quand l'utilisateur voit)** : (a) free attacks de créature espacées (setTimeout) — coûteux en tests (creatureFreeAttacks.test assert synchrone) pour un cas étroit ; (b) beat de respiration ~350 ms entre 2 modales consécutives (état transitoire dans ActiveModal).
- **LOT 3 (R4) CŒUR LIVRÉ** : `attackEnv` (source unique env, partagé résolution+aperçu) + `previewAttack` PUR (parité prouvée) ; `eligibleAttackTargetIds` → anneaux de cibles valides en mode attaque ; RollModal aperçu PRÉ-JET (toucher % + décompo des modificateurs + estimation de dégâts) ; infobulle de ciblage au survol UNIFIÉE mêlée+tir (le tir était un POC). **DÉFÉRÉ (visuel/risqué à l'aveugle)** : choix d'arme (weaponUid threadé partout), portée/LdV des sorts, libellés d'État fins.
- **LOT 4 (R10/R3) LIVRÉ** : `CombatantBadge`/`TeamPortrait` (portrait+équipe+PV) dans RollModal+DefenseModal (header + lignes de jet opposé) ; contexte de défense (`.rm-threat` : nature freeKind + DR entrant) ; frisson du dé pré-jet (`rolling` UI-local, RNG seedé intact, prefers-reduced-motion). Reste mineur : badge DisengageModal.
- **LOT 5 (R5) — DÉCISION UTILISATEUR : `forecastEnemyActions` (prévision d'intention IA + danger zones) REJETÉ** (« pas logique dans un JdR adapté de voir l'intention des adversaires » ; + l'intention changerait à chaque action joueur). NE PAS construire. L'**inspection** d'ennemi (statbloc statique, `InspectPanel` déjà existant) : l'utilisateur est tiède → à **mettre derrière une OPTION de jeu** plus tard (pas prioritaire). Donc LOT 5 = clos.
- **LOT 6 (R6) cœur livré** : `hasMeaningfulOption` (turnEconomy.ts, pur+testé) → bouton « Fin du tour » pulse quand rien à faire + confirmation 2 clics si on finit avec l'Action non dépensée. (Pastilles Action/Mouvement déjà là.) Reste : annulation de déplacement (cancelMove), coût a priori par bouton.
- **LOT 7 (R7) en partie livré** : flash de zone d'effet À L'EXÉCUTION (souffle/vomi/cri, EVT.ANIM_AOE, teinté par élément) ; tether de mêlée Engagé + nuages de fumée dessinés. (Couvert déjà visible dans le % au survol.) Reste : sorts de zone du joueur (si présents), retour « LdV coupée par la fumée ».
- **LOT 8 (R8) cœur livré** : flottants TYPÉS (EVT.ANIM_FLOAT) — touche/Encaissé/Paré-Esquivé/Raté/hors-combat (via ANIM_IMPACT) + soin +N (healConfirm) ; map kind→couleur. Reste : caméra suit les actions DU joueur (actionAim), ANIM_DEATH (chute), flottants d'État.
- **Reste : LOT 9 (légende icônes + a11y/daltonisme).** + différés : R4 micro (choix d'arme, portée sorts), LOT 2 polish (free attacks espacées, beat respiration), LOT 6 (cancelMove), inspection derrière option de jeu.
- Suite ~1934 verte, tsc clean, non poussé. Commits L6 1cf... L7 3e785fb,3994560 · L8 eed393f (cf. git log).
- **LOT 7 — PRÉCISION UTILISATEUR (2026-06-09)** : afficher la ZONE D'EFFET d'une attaque de zone / « tirer dans le tas » d'un ADVERSAIRE **au moment où il l'exécute** (souffle, vomi, sort de zone, crowd shot), comme pour le joueur → on comprend pourquoi plusieurs PJ prennent des dégâts/sont affectés. C'est du FEEDBACK À LA RÉSOLUTION (ce qui se passe MAINTENANT), distinct de la prévision d'intention rejetée (qui anticipait AVANT). À FAIRE en LOT 7 (immersion OK).
- Commits récents : c84e820 (L1) · 993735e+7f24977 (L2) · c497b92,b8edb44,fc1a205,9ee09e6,3ea9faa,06eaa5b (L3) · e6d62ad (L4). Suite ~1928 verte, tsc clean, non poussé.

Contraintes utilisateur permanentes : dépile sans laisser de dette, refacto/dédup au passage, pas de 2 systèmes en double, vire le legacy ; **ne plus lancer de workflow** (même sous ultracode — l'instruction utilisateur prime, cf. [[feedback-workflows-calibres-taille]]) ; déploiement PROD seulement à la toute fin sur ordre explicite ; build à l'aveugle, les tests remplacent le visuel.
