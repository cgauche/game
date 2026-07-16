---
name: game-frenchy-bzh-creatures
description: "Source fan « frenchy.bzh » (Habitants & Créatures du Vieux-Monde, v4.5) — conversion .md, table de correspondance frenchy→notre VF, intégration créatures"
metadata: 
  node_type: memory
  type: project
  originSessionId: c558bab7-9b0b-4027-ad11-39413de802cf
---

Nouvelle source demandée par l'utilisateur (2026-06-14) : guide fan **« Warhammer v4.5 — Habitants & Créatures du Vieux-Monde »** (Discord), à **tagger `source.book = 'frenchy.bzh'`** ; fan-made mais **complète** le bestiaire (ne remplace rien).

- **PDF 630 p. converti** en .md (84 chap.) via `_convert_pdfs.py --root Game/Source --only "*Habitants*"` → `Game/Source/Warhammer - Habitants & Créatures  du Vieux-Monde (Discord) PDF/`.
- **Appendices A-D** = table d'équivalence 3 colonnes **frenchy perso | Khaos-officiel (= NOTRE VF/LDB) | VO Cubicle 7** (Talents/Traits donnés dans les 2 sens). C'est le doc lui-même qui fournit `frenchy → VF`.
- **Générateur** `scripts/frenchy/build-term-map.mjs` → `scripts/frenchy/term-map.json` : mappe `frenchy → notre label EXACT` (officiel normalisé : casse/accents/œ/params `(…)` retirés ; bascule sur la **VO** via `VO_OVERRIDES` pour les dérives d'édition + **false-friends** — ex. frenchy *Déterminé*=notre **Obstiné**, *Navigation*=**Voile**, *Tireur d'Élite*=**Tir mortel**). Couverture : skills 45/48, talents 166/188, traits 85/139.
- **Trous** classés : `gap-no-official` (homebrew v4.5 / livres non traduits ou hors périmètre : Lustria, Sea of Claws, Winds of Magic, Imperial Zoo, companions VO…) vs `gap-missing-in-ours` (officiel existe mais non extrait — **surtout des traits EdO AUTORISÉS** : Amorphe, Métamorphe, Voleur de Chair, Contagieux, Décérébré, Absorption).

**Pièges intégration (à respecter) :**
1. ⚠️ Règle « v4.5 » : **PA ×2 + ignore le BE**. Notre moteur est RAW (BE rendu auto) → **diviser leurs PA par 2 à l'import** (trait *Armure (X)* + armures portées). Houserule boucliers-vs-tirs : ignorer.
2. Structure **« Niveau 1-4 »** = homebrew (le v4 = 1 statbloc + traits) → décider variantes vs palier unique.
3. `src/data/*.json` est **app-owned** et `build:data` **écrase** → maison durable des créatures frenchy = dataset curé fusionné via `index.ts` (cf. criticals.ts/mutations.ts), **PAS** all-data.json.

**Décisions (prises 2026-06-14)** : Niveau 1-4 → **4 variantes distinctes** ; traits EdO manquants → à ajouter à `traits.json` (mais AUCUN créature Part II ne les utilise → reporté, orthogonal) ; trous sans-VF → **custom hors-moteur** (libellé officiel sinon VO conservé).

**LIVRÉ (Partie II COMPLÈTE, bestiaire ch.32-78)** : `scripts/frenchy/import-creatures.mjs` (PART_II **auto-scanné** 32-78) → `src/data/frenchy-creatures.json` (**165 créatures**), mergé dans `creatures` via `src/data/index.ts`, survit à build:data. Détection ancrée **table de caracs** (Niveau 1-4 ET créatures nommées) ; PA÷2 ; Peur/Terreur des titres ; `Traits Optionnels`→`optionals[]` ; sorts→`spells[]` (non mappés) ; dédup vs officiel ; nom = en-tête non-label le plus proche (skip statut Cuivre/Argent/Or + footnotes). Résiduel custom (intentionnel) : `Redoutable`(=Menace/Grim Imperial Zoo, hors périmètre), qq abilities daemon homebrew (`Distraction/Attrayante/Sens de la Magie/Aura de Dhar`). typecheck + golden OK.

**EdO traits manquants : VÉRIFIÉ INUTILE** — aucune des 165 créatures ne les référence → item abandonné.

**PARTIE I (Habitants) IMPORTÉE** (user a confirmé « oui ») → scan élargi à **ch.11-78**, **280 créatures** au total. Collisions de rangs (« Sergent/Capitaine/Jeune Recrue » entre groupes) résolues par **qualification du label avec le groupe** quand >1 occurrence (`Sergent (Patrouilleurs Ruraux)`) ; les noms déjà uniques (`Sergent du Guet`, `Apothicaire`) intacts. char 100% parsé, 0 doublon. Résiduel custom inchangé (Redoutable + qq homebrew daemon/undead).

