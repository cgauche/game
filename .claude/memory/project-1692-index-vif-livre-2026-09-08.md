---
name: project-1692-index-vif-livre-2026-09-08
description: "#1692 LIVRÉ le 2026-09-08 (aucun index figé à l'import sur un dataset mutable : seam de version `versionDataset.ts`, index vifs, registre de tables d'étape VIF par familles, gardes structurelles) — leçons : un mémo à EFFET DE BORD n'est pas un registre ; la garde ne voit que son vocabulaire (import JSON direct, entrée de seam à valeur d'appel) ; une recette qui joue une édition refusée par le schéma conclut rouge à tort"
metadata:
  type: project
  originSessionId: 4407a64f-b0ad-4d3d-b30f-ffca252025d6
---

**#1692 livré (2026-09-08, wt-1624)** — deuxième des quatre descendants de #1686 (#1691 → **#1692** → #1694 → #1693). Forme : module FEUILLE `src/data/versionDataset.ts` (`versionDuDataset`/`bumperDataset`/`memoParVersion`/`indexParId`/`indexParChamp`), `setDataset`/`setObjectDataset`/`resetData` bumpent ; 63 index + 27 vues dérivées → lecteurs vifs ; gardes `index-vif-guard` (index figés, `src/**` non-test) et `seam-ecriture-guard` (écritures hors seam, tests compris) sur `scripts/guards/lib/bindingsVifs.mjs` ; règle `label-keyed-index` ; registre des tables d'étape (`cascade.ts`) = statiques + FAMILLES vives `registerTableStepFamily(memo)`.

**Leçons (mesurées)** :
- **Un `memoParVersion` à EFFET DE BORD n'est pas un registre** : enfermer `registerTableStep` dans un mémo lu au seul site d'ouverture laissait tout autre lecteur (cascade reprise, tests) devant un registre vide — suite complète rouge après un lot jugé vert par bancs ciblés. Le foyer juste : le registre lui-même résout par familles vives (ids ET defs dérivés de la donnée à chaque lecture).
- **La garde ne mesure que son vocabulaire** ([[feedback-un-detecteur-ne-mesure-que-sa-couverture]]) : `mutations.ts` atteignait le dataset par `import x from './mutationTables.json'` + alias nu ; `miscastMinor: miscastEntries(…)` posait un binding fantôme — deux trous fermés structurellement, 11 dérivés figés sur des datasets ÉDITABLES révélés et migrés (`campaignStart()`, `travelVehicles()`…). Un vérificateur avait classé « non éditable » des DÉRIVÉS de datasets éditables : classement faux, la source décide.
- **Une recette peut conclure ROUGE à tort** : l'édition jouée (`31-90 → 31-80` seule) était REFUSÉE par le garde de couverture d100 du schéma, le Codex restaurant l'état — diagnostiquer par sonde (chemin du `save` réel) avant de croire un rouge de recette ; la recette rejouée avec une édition cohérente est VERTE et le refus lui-même se capture.
- **Un stock nominatif n'est pas la seule forme** : la porte de stock refusait `HORS_PERIMETRE = new Set([2 chemins])` — le seam se DÉRIVE (`fichiersDuSeam()` : définit ou importe `bumperDataset`), assertion positive en corps de test.
- **`sansCommentaires` d'une garde** : un `/*` cité dans un `//` ouvrait un faux bloc et effaçait 80 lignes ; UNE alternance gauche-droite. Deux boucles infinies préexistantes (`/*` jamais refermé né d'un littéral de regex) corrigées ; la cécité aux littéraux de regex reste DITE.
- **Budget d'horloge** : [[env-budget-horloge-agents-2026-09-08]].

**Restes routés/inventoriés** : #1710 (qualité « Immobilisante » ×2) ; #1689 (`LOOKUP_VERSION`, `[bodyPlan]`, `setScreen('compendium')` sans `compendiumReturn`, « Atelier » toggle, `.worldmap-btn` ×4, chips sans sélecteur, Codex fermé pendant une cascade) ; #1463 (tables retirées, exemption verbatim `TRAVEL_VEHICLES`) ; #1679 (45 plans datés). Angle mort déclaré : partition de `TENUE_DEFS` (code généré) ; alias multi-ligne couvert ; `Object.fromEntries(x)`/`structuredClone(x)` hors motif.

**Why:** reprendre #1694/#1693 sans relire les rendus ; ne pas refaire le mémo à effet de bord ni croire un rouge de recette sans sonde. **How to apply:** tout registre alimenté par la donnée = familles vives ; toute garde structurelle déclare son vocabulaire ET ce qu'elle ne voit pas, avec cas mesurés ; un rouge de recette se diagnostique par le chemin réel du save. Liens : [[project-1691-relief-en-donnee-livre-2026-09-07]], [[project-1686-materiaux-etat-2026-09-05]], [[feedback-test-jamais-un-cardinal-vivant-ni-un-magasin-partage]], [[feedback-recette-juge-l-ecran-pas-le-mecanisme]].
