# Ajouter / curer un sort

Un sort (ou une Prière/Bénédiction/Miracle — même structure `SpellData`) vit **entièrement en
donnée** dans `src/data/spells.json` (`SpellData`, définie `src/data/index.ts` l.971-1036). Il n'y
a plus de fichier engine par sort : les métadonnées de résolution ET les effets mécaniques
sont tous les deux dans `spells.json`, édités dans le Compendium en jeu (Codex → catégorie
« Sorts »). Ce guide couvre l'ajout d'un sort neuf et la curation d'un sort narratif existant.

## 0. Tableau de bord : `docs/sorts-implementation.md`

`docs/sorts-implementation.md` est un fichier **généré** (`npx tsx scripts/gen-sorts-doc.mts`,
`scripts/gen-sorts-doc.mts`) — ne jamais l'éditer à la main. Il liste tous les sorts groupés par
`type`/`subType`, avec pour chacun :
- son état ✅ mécanique / 🟡 partiel / 📜 narratif (`spellSupport`, cf. §4) ;
- « Curé » : oui (`s.curated === true`) ou repli (pas de spec officielle — sort homebrew
  frenchy.bzh, cf. §1) ;
- le texte « arbitrage MJ » restant à journaliser (les feuilles `op:'narrative'` de son `effects`).

Régénérer après toute curation :
```
npx tsx scripts/gen-sorts-doc.mts
```
C'est le point d'entrée pour repérer un sort à curer (repli + 📜/🟡) ou vérifier qu'un ajout est
bien pris en compte.

## 1. Où vit un sort — `src/data/spells.json`

