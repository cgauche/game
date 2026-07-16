---
name: game-hud-bg3-handoff
description: "Refonte HUD BG3 (tuiles-portraits, plein-champ, mobile) — spec+plan committés, EXÉCUTION DÉLÉGUÉE À UN AUTRE AGENT, ne pas l'implémenter ici sans demande"
metadata: 
  node_type: memory
  type: project
  originSessionId: f2bbaf2c-1ccd-455a-9c5b-41f9cbbbe38c
---

Refonte HUD « façon BG3 » (2026-06-09) : frise d'initiative en haut + fil dessous, dock d'équipe à
gauche, tiroir journal 📜, menu ☰ (2 modes), chip date, tuiles `PortraitTile` (jauge PV verticale
INTERNE vert→orange→rouge `hpColor`, PV chiffrés dans le portrait, 4 états à droite + ▾) ; SUPPRIME
BattlePanel/LegendPanel/GroupPanel/hud-left. **But directeur : jouable sur MOBILE (tap-first).**

- Spec : `docs/superpowers/specs/2026-06-09-hud-combat-bg3-design.md` (v4, commits c347d6c→ab70a15)
- Plan : `docs/superpowers/plans/2026-06-09-hud-bg3-tuiles-mobile.md` (commit 312c5c2, 8 tasks TDD)

**Why:** l'utilisateur a dit « Ça serait fait par un autre agent » — l'exécution n'appartient PAS à
la session qui a écrit le plan ; deux sessions parallèles partagent l'arbre (CombatBanner→
`.combat-feed` déjà bougé sous nous pendant l'écriture du plan).

**How to apply:** si on me demande d'exécuter : suivre le plan tel quel (composants purs à props —
piège SSR-Zustand, cf. [[game-marchand-v1]] —, relire CampaignView/styles.css AVANT chaque édition,
commits pathspec). Si une autre session l'a déjà exécuté : vérifier `git log` / l'existence de
`src/ui/PortraitTile.tsx` avant de toucher au HUD. Prolonge [[git-commits-propres-wip-parallele]].