**APPARENCES = AUTRE SESSION** (2026-06-14). Elle édite le MÊME importeur : `appearanceFor(group,name)` (≈l.259, folder→species : Skaven/Homme-bête/Démon/Démonette/Guerrier du Chaos…) + injection trait `Nuée`/gabarit swarm. Défensif (undefined sinon → Humain, OK pour PNJ Part I). J'ai **RETIRÉ ma couche de préservation** d'appearance (elle figeait leur itération). Édits surgicaux hors de leurs régions (scan + dédup/qualif en main). Edit échoue si conflit → sûr.

**Recette navigateur OK** (data chargée dans le bundle : 342 créatures dont 280 frenchy, 0 erreur console).

**Corrections de parsing (2026-06-14, demandées par user)** :
- **BUG majeur** : en-tête `|Compétences Utiles|Compétences Utiles|` (2 cellules) ignoré par le détecteur de section → **69 créatures avaient 0 skill** (tous les démons). Fix `headerName` : table dont TOUTES les cellules matchent `/comp[ée]tences/` → section Compétences. Résultat 69→6 (les 6 = nuées/essaims, légitimes).
- `Distraction` : **trait**→`Perturbant` (alias TRAIT-only, `TRAIT_ALIASES`) MAIS **compétence**→`Divertissement` (intact). Piège : terme ambigu entre catégories → alias par catégorie, jamais global.
- Shaman Orc : table malformée `|shaman 3|Leader|…` → `traitName()` saute le marqueur de palier en cellule 1 → capture `Meneur`/`Intelligent`.
- **Talents renommés par le fan** (mis en « Traits & Talents ») : `Attrayante`=Attractive→`Attirant`, `Blablater`=Blather→`Baratiner`, `Sens de la Magie`=Magical Sense→`Perception de la magie` (`TALENT_ALIASES`, cat=talents) → routés en `talents[]`, PAS traits. (User a flaggé : ce ne sont pas des homebrew.)

**Traits homebrew VRAIS** (sans équivalent WFRP4) : `src/data/frenchy-traits.json` (3 : `Aura de Dhar`, `Aura de Mort`, `Charnier`), descriptions sourcées, `source.book='frenchy.bzh'`, mergés dans `traits` via `index.ts` (`[...traitsJson, ...frenchyTraitsJson]`, survit build:data) + chargés dans l'importeur (`OURS.traits`) pour résoudre/tagger.

**SORTS taggés frenchy** (user 2026-06-14) : `scripts/frenchy/import-spells.mjs` (séparé de l'importeur créatures) parse les tables `|Sort VF|VO|NI|Portée|Cible|Durée|Effet|` → `src/data/frenchy-spells.json` (**138 sorts**, full data, `frenchy.bzh`), mergé dans `spells` via index.ts. Résolution des sorts de créatures **15%→87%**. ⚠️ PIÈGE découvert (user surpris « il a inventé des bénédictions ? ») : les **Bénédictions/Miracles OFFICIELS ne sont PAS dans `spells.json`** mais dans les **cultes** (`src/engine/cults/defs`, champ `blessings`/`miracles`) — filtre officiel élargi avec `stripDivine` (retire « Bénédiction de »/article, car le fan nomme par l'adjectif nu : `Courage`=`Bénédiction de Courage`). 2e bug : noms longs tronqués (s'enroulent sur `<br>` : `Marteau<br>de Justice`) → joindre les segments, ne couper qu'au ref-source (`AotE`/`WoM`/`DSLF`=Deft Steps/`p.N`…). Restant frenchy = surtout miracles de suppléments hors nos livres (DSLF). **`curation-lot8.test.ts` : sorts `frenchy.bzh` EXEMPTÉS de l'invariant « tous curés »** (repli regex assumé). Format canonique `JSON.stringify(_,null,2)` SANS newline final (sinon `serialize.test.ts`).

**3 fichiers curés frenchy mergés dans index.ts** : `frenchy-creatures.json` (280, →`creatures`), `frenchy-traits.json` (3, →`traits`), `frenchy-spells.json` (155, →`spells`). Tous au format serializeDataset.

**Reste** : `Redoutable` (20×, =Menace/Grim) → **import propre avec Imperial Zoo (ce soir 2026-06-14)** ; ~31% sorts (miracles) non mappés. ⚠️ `elements.test.ts` rouge = WIP session apparences (rig), PAS mon périmètre.

**How to apply :** régénérer = `node scripts/frenchy/build-term-map.mjs` puis `node scripts/frenchy/import-creatures.mjs --write`. Aliases statbloc≠annexe dans `STATBLOC_ALIASES`.

Liens : [[game-source-fr-campagne-custom]] · [[feedback-source-user-claims]] · [[game-francais-jamais-anglais]] · [[game-encounter-members-purge]]
