---
name: game-codex-tabbed-entry-harmonisation
description: Harmonisation fiche Codex ⇄ page de race du créateur — brique partagée TabbedEntry + onglets data-driven + affordance CodexRef
metadata: 
  node_type: memory
  type: project
  originSessionId: c200b807-58b0-4881-afff-0b8ebba80cc8
---

Chantier « harmoniser les primitives UX/UI » (fiche Codex vs page de race du créateur). LIVRÉ :

- **Brique PARTAGÉE `src/ui/TabbedEntry.tsx`** : en-tête (figure + titre + `aside` source + `blurb` + `meta`
  toujours visible) puis **onglets** (`EntryTab[]`, seul l'actif rendu, barre cachée si ≤1). Réutilise les
  classes GLOBALES `main-head`/`zone-tabs`/`zone-tab` de `creator.css` (importé via `styles.css`). Montée
  par le **Codex** (`CodexEntry`) ; c'est LA coquille de toute fiche à onglets — jamais un état d'onglet
  local doublé de `main-head`/`zone-tabs` manuscrits. Charte unique d'une fiche à l'autre.
- **Onglets DATA-DRIVEN au Codex** : `CodexEntry` rend `item.tabs` (CodexTab = regroupement explicite de
  sections, ex. race : `Profil`+`Carrières`+`Détails`) SINON **un onglet par `item.sections[]`** (ex. créature :
  `Caractéristiques / Traits / …`) ; `item.desc`→onglet « Description » ; `item.meta` en EN-TÊTE. Chacun
  **unique** (ses données), **même charte**. Vérifié live : `scrolls:false`.
- **SOURCE UNIQUE de la fiche de race** (`src/ui/compendium/registry.ts`) : `raceFicheTabs(s)` +
  `raceCareerSection(s)` + `raceDetailSection(s)` — projettent les MÊMES tables que le créateur
  (`careersForSpecies`, `details`, `eyes`, `hairs`) ; le **Codex** les monte via `registry.races.tabs`, et
  le **créateur** tire du même registre (`careersForSpecies`, `raceSkillSection`/`raceTalentSection` rendues
  par `CodexSections`). Le contenu d'une fiche de race se PROJETTE depuis ce registre, il ne se
  ré-implémente pas par écran. Carrières = chips cliquables
  (CodexRef) groupées par classe ; Détails = âge/taille/yeux/cheveux/noms. Leçon (user, excédé) : tant qu'on
  RÉ-IMPLÉMENTE le contenu des deux côtés on en perd des bouts (Carrières/Détails oubliés) — extraire UNE
  source consommée par les deux. Le Profil du créateur garde ses bits création-only (tirage d100, ±carac).
- **Affordance `CodexRef`** : plus de soulignement pointillé AU REPOS (`.codex-ref` défaut = pas de
  border-bottom ; indice teinte or au survol). Pointillé réservé à la PROSE hors cadre via prop `inline`
  → `.codex-ref.codex-inline`. Demande user : « pas de soulignement, c'est déjà dans un cadre ».
- **Terme canon « Races »** (LDB 04 l.84 : « 1) Races / Tableau des Races Aléatoires ») : étiquettes UI
  « Espèce » du créateur renommées (ids `species*` inchangés — cf. [[game-ids-internes-libelles-display-multilangue]]).
  `registry.races` : sections « Compétences/Talents de race » + `appearance:{species:s.label}` (aperçu rig).
- Race/Carrière/Classe/Caractéristiques rendues en `CodexRef` partout SAUF dans un élément déjà interactif
  (rail de sélection, `.char-head` cliquable de CharCard) — on n'imbrique pas un ref dans un bouton.

- **Brique CHIP d'entité UNIVERSELLE `src/ui/EntityChip.tsx`** (sweep « tous les écrans », user excédé
  par les rendus divergents) : `EntityRef`/`ChoiceChips`/`EntityChoice` + sucres `SkillChip({skill})`/
  `TalentChip({talent})`, classe **`.entity-chip`** (nouveau look unifié, base.css). `CodexRowView`
  (`ref`/`choice`) ET les écrans (créateur zones+recap, `CreatorSummary`, `CharacterSheet` talents,
  `CharCard`) passent par CETTE brique → split « A ou B » + popover + HTML IDENTIQUES partout. Vérifié
  live : codex ET créateur = 16 `.entity-chip`, « Perspicace ou Affable » en `.entity-choice`, **zéro
  `.tag`/`.codex-chip`** résiduel. `.codex-chip`/`.codex-choice` supprimés. `title=desc` d'entité →
  CodexRef (sorts sheet, classe au rail, objet en liste). Reste (Lot 7) : noms d'entité en TEXTE NU dans
  les sélecteurs/dropdowns/résultats de tirage → icône-info ; exceptions assumées (`<option>`, bouton
  d'action combat, buffs procéduraux non-Codex).

`InspectPanel` garde son statbloc empilé via `CodexSections` (contexte combat, pas d'onglets).
Prolonge [[feedback-ecran-touche-audit-primitives]] + [[game-codex-compendium]].
