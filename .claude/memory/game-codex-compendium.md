---
name: game-codex-compendium
description: "Foundry/Game : Codex en jeu (Compendium) + primitive CodexRef + datasets Étoiles/Lieux/Livres/Dieux + export/import héros — livrés 2026-06-13."
metadata: 
  node_type: memory
  type: project
  originSessionId: 51a3d70e-8940-4706-88c1-14273fb078cb
---

Chantier « améliorations inspirées des outils cgauche.github.io/Warhammer » (v2/dev/index =
char-gen + Compendium). 6 features livrées + committées sur `feat/wfrp4-rpg-foundation`. Plan :
`~/.claude/plans/goofy-imagining-mochi.md`.

**Codex en jeu** (`src/ui/compendium/`) : écran `CompendiumScreen` (Screen `'compendium'` + store
`openCodex(focus?)`/`compendiumFocus`/`compendiumReturn`), master-détail (familles `.seg` →
catégories `.chip` → liste `.listrow` → `CodexEntry`). **`registry.ts` = SOURCE UNIQUE des
catégories : ajouter une catégorie = 1 entrée** (16 catégories). `search.ts` (deburr substring).
Rend texte ET HTML (`dangerouslySetInnerHTML`, gods/books). Bouton « 📖 Compendium » au MainMenu.

**`CodexRef`** = LA primitive popover du jeu (il n'y en avait pas) : `<CodexRef category label>`
résout via `codexLookup(category,label)`, popover desc+source au survol/focus (CSS pur), clic →
`openCodex`. **Montée partout où une entité s'affiche** : CharacterSheet (signe/skills/talents/sorts/
sac), InspectPanel (traits/skills/états), EquipmentPanel (cape/armure/armes), **EffectChips** (chip
d'État PARTAGÉ → tous les sites d'États d'un coup ; `conditionEffect` supprimé, devenu mort), creator
(SkillChip/TalentChip + récap). REMPLACE les `title=desc` (pas de doublon, cf. [[game-supprimer-legacy]]).
RESTE (titres d'aide d'action gardés, hors Codex) : **ActionBar** (boutons sort/conso — besoin de
restructurer pour héberger un popover dans un `<button>`), éditeur, InterludeScreen ; MerchantPanel
sauté (montre déjà la desc dans son panneau détail).

**Données** : `star`/`lore`/`book` existaient bruts dans `all-data.json` → émis par `build-data.ts`
(filtrés `ALLOWED`) : `stars.json` (24→23, sentinelle test `rand>100` « TEST » écartée), `locations.json`
(55), `books.json` (28). **Dieux** = on ÉTEND `CultDef` (`desc`+`source`) + le bloc cultDefs de
build-data (PAS de `gods.json` concurrent du module `cults/` //), Codex lit `CULTS`. 13 cultes.

**Étoiles création** : `rollStar(rng)` (creation.ts), `draft.star` (rolledDetails), `Combatant.star?`,
select à l'étape Détails, 🌟 sur la fiche. Effet de carac ADE2 = flavor (à sourcer avant d'appliquer).

**Export/Import héros** : `roster.rosterExport/Import` (tag `{kind,v,hero,wealth}`, garde hero.id) +
`fileIo.downloadText` (motif unique, SaveLoadModal/Editor refactorés dessus) ; PartyScreen « Mes
personnages » Exporter/Importer. Sert backup + coop d'un ami.

**B2 tail livré** : ActionBar (sort/conso/munition) = ℹ️ CodexRef À CÔTÉ du bouton (pas dans un
`<button>`) + `hideIfUnknown` (pas d'icône morte pour objet custom). Éditeur (champs texte libres)
et Interlude (sélecteurs natifs + desc déjà visible) = pas de surface popover-able (limite plateforme,
pas de dette).

**Recette navigateur FAITE (OK)** : Codex 16 catégories, lore HTML des Dieux, responsive 360.
2 bugs trouvés+corrigés : (1) clé de liste en double (`key={label}` → `${label}__${i}`) ;
(2) **POPOVER COUPÉ** par `overflow:auto` des fiches → **CodexRef rend le popover en PORTAL
(document.body) en position:fixed** (positionné depuis getBoundingClientRect, z-index 9999,
pointer-events:none, survol=peek / clic=Codex). LEÇON : un tooltip dans un conteneur scrollable
DOIT être porté hors flux. Suite 3248/3248 verte.

**Parseur unifié `engine/statEntry.ts` (2026-06-14, commits 7b2e903/6582dcb/0deb668)** :
`parseStatEntry(raw)` = LE parseur canonique UNIQUE des chaînes de statbloc (name/arg/count/bonus/
indice/range), partagé par combat ET Codex ET inspection. A absorbé tous les parseurs maison :
`parseTrait` (traits/dispatch), `weaponFromTrait`+`skillsFromBook` (spawn), `creatureAttacks`+
`venomDifficulty` (creatureAttacks), et `splitLabel`≡`parseSkillRef` fusionnés en UN `splitLabel`
(défini dans statEntry, ré-exporté par careerSlots ; `parseSkillRef` supprimé). Step 2 gère les
parenthèses MULTIPLES (« À distance (Arbalète) +9 (60) » → arg+range). **NE PAS réintroduire de
regex de statbloc ailleurs.** `InspectPanel` réécrit : ne recopie plus 6/10 caracs à la main →
réutilise `CodexSections` (exporté de CodexEntry) alimenté par `combatantSections(c)` (registry) =
MÊME rendu que la fiche Codex (toutes caracs « – » incluses, armes/armure dérivées, traits/skills/
talents/sorts cliquables). Recette FAITE (scénario `pieuvre-lanceur`, Eusapia Balacañon : 6 sections,
badge 🪄, arme dérivée du trait). Tests : statEntry.test (20) + spawn.test + InspectPanel.test (11).

Piège : `build:data` régénère `_index.json` (timestamp) ; committer ses seuls fichiers en arbre
partagé (cf. [[feedback-no-commit-surgery-shared-tree]]).
