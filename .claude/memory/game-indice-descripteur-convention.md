---
name: game-indice-descripteur-convention
description: Convention d'un attribut INDICÉ (rating) — descripteur `indice:{label}` en donnée + valeur sur l'instance + défaut `?? 1`. NE PAS réinventer (ex. `defaultRating`).
metadata:
  type: reference
---

Toute entité **indicée/ratée** (« Arme +7 », « Armure 1 », « Solide 3 », « Salve N »…) suit UNE convention — vérifier AVANT d'inventer un mot-clé :

- **Donnée (définition)** : champ **`indice?: { label: string }`** = descripteur « ceci est indicé, label affiché (Indice/Degré/Difficulté…) ». Porté par `TraitData.indice` (`src/data/index.ts`) ET, depuis le fix #657, `QualityData.indice`. Schéma zod : `z.strictObject({ label: z.string() }).optional()` (`schemas/defs/traits.ts:92`, dupliqué dans `qualities.ts` → mutualisation `common.ts` = **#727**).
- **Instance** : la VALEUR réelle vit sur l'instance (`QualityRef.value` / `TraitInstance.value`), ex. `{ id:'solide', value:3 }` = « Solide 3 ».
- **Défaut UNIVERSEL = 1** : le moteur fait partout `r.indice ?? 1` (`engine/qualities/dispatch.ts:193/200/208`). Donc « un seul → Indice 1 » n'est pas propre à une entité — c'est le défaut global.
- **Authoring** : `parseQuality("Solide 3")` (`engine/qualities/normalize.ts`) extrait l'indice du STRING par regex (legacy des qualités ; les traits, eux, portent le descripteur data).

**Leçon (user 2026-07-22)** : en data-drivant `FABRICATION_ATOUTS`, j'avais inventé un champ **`defaultRating: number`** pour l'Indice de Solide → RÉINVENTION du descripteur `indice` canonique + duplication du défaut universel `1`. L'utilisateur a demandé « le système d'indice tu as suivi le fonctionnement des traits ? » → corrigé en `indice:{label}` + `fabricationAtoutQuality` matérialise `value:1` (règle RAW du seul Atout, LDB 60 p.286) pour une qualité indicée. **Réflexe [[feedback-chercher-le-canonique-top-down-avant-custom]] : pour tout rating/valeur, chercher `indice`/`value`/`?? 1` avant d'ajouter un champ.** Piège corollaire tracé (#727) : le descripteur n'est pour l'instant posé que sur `solide`, pas sur les autres qualités ratées (Salve/Protectrice…) — un lecteur de `QualityData.indice` s'y tromperait.