Tableau plat de `SpellData` (416 entrées au 2026-07-05, dont 278 `curated: true`). Champs
d'identité et de flavor :
- `id` : slug STABLE du libellé (cible des `Ref` — sorts de créature, listes de Bénédictions/
  Miracles d'un culte, `src/data/index.ts` l.972). Généré par `slugId()` (`src/data/slug.ts`).
- `label`, `type` (libellé d'affichage : « Béni », « Petits sorts », un Domaine…), `subType`
  (précision, ou `null`).
- `domainId` : id STABLE du Domaine de magie (`DomainData.id`) — absent pour un sort sans Domaine
  (Magie Mineure, Prière). Dérivé du libellé de `subType` **à l'authoring seulement** ; le runtime
  ne lit que l'id.
- `family` : `CastingKind` = `'mineure' | 'arcane' | 'invocation' | 'beni' | 'chaos'`
  (`src/engine/combatFeatures/types.ts` l.5) — discriminant moteur (branche d'incantation,
  `canCastFromGrimoire`, Chaos…). `type` n'est plus qu'un libellé, ne pas s'y fier pour la logique.
- `isPrayer` : Prière (Béni/Invocation) — branche d'incantation = Test de Prière (pas de Niveau
  d'Incantation, non dissipable), lue par la donnée (`castInfo`/`isArcaneSpell`).
- `cn` : Niveau d'Incantation, `null` pour une Prière.
- `source: { book, page }`.
- **`desc`** : la description mécanique — **copié/collé VERBATIM** de la source (Markdown conservé,
  jamais reformulé/résumé — règle 5 de `CLAUDE.md`). Le champ doit pouvoir être recollé tel quel
  dans le `.md` de `Source/`. Rendu en jeu par `<Prose>` (`src/ui/Prose.tsx`).

Un sort neuf s'ajoute par une entrée au tableau (Codex → « Sorts » → créer, ou édition JSON
directe pour un import massif). `id` et `label` sont validés à l'enregistrement
(`validateEntry`, `src/ui/compendium/CodexEdit.tsx` l.98) : id non vide et unique.

## 2. Portée / Cible / Durée — données STRUCTURÉES

`range`, `target`, `duration` sont des unions discriminées (plus de prose re-parsée au runtime) :

- **`range`** (`SpellRange`, `src/engine/spellRange.ts` l.15-19) : `{kind:'self'}` (« Vous »),
  `{kind:'touch'}` (« Contact »/« Toucher »), `{kind:'distance', value: Formula, unit:'m'|'km'}`,
  ou `{kind:'special', text}` (valeur non chiffrable, homebrew).
- **`target`** (`SpellTarget`, même fichier l.22-27) : `{kind:'self'}`, `{kind:'count', n: Formula}`,
  `{kind:'area', span:'radius'|'diameter', meters: Formula, excludesCaster?}` (Zone d'Effet — porte
  aussi l'ancien `zdeRadiusMeters`, SOURCE UNIQUE désormais), `{kind:'cone', lengthMeters, widthMeters}`,
  ou `{kind:'special', text}`.
- **`duration`** (`SpellDuration`, `src/engine/spellDuration.ts` l.13-18) : `{kind:'instant'}`,
  `{kind:'rounds', value: Formula}` (échelle tactique), `{kind:'clock', value: Formula,
  unit:'minutes'|'hours'|'days'}`, `{kind:'untilDawn'}`, ou `{kind:'special', text}`.

`value`/`n`/`meters` sont des `Formula` (`src/engine/ops.ts`) : littéral `number`, `{charOf: CharKey}`
(« (Force Mentale) »), ou `{bonusOf: CharKey}` (« (Bonus de FM) »). `parseFormulaMeasure`/
`parseSpellRange`/`parseSpellTarget`/`parseSpellDuration` (mêmes fichiers) ne servent qu'à la
**migration prose → structure** — jamais lus au runtime ni à l'affichage (dérivé par
`src/engine/spellRangeFormat.ts`). Pour un sort neuf, écrire directement la forme structurée
(ou passer la prose FR verbatim à `parseSpellRange`/`parseSpellTarget`/`parseSpellDuration` une
fois en script d'authoring, jamais en dépendance runtime).

Au Codex, ces trois champs n'ont pas d'éditeur dédié : ils sont couverts par le **formulaire
générique inféré** (`inferFields`, `src/ui/compendium/editFields.ts`) — un objet hétérogène infère
`kind:'object'` (sous-formulaire récursif par champ), pas un repli JSON brut (garde `no-json-fields.test.ts`
l.16-35 : aucun champ éditable ne doit retomber en `kind:'json'`).

## 3. Effets mécaniques — `effects: Flow`

`SpellData.effects?: Flow` (`src/state/flow.ts`) est le **Flow ÉDITABLE** (do/si/test) dont les
feuilles sont des `EffectOp` (`{type:'ops', on:'target'|'caster', ops: GameOp[]}`) — SOURCE UNIQUE
des effets appliqués à l'incantation (`runCombatFlow`/`runPureFlowLines`, `src/state/combatFlow.ts`).
Rien d'autre ne porte d'effet mécanique : plus de champs `summon`/`polymorph`/`lifeSteal`/
`persistentZone` séparés — tout est en `GameOp` dans le Flow (`summon`, `polymorph`, `lifeSteal`,
`zone`, `push`, `teleport`, `chain`, `wounds`, `condition`, `charMod`… — cf. `src/engine/ops.ts`).

Au Codex, ce champ a un éditeur dédié : `SpellEffectsField` réutilise le **`FlowEditor`** de
l'éditeur de scène (`src/ui/compendium/CodexEdit.tsx` l.458-470) — pose des `do`/`if`/`test`,
chaque feuille = cible (`on:'target'`/`on:'caster'`) + liste de `GameOp` via `GameOpEditor`
(`src/ui/editor/GameOpEditor.tsx`, la même primitive que sorts/traits/mutations/talents/consommables
— **ne jamais réinventer un widget de liste d'ops**, cf. table des primitives `CLAUDE.md`).

Cas particuliers à connaître avant de curer :
- **Projectile magique** : pas un `GameOp` — champs dédiés `missile: true`, `damage` (bonus additif
  + DR + BFM, LDB 46), `ignorePA`/`ignoreBE`. Lus par `missileDamage`/`isMagicMissile`
  (`src/engine/magic.ts` l.226-241). Résolu comme une attaque (`evaluateMissile`), pas par le Flow.
- **Dégâts fixes** (sorts frenchy « N Points de Dégâts », hors échelle Projectile) : op
  `{op:'wounds', amount, ignoreTB, ignoreAP}` dans `effects` — montant et mitigation d'armure
  VERBATIM de la description (`src/data/fixed-damage-spells.test.ts`). ⚠ nommage : l'op `wounds`
  utilise `ignoreTB`/`ignoreAP`, alors que les champs `missile` de `SpellData` utilisent
  `ignoreBE`/`ignorePA` — deux vocabulaires distincts, ne pas les confondre en migrant un sort.
- **Souffle** (LDB 47 p.244) : `breathAttack: true` — délégué à l'attaque de zone du Trait Souffle,
  pas un `GameOp` de `effects`.
- **Opposition** (`opposed?: { kind:'resist'|'contact', char?, skill? }`) : `resist` = Test opposé
  par la caractéristique/compétence de la cible (multijet dans la modale d'incantation) ; `contact`
  = Portée Contact, frappe via Test opposé de Corps à corps (Bagarre).
- **Invocation** : `summon` (ref = **id slug** du bestiaire, résolu par `findCreatureById` —
  jamais un libellé, cf. `src/state/spell-impure-ops.test.ts`).
- Un sort référencé depuis un autre dataset (sort de créature, liste de Bénédictions/Miracles d'un
  culte) le fait par **id stable** (`Ref`), jamais par libellé — cf. `src/ui/compendium/registry.ts`
  l.662-707 (`refLabel('spells', …)`).

## 4. Classification mécanique — `spellSupport`

`spellSupport(ops, spell, missile)` (`src/engine/spellspec.ts` l.33-48) classe un sort en :
- **`mecanique`** ✅ : au moins un `GameOp` non-`narrative` dans `effects`, OU Projectile magique
  (`missile`), OU `target.kind === 'area'`, OU `breathAttack` renseigné.
- **`partiel`** 🟡 : mécanique ET au moins une feuille `op:'narrative'` (volet « arbitrage MJ »
  journalisé à côté des effets appliqués).
- **`narratif`** 📜 : aucun `GameOp` non-`narrative`, ET (le sort porte une op `narrative` OU
  `!curated && ops.length === 0` — repli non curé).

`ops` = l'union `spellEffectOps(spell.effects)` (target + caster, `src/engine/flowCore.ts` l.537-544)
— **un effet de lanceur compte autant qu'un effet de cible** (téléportation/poussée/chaîne/
invocation/zone/vol de vie sur `on:'caster'`).

Ce badge alimente `docs/sorts-implementation.md` et l'affichage en jeu (icônes ✅/🟡/📜). Un sort
homebrew (`source.book: 'frenchy.bzh'`, `curated` absent ou `false`) sans `effects` retombe
automatiquement en `narratif` (repli) — c'est le signal qu'il reste à curer.

## 5. Curer un sort narratif → mécanique

1. Repérer le sort dans `docs/sorts-implementation.md` (icône 📜 ou 🟡, colonne « Curé » = repli).
2. Ouvrir le Codex en jeu (menu 🧪/Compendium) → catégorie « Sorts » → l'entrée.
3. Relire la `desc` VERBATIM (ne pas la réécrire) et identifier l'effet mécanisable : dégâts
   (`wounds`), État (`condition`), modif de caractéristique (`charMod`), octroi de trait/talent/arme,
   invocation (`summon`), zone (`zone`), téléportation/poussée/chaîne, drain de vie (`lifeSteal`)…
   Avant de modéliser un effet en champ ad hoc → l'exprimer en `GameOp[]` (règle générale du projet).
4. Renseigner/compléter `range`/`target`/`duration` structurés si absents (§2).
5. Éditer `effects` via le `FlowEditor` (§3) : ajouter les `GameOp` mécaniques ; ce qui reste
   irréductible (portée narrative pure, effet au jugement du MJ) reste en feuille
   `{op:'narrative', text}` — jamais inventé, jamais supprimé silencieusement.
6. Poser `curated: true` une fois la spec jugée complète pour ce sort (marque « spec officielle » —
   n'affecte QUE les sorts de la base officielle LDB/ADE/EDO/…, jamais un homebrew frenchy.bzh dont
   la trad reste hors périmètre RAW).
7. Enregistrer (bouton « Enregistrer » du Codex — écrit `spells.json`).
8. Régénérer le tableau de bord : `npx tsx scripts/gen-sorts-doc.mts`.
9. Lancer les gardes (§ suivante).

## Gardes

- `npx vitest run src/state/spell-flow-completeness.test.ts` — chaque sort porte un `effects: Flow`
  valide (feuilles `EffectOp` uniquement) ET `runPureFlowLines` exécute réellement ses ops
  (Blessures + État) ; vérifie aussi qu'il y a ≥ 220 sorts `curated`.
- `npx vitest run src/engine/spellspec.test.ts` — classification `spellSupport` (mécanique/partiel/
  narratif).
- `npx vitest run src/engine/spellRange.test.ts src/engine/spellDuration.test.ts` — parsing prose →
  structure (portée/cible/durée), non-régression des formes existantes.
- `npx vitest run src/data/fixed-damage-spells.test.ts` — sorts à dégâts fixes frenchy (montant +
  mitigation d'armure verbatim, riders par id).
- `npx vitest run src/state/spell-impure-ops.test.ts` — effets « lourds » (`summon`/`polymorph`/
  `zone`/`lifeSteal`) présents dans le Flow et résolus au lancement.
- `npx vitest run src/ui/compendium/no-json-fields.test.ts` — aucun champ de `spells` (ni d'aucune
  autre catégorie éditable) ne retombe sur le repli JSON brut au Codex.
- `npx vitest run src/data/id-collisions.test.ts src/data/refs-migrated.test.ts` — id unique, refs
  vers un sort résolvables par id stable.
- `npx tsx scripts/gen-sorts-doc.mts` — régénère `docs/sorts-implementation.md` (pas un test, mais
  à relancer après toute curation pour vérifier la bascule d'icône).
- `npx tsc --noEmit` — les unions `SpellRange`/`SpellTarget`/`SpellDuration`/`Formula` sont
  strictement typées : une valeur mal formée casse la compilation avant le runtime.
