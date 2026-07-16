---
name: game-hud-mobile-actionbar
description: "Barre d'action de combat — mobile-first + ressources du tour vs points permanents (refonte 2026-06-10)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9a11e89d-0497-4b0f-9249-26b8c86eb6bd
---

Refonte de la barre d'action (`ActionBar.tsx` + `styles.css`, commit 22ce09a) sur retours playtest mobile insistants.

**Principe clé (demande utilisateur) : ne mettre en avant que les RESSOURCES DU TOUR.**
- Affichées en BÂTONS colorés sans icône (survol/`title` = nom) : **Action** (or, compte l'attaque gratuite de Frénésie) + **Mouvement** (cyan). Le **PV** reste dans le portrait (`hpColor`).
- **Chance / Résilience / Détermination / Destin = points PERMANENTS, pas une ressource de tour** → RETIRÉS de la barre (« inutiles à afficher autant que PV/Mouvement/Action »). Restent sur la fiche + dans les modales (où on les dépense).
- Composant `Gauge({kind,value,max,title})` = pips colorés ; classes `.ab-g-action`/`.ab-g-move`.

**Mobile (`@media max-width:700px`)** : barre pleine largeur + `env(safe-area-inset-bottom)` ; `.ab-bar` en COLONNE (panneau héros compact au-dessus) ; hotbar `.ab-slot { flex:1 1 0; min-width:52px }` → les boutons GRANDISSENT pour remplir la largeur (tous visibles, **pas de bouton hors écran, pas d'orphelin à la ligne, pas de scroll** pour le cas courant 5-6) ; au-delà ils rétrécissent puis défilent. Sous-panneau « Spécial » empilé au-dessus (`max-height:42vh`), sans chevauchement. Vérifié à 390×844 (Playwright).
- `.ab-slots` : `flex-wrap:nowrap; overflow-x:auto` (remplace le wrap qui orphelinait « Fin du tour »).

**Modales mobile** : `.modal { width: min(520px, 94vw) }` (+ `.wide` min(760,94vw)) → plus de débord horizontal (bug Frénésie). `.modal-actions { flex-wrap:wrap }` sur mobile.

**Aussi** : hints contextuels retirés (« pas pratiques ») ; bannière Frénésie persistante retirée ; modale Frénésie ne répète plus « Frénésie » (titre + verdict).

⚠️ Vérif navigateur ENTRAVÉE : 3 sessions Claude // saisissent le même arbre → le dev server Vite recharge sans cesse (perte d'état combat). Racer les clics, screenshoter vite. Prolonge [[game-browser-verif-tempo]], [[game-modales-unification]], [[feedback-concis-pas-haiku]].
