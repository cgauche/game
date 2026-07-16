---
name: feedback-composer-primitives-jamais-markup-brut
description: "Feedback user 2026-07-12 (verbatim : « tu as tendance à ne pas utiliser les primitives et objets React, c'est de la folie ») — les bugs d'écran sont LÉGION parce que les codeurs écrivent du markup brut ; tout brief UI doit imposer la composition, et la classe reçoit son CLIQUET."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

**Verbatim user (2026-07-12)** : « Je te montre des petits bugs mais ils sont légion. C'est le but du retravail de tous les écrans pour un rendu cohérent entre écrans (tu as tendance à ne pas utiliser les primitives et objets React, c'est de la folie). »

**Le cas d'école (hub de ville, 3380f971 + 019fa81e)** : trois « petits bugs » à l'écran — texte noir sur sombre, lignes nues sans panneau, focus UA immonde — TOUS causés par la même dérive : `<button>` bruts hors `.btn`/`.chip`, détail hors `.panel`, `<g role=button>` sans style de focus. Chaque écran écrit sans composer = une collection de bugs visuels garantie.

**Why :** mes briefs UI nommaient les primitives de STRUCTURE (ScreenShell/MasterDetail/Tabs) mais pas la couche ATOMIQUE (boutons, panneaux, chips, focus) — les codeurs composaient le squelette et écrivaient les feuilles à la main. Les portes (tsc/tests) ne voient rien : c'est du CSS/markup valide.

**How to apply :**
1. **Tout brief UI** impose : AUCUN élément interactif nu (`<button>` → `.btn`/`.chip`/primitive ; conteneur de contenu → `.panel` ; focusable custom → style de focus maison) et cite la table « Primitives partagées » + docs/charte-ui.md.
2. **La classe a son CLIQUET** (posé au programme #371) : scan structurel des `<button>` sans classe canon et des écrans plein-champ sans `.panel` — baseline gelée, ne peut que décroître.
3. À la revue d'une livraison UI : le premier réflexe est « qu'est-ce qui est écrit à la main ici qui existe en primitive ? » — avant même les portes.

Lié : [[feedback-ecran-touche-audit-primitives]], [[feedback-gardes-structurelles-pas-greps]], [[feedback-chercher-le-canonique-top-down-avant-custom]].
