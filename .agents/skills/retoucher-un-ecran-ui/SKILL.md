---
name: retoucher-un-ecran-ui
description: À utiliser quand on crée ou retouche un écran, un panneau, une modale ou du CSS (couleurs, densité, responsive, contrôles), ou dès qu'on s'apprête à écrire un hex en dur ou un nouveau composant d'affichage. Breakpoints canon 900/700/560, mobile 360px.
---
<!-- GENERATED: agents:sync; source=.claude/skills/retoucher-un-ecran-ui/SKILL.md -->

# Retoucher un écran UI

Lire **`docs/charte-ui.md`** (tokens `:root` seuls, modules CSS par domaine, densité, zéro texte
tutoriel) + règle stricte 4 du AGENTS.md (responsive dès la création) + la table « Primitives
partagées » (composer, jamais recréer). Toute affordance = id d'icône EN DONNÉE via `<Icon>`,
jamais un émoji (garde `no-emoji-affordance.test.ts`). Validation : skill recette-navigateur.
