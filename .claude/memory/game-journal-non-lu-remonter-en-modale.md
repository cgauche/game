---
name: game-journal-non-lu-remonter-en-modale
description: "Le Journal n'est pas lu — remonter l'important en MODALE skippable (entrée de zone, objets, dialogues)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d1df7710-7598-46e9-bcf6-19c9817b73ce
---

L'auteur considère que **personne ne lit le Journal** — c'est un reproche de fond, répété. Le pattern établi du projet est de faire **remonter en MODALE** tout élément important plutôt que de le laisser dans le Journal. Déjà appliqué aux **objets à interaction** et aux **dialogues** ; décision 2026-06-16 : l'**entrée dans une zone** affiche désormais une **modale d'intro** (skippable) au lieu d'un encart Journal.

**Why:** une info critique placée dans le Journal = info perdue (le canal n'est pas consulté).

**How to apply:** si un contenu sert la **décision** ou l'**immersion**, le présenter en **modale skippable** ; le Journal reste l'**archive consultable**, pas le canal de notification. L'intro de zone doit être **narrative**, pas du texte tuto (cf. `docs/charte-ui.md`). Source : retours playtest Jinashi, item N1 (`docs/retours/2026-06-16-jinashi-arene.md`). Cohérent avec [[game-roll-modal-pattern]] (« un jet = une modale »).
