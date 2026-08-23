---
name: feedback-coherence-structurelle-jusquau-bout-toutes-donnees
description: "Directive 2026-08-23 : une structure de donnée (ex. choix de spécialisation) est la MÊME dans tous les datasets et le moteur — carrières, races, créatures, talents… — jamais une forme propre par dataset ni un reste en texte"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-23T08:15:36.670Z
---

Verbatim utilisateur (2026-08-23, à propos des « Savoir (Au choix) » : créatures en texte pur, carrières déjà en `{wildcard}` mais re-parsées par regex au créateur, `specOptions` en libellés, talents/stars en littéral) :
« Ca serait bien que l'application soit cohérente dans sa structure non et jusqu'au bout, que ce soit les carrières que les races, les creatures, etc ... »

**Why :** un concept (le choix d'une spécialisation) modélisé trois fois (forme structurée ici, littéral FR là, libellés dans une liste d'options ailleurs) = trois gardes, trois éditeurs, trois chemins de bug ; et un nettoyage qui s'arrête au dataset du ticket laisse la dette vivante à côté (#1342/#1456 : les créatures étaient le gros stock, mais carrières/talents/stars/traits portaient le même défaut sous d'autres formes).

**How to apply :** quand un lot pose ou migre une FORME de donnée, l'inventaire se fait sur TOUS les datasets qui portent le concept (grep du concept, pas du fichier) et le lot couvre le moteur jusqu'au bout (plus de regex sur libellé, ids partout, un seul schéma réutilisé — ex. `advancementRefSchema {wildcard, specOptions}`) ; une forme « par dataset » ou un reste en texte = demi-migration, refusée (cf. [[feedback-jamais-de-demi-migration]], [[game-ids-internes-libelles-display-multilangue]]). Précédent : #1456 lots L4/L5 élargis à careerLevels/species/talents/stars/tables/traits sur cette directive.
