# Codex — couche relationnelle (références inverses, index, auto-liage)

Le Codex (`src/ui/compendium/`) dérive TOUT du JSON `src/data` (aucune scène/règle en dur). Au-delà
des faits-clés et des références AVANT (déjà projetées par `registry.ts`), la richesse vient d'une
**couche relationnelle** : `src/ui/compendium/relations.ts`.

## Deux principes (non négociables)

1. **Data-driven** — la sémantique vit dans le JSON ; `relations.ts` ne fait qu'**inverser** des
   références DÉJÀ structurées. Aucune regex, aucune table en dur.
2. **Multilingue (possibilité)** — toute relation est **id-based** (clé STABLE), jamais un libellé.
   Les `label` portés par les `Referrer` ne servent qu'à l'affichage (= `CodexItem.label`, résolu par
   `codexLookup`). Seule brique langue-dépendante : l'**auto-liage** de prose, *locale-scoped*
   (matcher dérivé des libellés de la locale active), jamais une chaîne FR en dur.

## `relations.ts` — ce qu'elle expose

Construite UNE fois au chargement, en inversant les refs de `src/data` :

| Source (ref AVANT) | Cible (réf INVERSE) |
|---|---|
| `creature.traits/optionals/skills/talents/spells/trappings` | trait/compétence/talent/sort/possession ← créatures |
| `careerLevel.skills/talents/trappings/characteristics` | … ← carrière (détail `N{level}`) |
| `species.skills/talents` + carrières accessibles | … ← races ; carrière ← races y accédant |
| `talent.passive` (`grantCareerSkill/Talent`, `charMod`) | compétence/talent/caractéristique ← talents |
| `skill.characteristic` | caractéristique ← compétences |
| `trapping.qualities/subType` | qualité ← équipements ; groupe d'objet ← objets |
| `class.trappings` | possession ← classes |
| `trait.grantsManeuvers` | manœuvre ← traits l'accordant |
| `mutation.traits` | trait ← mutations |
| `spell.domainId` + `gods.blessings/miracles` | domaine ← sorts ; sort ← cultes |
| ops `condition` des effets (Sort `Flow`, Trait/Qualité/Talent/Domaine `TriggeredEffect[].flow`) | **état ← ce qui l'inflige** (via `spellEffectOps`, zéro parsing maison) |

- **`reverseGroups(category, id)`** → groupes de référants (par catégorie, dédupliqués, détail fusionné,
  ordre stable). Consommé par `registry.ts` via le helper `reverseSections(...)` (sections de chips cross-réf).
- **`bookContents(...abr/label)`** → contenu d'un livre GROUPÉ par type (« le livre comme index »).
  Câblé sur la fiche Livre APRÈS construction de `CODEX` (les libellés de catégorie n'existent qu'alors).
- **`labelIndex()`** → libellé normalisé → (category, label), ambigus/courts écartés.
- **`tokenizeLinks(text, selfLabel?)`** → tokenise une prose en texte + mentions à LIER (auto-liage du
  vocabulaire de RÈGLES : carac/compétences/talents/états/manœuvres/traits/qualités/domaines), hors
  liens vers soi, hors noms propres. Rendu par `<LinkedText>` (CodexEntry) — texte BRUT seulement.

## Barre de catégories — sous-groupes repliables (`cluster`)

Les familles touffues (**Effets** ~28 catégories, **Tables** ~35) affichaient une *avalanche* de
pastilles à plat. Chaque `CodexCategory` porte désormais un champ optionnel `cluster` (libellé FR du
sous-groupe) : `clustersIn(group)` éclate les catégories en pastilles **à plat** (sans `cluster`) +
**sous-groupes repliables** (`CodexCluster`, un par `cluster`, ordre de déclaration préservé).
`CompendiumScreen` rend chaque cluster comme un `<details class="fold codex-catfold">` (primitive
`.fold`, **fermé par défaut**, compteur de catégories visible) ; il s'ouvre automatiquement si la
catégorie active y vit (arrivée par cross-réf). Les pastilles restent des `<button>` (a11y inchangée).
Sous-groupes actuels : Effets → *Blessures critiques*, *Critiques de navire*, *Critiques fluviaux* ;
Tables → *Création de personnage*, *Calendrier*, *Voyage terrestre*, *Rencontres*, *Mer & rivière*,
*Bataille de masse*, *Équipage & navire*. Garde : `registry.test.ts` (tout cluster ≥ 2 catégories,
éclatement sans perte). Regrouper une catégorie = poser `cluster: '…'` sur son littéral, rien d'autre.

## Étendre

- **Nouvelle relation inverse** : ajouter l'arête dans `relations.ts` (`addReverse(targetCat, id, by)`),
  un titre dans `REVERSE_TITLE` si besoin, et `...reverseSections(cat, id)` dans la catégorie du registre.
- **Nouveau champ de fiche** : enrichir l'`item` dans `registry.ts` (méta `fact(...)` ou section via les
  helpers `describe.ts` — `passiveSection`/`effectsSection`/`careerGrantSection`/`spellFlowSection`).
- **Exergue de fiche** (`CodexItem.exergue`, Markdown verbatim) : citation/tract levé en tête de fiche sur
  `ParchmentCard` (slot `band` de `TabbedEntry`). Pour les Carrières, `extractEpigraph(desc)` sélectionne
  MÉCANIQUEMENT le couple citation `« … »` (ou `*« … »*`) + attribution (tiret) — convention d'épigraphe
  LDB ch.2, 93/96 carrières — et le retire du corps (pas de doublon). Aucun champ JSON ajouté : extraction
  structurelle depuis la desc verbatim. Garde : `registry.test.ts` (extraction + rendu `.parchment-card`).
- **Riders / effets / formules de sort en clair** : `effectsSection`/`spellFlowSection` rendent d'abord la
  phrase JOUEUR (`src/ui/compendium/humanize.ts` — registre naturel : `humanizeFlow`/`humanizeCondition`/
  `humanizeOp`/`humanizeFormula`, switchs EXHAUSTIFS, zéro id brut), la forme technique d'atelier
  (`flowSummary` → `condSummary`/`opSummary`) restant dépliée dans un bloc « Détail technique »
  (`CodexRow` `t:'fold'`, primitive `.fold`). Garde : `humanize.test.ts` (itère `domains.json`/`spells.json`).
- **Édition** : tout reste éditable au Compendium (DEV) ; les VIEWS (Psychologie) ne sont pas éditables
  (`isEditableCategory=false`) — éditer la source (Traits).

Tests : `relations.test.ts` (inversion vérifiée DEPUIS la donnée) + `registry.test.ts` (projection
bout-en-bout). Format JSON canonique garanti par `serialize.test.ts`.
