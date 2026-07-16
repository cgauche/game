---
name: game-combat-legibility-tail
description: "État du diagnostic lisibilité-combat (specs/2026-06-09) après la session 2026-06-09 : 6 items livrés ce jour ; queue restante DÉFÉRÉE avec la raison de chaque report (risque cœur / effort / gate imparfait)."
metadata: 
  node_type: memory
  type: project
  originSessionId: e8da4937-e7c9-443e-bf71-432062e78922
---

Suite à `docs/superpowers/specs/2026-06-09-lisibilite-combat-diagnostic.md` (10 racines R1-R10, 4 bugs RAW, LOTS 0-9). La majorité (~32 slices) + bookends (bouton début, écran victoire) + **fenêtre d'initiative début de round** ([[game-combat-victory-start-screens]]) sont livrés.

**Livrés le 2026-06-09 (cette session, 6 commits, suite verte ~1958, tsc clean)** :
- `e0687a3` Fenêtre d'initiative à CHAQUE début de Round (in-situ, plus de RoundStartModal doublon) — cf. [[game-combat-victory-start-screens]] pt 3.
- `1515f41` **R9** daltonisme : `teamShape(isHero)` pur → anneau ennemi POINTILLÉ (BodyToken `ringDash` + RigPortrait `borderStyle` dashed). Canal d'appartenance indépendant de la couleur.
- `d0ffe84` **R6/LOT 6** `cancelMove` : instantané `battle.moveSnapshot` au 1ᵉʳ segment, restaure positions/orientation/Mouvement tant qu'aucune Action prise (aide PRÉ-Action) ; bouton « Annuler dépl. ».
- `1025fc2` **R8** caméra : `camPair` cadre la paire attaquant↔cible aussi pour un `pendingAttack` DU JOUEUR (le réticule dessiné reste ennemi-only). Corrige l'asymétrie « on voit mieux l'IA que soi ».
- `f25dd45` Inspection des combattants derrière une OPTION (`inspectEnabled` OFF par défaut, persistante comme la vue ; toggle dans l'entête de l'Ordre). Demande user (lukewarm sur l'inspection).
- `5289424` **R4** découvrabilité sort : portée/durée/cibles montrées dans le sélecteur (SpellData les exposait déjà). AFFICHAGE pur.

**DÉFÉRÉ (queue restante) — raison du report, à greenlight explicitement si voulu** :
- **R4 Sélecteur d'ARME** (`weaponUid` dans PendingAttack + `chosenWeapon` lu par TOUS les points) — le plus gros « majeur » restant. RISQUE : `firedWeapon`/`attackWeapon` lus à 10+ sites du cœur d'attaque (le chemin le plus testé) avec invariant de parité preview↔résolution (« sinon le picker mentirait à mi-flux »). L'auto-choix actuel (mêlée au contact / distance sinon) est déjà RAW-correct pour le cas courant (1 mêlée + 1 distance). Refacto cœur à faire en TDD soigneux, sous go explicite.
- **R4 GATING de portée des sorts** — les `range` dépendent des caractéristiques du lanceur (« (Force Mentale) mètres », « Vous » ×68, « (Sociabilité) mètres »…). Un parseur imparfait BLOQUERAIT des incantations valides = pire que pas de gate. À faire correctement (évaluateur caster-dépendant + 2 m/case LDB 15 l.55) ou pas du tout.
- **LOT 2 espacement des attaques GRATUITES enchaînées** (beat de respiration) — restructurer la résolution synchrone déterministe ; 12 tests en dépendent ; l'arbitre de modales (`pickActiveModalKey`) sérialise DÉJÀ à 1 modale visible. Risque > valeur.
- **R8 `ANIM_DEATH` (clip 'fall')** — la mort a déjà un flottant « ✦ hors de combat » + pose CORPSE_POSE ; le clip de chute = anim rig (useRigAnim/usePlanAnim) à fort effort.
- **R8 flottants d'ÉTAT** — `AttackResult` ne porte PAS les États appliqués (criticals/AoE les posent ailleurs) → nécessite de threader l'info dans le résultat (risque parité) ou d'émettre `ANIM_FLOAT` à des sites éparpillés. L'infra (`kind:'condition'`) existe côté IsoStage.

Prolonge [[game-combat-victory-start-screens]], [[game-playtest-feedback-lots]], [[feedback-playtest-themes-not-points]].
