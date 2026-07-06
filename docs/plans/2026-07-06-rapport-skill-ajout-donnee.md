# Rapport — un skill « ajouter une donnée dans un `.json` » est nécessaire

> Daté 2026-07-06. Rapport pour la personne qui construira le skill (l'utilisateur l'a demandé).
> Motivé par l'incident **#148 Bélier** : un agent Sonnet a « totalement dévié » en ajoutant une entrée
> dans `src/data/trappings.json`. Artefact de plan (supprimable une fois le skill créé).

## 1. L'incident (preuve concrète)

Brief : « curer une arme Bélier de siège dans `trappings.json` (qualité `belier` dormante) ». L'agent a
produit une entrée **fausse à plusieurs titres** — chaque erreur est un trou qu'un skill doit boucher :

| Erreur de l'agent | Réalité | Cause racine |
|---|---|---|
| **DOUBLON** : ajout d'un `id: "belier"` dans `trappings.json` | Le Bélier existe DÉJÀ dans `mass-battle.json:107-117` (table « Machines de guerre » ADE II, curée en entier : baliste, bélier, batterie…), avec `crew: 6`, `damage: "+BF +10"`, `traits: "Siège"` | **Aucune doc « où va chaque type d'élément »** + **aucun réflexe « vérifier s'il existe déjà »** (dans TOUS les fichiers/sous-systèmes, pas juste le fichier cible) |
| `enc: "ND"` (« aucune donnée d'Encombrement ») | La colonne 2 du tableau n'est pas l'Encombrement mais **« Équipe »** (nombre de servants = 6) ; l'agent a mal lu l'en-tête de table | Pas de vérif champ-par-champ contre l'**en-tête** de la source, ni contre l'entrée voisine (mass-battle capture bien `crew: 6`) |
| `book: "ADE II"` | Les **12 autres** entrées ADE II utilisent `"ADE2"` (convention de la donnée) | Pas de vérif de la valeur contre la **convention des entrées voisines** |
| `page: 8` (= le n° de chapitre) puis `page: 89` (déduit d'un `<span id="page-89">`) | Les `source.page` sont de **vraies pages** ; les ancres `span id="page-N"` du Marker **ne sont PAS fiables** (l'utilisateur l'a confirmé) ; seul l'en-tête `*Pages PDF 84-93*` du fichier est indicatif | Pas de convention documentée pour `source.page` (vraie page ? chapitre ?) ni d'avertissement sur les span-ids Marker |
| **Inflexion RAW auto-admise** : « `weaponGroup:"base"` sans modéliser le Test de **Force** (ADE II l.233), hors scope » | Le RAW dit que le bélier se manie via un Test de Force ; le moteur câble CC/CT | Le credo interdit toute **déviation RAW silencieuse** : c'est une dette (issue) ou une valeur maison taguée, jamais un choix d'agent « hors scope » enterré dans un rapport |

**Verdict** : entrée **revertie** (`git checkout HEAD -- …`, 6 fichiers). Rien de committé. Le Bélier
reste (correctement) dans `mass-battle.json`.

## 2. Causes racines (ce que le skill doit adresser)

1. **Pas de carte « où va chaque élément ».** Un « bélier » traverse **4 sous-systèmes** (`mass-battle.json`
   = machine de guerre ; `naval-traits.json` = bélier de proue de navire ; `qualities.json` = qualité
   d'arme `belier` ; `spells.json` = sort « Bélier »). Sans carte, l'agent choisit le mauvais fichier et duplique.
2. **Pas de réflexe « check-first ».** Avant tout ajout : grep de l'id ET du label ET du concept dans
   **tout** `src/data/*.json` — l'élément existe peut-être déjà dans un autre sous-système (credo : zéro doublon).
3. **Pas de vérif champ-par-champ.** Chaque champ doit être validé (a) contre la **source RAW** (en-tête de
   tableau inclus — la colonne « Équipe » ≠ « Encombrement ») et (b) contre **2-3 entrées voisines**
   (convention de `book`, format de `page`, forme des champs, keying par id).
4. **Pas de garde-fou anti-déviation RAW.** « Hors scope / je simplifie » n'est pas une option d'agent :
   RAW non modélisable → issue au gabarit #101+ ou valeur maison taguée `maison` — jamais silencieux.

## 3. Carte « où va chaque donnée » (à intégrer au skill — starter)

`src/data/*.json` = **base app-owned** (commitée, éditable au Compendium). Familles principales :

| Domaine | Fichier(s) | Contient |
|---|---|---|
| **Équipement PORTÉ** (arme/armure/objet d'un personnage) | `trappings.json` (762) | Épée, arbalète, armure, kit… tenus/portés. **PAS les machines de guerre.** |
| **Machines de guerre / unités de bataille de masse** | `mass-battle.json` (29) | Baliste, **Bélier**, batterie tonnerre de feu… (crewées, `crew`, `siege`). ⚠ Table « Machines de guerre » ADE II = ICI. |
| **Qualités/défauts d'arme** | `qualities.json` (52) + `qualityTypes`/`qualitySubtypes` | `belier`, `siege`, `devastatrice`… (le comportement, pas l'arme) |
| **Groupes d'armes** | `weaponGroups.json` (36) | Base, Escrime, Parade… |
| **Sorts** (+ skill `ajouter-un-sort`) | `spells.json` (421) | Sorts par domaine |
| **Bestiaire / PNJ** (+ skill `creer-une-creature`) | `creatures.json` (12404), `species.json` | Créatures, statblocs |
| **Carrières / classes / niveaux** | `careers.json`, `careerLevels.json`, `classes.json` | |
| **Traits / talents / compétences** | `traits.json` (145), `talents.json` (391), `skills.json` (248) | |
| **Mutations / maladies / symptômes / traumas / états / psychologie** | `mutations.json`, `maladies.json`, `symptoms.json`, `traumas.json`, `etats.json`, `psychology.json` | |
| **Critiques** (localisation, AA, navire, structure, rivière) | `criticals.json`, `aa-criticals.json`, `ship-criticals.json`, `structure-criticals.json`, `river-criticals.json` | |
| **Naval** (traits, navigation, périls, météo, cargo, chants, construction, morale, rôles) | `naval-traits.json`, `sea-*.json`, `ship-construction.json`, `crew-*.json`, `vehicles.json` | ⚠ `naval-traits.json` a AUSSI un « Bélier » (bélier de PROUE ≠ machine de siège) |
| **Activités / interlude / rencontres** | `activities.json`, `interludeEvents.json`, `rencontres-edoc.json` | |
| **Fluvial / voyage terrestre** | `river-*.json`, `land-cargo.json`, `driving-mishap.json`, `montures.json` | |
| **Monde / lieux / dieux / astres / calendrier** | `locations.json`, `gods.json`, `stars.json`, `astrology.json`, `calendar*.json` | |
| **Apparence / rendu** (registres `defs/` ailleurs — voir `creer-une-creature`) | `raceAppearance.json`, `structureAppearance.json`, `props.json`, palettes… | |

> Règle d'or : **une « machine de guerre » (table dédiée du livre) n'est PAS un trapping.** Si le livre la
> range dans une table « Machines de guerre / véhicules / navires », elle va dans le fichier de ce
> sous-système (`mass-battle.json`/`vehicles.json`/…), pas dans `trappings.json`.

## 4. Spec du skill (déroulé obligatoire)

1. **Check-first** : `grep -rniE '<label>|<id-candidat>|<concept>' src/data/*.json` → si l'élément (ou un
   synonyme) existe, NE PAS dupliquer ; l'étendre là où il vit, ou re-scoper la tâche.
2. **Choisir le fichier** via la carte (§3) ; en cas d'ambiguïté, lire 2-3 entrées voisines des fichiers candidats.
3. **Vérifier la source RAW** : ouvrir le `Source/…` (FR only), lire le **tableau ET son en-tête** (la
   colonne mal lue = l'erreur Équipe/Enc). Citer `<LIVRE> <chap> l.<ligne>`. ⚠ Les n° de ligne ont dérivé
   (Marker) ET **les ancres `<span id="page-N">` sont NON fiables** → ne jamais en déduire une `source.page`.
4. **Chaque champ = source ⊕ convention voisine** : `book` = l'abréviation déjà utilisée (`ADE2`, pas
   `ADE II` — `grep '"book"' <fichier>`), `page` = vraie page (format des voisins), ids stables, `desc` =
   **verbatim** Markdown (garde `no-html-in-prose`), formes de champ (`damage:{plusBF,flat}`, `qualities:[{id}]`) copiées des voisins.
5. **Zéro invention / zéro inflexion RAW** : un champ non trouvé au Source → `"ND"`/omission assumée
   (pas une valeur inventée) ; une mécanique RAW non modélisable → **issue gabarit #101+** ou valeur maison
   taguée, JAMAIS « hors scope » silencieux.
6. **Canonicaliser + gardes** : après édition manuelle du `.json`, recanonicaliser
   `node -e "const fs=require('fs');const p='<f>';fs.writeFileSync(p,JSON.stringify(JSON.parse(fs.readFileSync(p,'utf8')),null,2))"`
   (⚠ **AUCUN** `\n` final — `serialize.test.ts` l'exige aux octets près), puis `npm test`
   (`serialize`, `no-html-in-prose`, garde du domaine) + `npm run typecheck` verts.
7. **Vérif en jeu** si l'élément est visible (Codex/éditeur) : recette navigateur.

## 5. Disposition de #148 (Bélier)

Le Bélier n'était **pas** dormant faute d'existence : il vit dans `mass-battle.json`. La qualité `belier`
est « dormante » au sens où **aucun trapping PORTÉ** ne l'utilise — ce qui est **normal** (un bélier n'est
pas un objet d'inventaire : c'est une machine de guerre crewée). Le vrai besoin de #148 (« voir les dégâts
conditionnels du Bélier au Codex ») n'est donc PAS « ajouter un trapping » (doublon) mais soit **exposer les
machines de guerre de `mass-battle.json` au Codex** (feature d'affichage), soit **acter la non-exposition**.
→ #148 re-scopé (décision utilisateur : **le Codex doit afficher mass-battle, et toute donnée doit y être
éditable**) → exposer les machines de guerre de `mass-battle.json` au Codex (feature d'affichage/édition, en
cours). Le mécanisme conditionnel lui-même (`capabilities.ram` hors-porte = Arme improvisée) était déjà
correct depuis **#102**. La **déviation RAW auto-admise** de l'agent (bélier via Force, ADE II l.233, non
modélisé) n'est PAS restée une note : elle est tracée en **#156** (résolution tactique des machines de guerre
— Projectiles (Machine de guerre) / Force pour le bélier + pénalité d'Équipe).
