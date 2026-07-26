---
name: game-toise-echelles
description: "Convention d'échelles visuelles (2026-06-11) : l'art des modèles = nuance intra-catégorie SEULE, la Taille (sizeTokenScale) agrandit — garde-fou toise.test.ts + galerie Toise"
metadata: 
  node_type: memory
  type: project
  originSessionId: dbb7bc70-76e7-4534-b7a5-d556ce0815d1
---

**Convention actée par l'utilisateur (2026-06-11)** : tout modèle est dessiné/calibré à la
baseline **Moyenne** — son échelle d'art (`sl` des CreatureDef, `race.scale`, `perso.scale`)
n'exprime que la **nuance intra-catégorie** (elfe > humain > nain ; pégase > cheval), bande
~0.5-1.35. Seule la catégorie de Taille agrandit, via `gameIso/sizeScale.ts` :
moyenne 1 · **grande 1.45 · énorme 2.0 · monstrueuse 2.7** (ré-ancré PROPORTIONS face à un
humain, PLUS le remplissage de l'empreinte N×N — l'empreinte T6 reste la vérité d'OCCUPATION,
le visuel peut être plus petit qu'elle).

**Why** : avant, les deux axes se MULTIPLIAIENT (les sl/perso.scale dataient d'avant le
système de Taille et exprimaient l'absolu) : Géant art 2.4 × Énorme 2.6 = **×6.2 rendu**,
cheval ×1.8→« 3 fois le personnage » (plainte utilisateur). Recalibré commit `9d8abb6` :
cheval 0.9 (final ×1.30), Dragon 1.25 (×2.5), Géant 1.2 (×2.4), Hydre/Basilic/Manticore/
Ours/Varghulf/jabbers descendus en bande.

**How to apply** :
- Nouvelle créature : `sl` ≈ 1 (±0.35 de nuance), JAMAIS pour exprimer « il est grand » —
  ça vient du trait Taille du statbloc (parsé au spawn).
- Garde-fou : `src/gameIso/toise.test.ts` (balaie creatures.json, refuse art hors bande) +
  galerie **`public/toise-gallery.html`** (`gen-toise-gallery.mts`, humain de référence en
  filigrane, cellules à l'échelle entre elles).
- L'échelle d'art se lit par `resolveRender(species, traits, idOrName)` (`rig/bodyPlan.ts`), qui
  rend `{kind, plan, species, scale}` : le `scale` vient de `speciesScale(…)` pour TOUS les plans
  (nuées, plans non-bipèdes, rig bipède, repli) — aucun plan n'a de chemin d'échelle à part.
- **Ratio cavalier DÉRIVÉ** dans `MountedToken` : `resolveRender(rider…).scale / (mr.scale ×
  sizeTokenScale(mount.size))` (`mr` = la résolution de la monture) — pas de RIDE_SCALE dur ;
  monter ne change plus la taille monde, et toute nouvelle monture est proportionnée gratis.

Prolonge [[game-footprint-multicases]] (empreinte = occupation, découplée du visuel) et
[[game-mutation-appearance-data-driven]]. Chantier suivant demandé : refonte esthétique des
non-humanoïdes (« tous affreux ») + nouveaux props de personnalisation.
