---
name: game-browser-verif-tempo
description: "Vérif navigateur d'un jeu tour-par-tour — ne pas chasser les tours d'IA async au snapshot-polling (trop lent) ; vérifier l'UI sur le 1er acteur dispo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 853bfff1-3d45-4fd3-b48b-d55440789864
---

En vérification navigateur (Playwright) du combat, **ne pas tenter de « suivre » les
tours d'IA** en enchaînant `wait` + `snapshot` pour atteindre un combattant précis :
les tours IA s'enchaînent en `setTimeout` (~450 ms) et le polling est trop lent — le
retour est en retard sur l'action. L'utilisateur l'a signalé (« tu es trop lent pour
suivre l'action des AIs »).

**Why:** un jeu tour-par-tour avance plus vite que le cycle observe→agis du pilotage
navigateur ; chasser un acteur futur fait perdre du temps pour peu de valeur.

**How to apply:** vérifier l'UI ciblée sur le **1er acteur disponible** (ex. la modale
d'attaque a été validée dès le 1er héros actif, sans skipper de tours). Pour un état
précis non atteignable au 1er tour, le couvrir par **test unitaire** plutôt qu'en
pilotant la partie live. Voir [[game-roll-modal-pattern]].

Note connexe : le serveur de dev de longue durée peut servir du **HMR périmé** (mes
changements store/RollModal n'étaient pas hot-appliqués → comportement ancien). Faire un
**rechargement franc** avant de conclure qu'une feature ne marche pas. Et le snapshot
d'accessibilité **n'expose pas** bien l'overlay `.modal-overlay` (pas de rôle ARIA) :
lire la modale via `document.querySelector('.roll-modal')`, pas via le snapshot a11y.

**Outils `window.__wfrp`** (DEV, `src/state/devtools.ts`, 2026-06-11, demandés par l'utilisateur
pour ne plus chasser les coordonnées pixel) : `__wfrp.entities()` cartographie la scène,
`__wfrp.talk('id')` téléporte le groupe + ouvre le dialogue/marchand, `__wfrp.state()` lit l'état,
`__wfrp.goto`/`screen`/`store`. **Atteindre un PNJ = `__wfrp.talk('id')`, plus de pixel-hunting.**
Documentés dans `Game/CLAUDE.md` (§ Vérification). Toujours le piège closure-sync : lire le DOM
dans un evaluate SÉPARÉ de l'appel `talk()` (React re-rend après le tick).
