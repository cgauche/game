---
name: feedback-ecran-touche-audit-primitives
description: "Toucher un écran = l'auditer contre les primitives UI/UX + la charte, pas juste appliquer le retour"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d1df7710-7598-46e9-bcf6-19c9817b73ce
---

Quand je modifie un écran, aller **plus loin que le retour du joueur** : vérifier que l'écran **suit les primitives partagées** qu'on a créées et la charte, et corriger les écarts dans la foulée.

**À contrôler** (cf. CLAUDE.md « Primitives partagées — RÉUTILISER ») : `RollFlowShell`, `OptionChooser`/`ChoiceButtons`, `InfluenceRow`/`ResilienceButton`/`DeterminationButton`, `VsHeader`, `PortraitTile`/`CharFrame`, `CodexRef` (remplace tout `title=` descriptif), `optionValue`/`optionPending`/`testPending` (breakdown), `findTableEntry`, `baseTestMods`, `actorIn`/`inBattle`. Côté CSS/charte : tokens couleur **uniquement dans `:root`**, **contrôles stylisés custom** (jamais les widgets système), primitives `.stat-chip`/`.panel`/`.listrow`/`.seg`/`.layout-sidebar`/`.panel-grid`/`.bar`, **responsive 900/700/560** (utilisable à 360px), valeur affichée **toujours avec son label**.

**Why:** cohérence produit + source unique ; un écran qu'on touche doit ressortir **au standard**, pas juste « le bug corrigé ». Réutiliser, ne jamais réécrire à la main.

**How to apply:** avant de livrer un lot UI, passer l'écran en revue vs la table des primitives + charte → lister les déviations (widgets système, `title=` au lieu de `CodexRef`, markup ad-hoc au lieu de `.stat-chip`/`PortraitTile`, non-responsive, couleurs hex hors `:root`) → les corriger avec le reste du lot.

Prolonge [[feedback-css-architecture]], [[feedback-ui-densite-controles-stylises]], [[game-jalon9-ui-ux-charte]], [[game-codex-compendium]], [[game-charframe-unifie]].
