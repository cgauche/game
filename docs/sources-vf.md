# Sources VF — détail des livres autorisés

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-sources-vf.mjs` (`npm run docs:sources-vf`) — NE PAS ÉDITER À LA MAIN.
> Source factuelle (id, abréviation, dossier `Source/…`) : `src/data/books.json`. Part éditoriale (périmètres
> par passage, arbitrages datés, avertissements d'extraction) : maintenue dans ce script — pas dérivable de la
> donnée. Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05) : lire ici pour le détail d'un livre ; la règle
> et la liste compacte restent dans `CLAUDE.md`.

**Périmètre mesuré / angles morts** — les chemins `Source/…` et abréviations ci-dessous sont LUS depuis
`src/data/books.json` (`id`/`abbr`/`dir`) : un livre renommé/déplacé casse ce script au lieu de laisser le
`.md` mentir. Le compte « 16 livres » (paragraphe Atlas) = nombre d'entrées de `books.json` portant
un champ `dir` (livre effectivement extrait sous `Source/`) ; un livre `language: "VF"` SANS `dir` (ex.
Aventures à Ubersreik II, Compagnon du Pouvoir derrière le Trône) est une édition française CONNUE mais NON
EXTRAITE — ce script ne peut pas distinguer « pas de VF » de « VF pas encore sourcé », il rapporte l'un ou
l'autre selon le champ `dir`, jamais une hypothèse. Le reste (chapitres, périmètres par passage, arbitrages
datés, méthodologie d'extraction) est de l'ÉDITORIAL fixé dans ce script, non re-dérivé à chaque run — une
décision de périmètre qui change se corrige ICI, à la main, comme tout arbitrage.

Tout est en **français** sous `Source/`, dossiers préfixés **`Warhammer v4 - …`**. Les dossiers
SANS ce préfixe (Enemy Within…, Altdorf…, Archives of the Empire…) sont la **VO** (base de
connaissance MJ du dépôt parent) — **ne jamais les lire/citer** ici (la donnée du jeu est FR :
CC/CT/F/E…). Au moindre doute, **lire le `.md` et citer** `LDB <chap> l.<ligne>` / `ADE…`.

> **Couche de lecture consolidée = l'Atlas [`docs/raw/`](raw/00-index.md)** : il agrège
> ces 16 livres par domaine + catalogues de stats. Lis l'Atlas pour comprendre/vérifier ; n'ouvre `Source/`
> que pour **citer** ou lever un doute. ⚠ **Source ré-extraite à Marker le 2026-06-22** (tables fiables,
> remplace l'ancien OCR pymupdf4llm) → les **n° de ligne** des anciennes réfs `l.<ligne>` ont **dérivé**
> (le **chapitre** reste juste, la **ligne** est approximative) ; pipeline `scripts/raw/marker-*` + `reextract-all.sh`.

## RÈGLES & STATS — périmètres documentés (règle 1)

> **Arbitrage utilisateur 2026-07-10** : « Tous les livres contiennent des règles. Parfois c'est plus
> 90 % scénario, mais souvent il y a quelques règles. » — la dichotomie livre-de-règles / livre-de-contenu
> ne se juge PAS au niveau du livre : le périmètre s'établit **par passage**, documenté ici, au même
> standard partout (verbatim citable `l.<ligne>`, extraction FR dans `Source/` obligatoire — un livre sans
> extraction ne peut pas fournir de mécanique vérifiable). La VO reste interdite.

- **LDB** = `Source/Warhammer v4 - Livre de base version corrigée/` — chapitres `NN - Titre.md` ;
  les commentaires de code `LDB <n> l.<ligne>` pointent ces fichiers. Chapitres clés :
  06 Classes · 07 Carrières · 08 Statut · 09 Compétences · 10 Talents · 12 Tests · **13 Combat** ·
  15 Déplacement · **16 États** · **17 Destin et Résistance** (« Résilience/Détermination ») ·
  **18 Traumatisme** (critiques) · 19 Corruption · 20 Maladies · **21 Psychologie** ·
  40-43 Prières/Bénédictions/Miracles · 46-51 Règles magiques/Sorts/Magie des Couleurs/Sorcellerie ·
  57 Monnaie · 59 Faire son marché · 60 Fabrication · 61 Encombrement · **62 Les armes** ·
  **63 Armures** · 71 Drogues et poisons · **76 Point d'Impact des Créatures** · 77-83 bestiaire ·
  **85 Traits de créature**. Index : `00 - Index.md`.
- **ADE I** = `Source/Warhammer v4 - Les archives de l'Empire volume 1/`.
- **ADE II** = `Source/Warhammer v4 - Les archives de l'Empire volume 2/`.
- **EDO** (L'Ennemi dans l'Ombre, T1) = `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` — inclus
  2026-06-11 : sorts de Tzeentch, créatures du Chaos (Horreurs, Furie), 3 talents + 3 traits ;
  2026-07-11 (#309) : Calendrier Impérial (Annexe 3, folios 149-150 — mois/jours/intercalaires ;
  la table est INTROUVABLE au LDB, l'ancienne attribution « LDB » des datasets calendrier était fausse).
- **EDOC** (Compagnon T1) = `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/` — 9 véhicules.
- **Middenheim** = `Source/Warhammer v4 - Middenheim la cité du Loup Blanc/` — 3 origines humaines + carrière Frère Loup.
- **AA** (Aux Armes / *Up in Arms*) = `Source/WH - V4 - Aux Armes/` — supplément combat & armes (autorisé 2026-06-14 ;
  source des talents que frenchy.bzh référence : Fusilier, Officier de Siège, etc.).
- **ZI** (Zoo Impérial / *The Imperial Zoo*) = `Source/WH - V4 - Le zoo impérial/` — créatures exotiques + le trait
  **Redoutable** (*Grim*) (autorisé 2026-06-14). Donnée **curée à la main directement dans
  `src/data/*.json`** (commitée, éditable au Codex), chaque entrée taguée à sa `source`.
- **MDG** (La Mer des Griffes / *Sea of Claws*) = `Source/WH - V4 - La Mer de Griffe/` — **cadre côtier + règles navales**
  (autorisé 2026-06-22) : navires & construction/artillerie (ch.12), navigation/manœuvres/**combat naval** + dégâts &
  Critiques sur navire (ch.13), tests d'équipage & moral (ch.14), longs voyages/commerce/**activités & maladies en mer**
  (ch.15), classe **Côtier** (8 carrières, ch.9) + carrières norses (ch.7), cultes **Manann/Stromfels** + miracles
  (ch.10-11), magie des mers (ch.2), **bestiaire marin** + capitaines nommés (ch.16). Comme AA/ZI : extraction curée à la main.
- **ACE** (Altdorf – Couronne de l'Empire) = `Source/Warhammer v4 - Aldorf la Couronne de l'Empire/` — **UNIQUEMENT
  l'Annexe I « Activités à Altdorf » (ch.12)** : 5 Activités « entre deux aventures » gated par lieu (Pénitence,
  Entraînement à une arme inhabituelle, Tester des objets magiques, Mécénat, Recherche universitaire) — cf. `activities.json`
  (`book: "altdorf-couronne-de-l-empire"`, l'id de `books.json` ; `where: ["altdorf"]`). Le reste du livre = contenu de campagne (tout passage de
  règle supplémentaire s'ajoute au périmètre ici, arbitrage 2026-07-10). Comme AA/ZI/MDG : extraction curée à la main.
- **MSRC** (Mort sur le Reik – Compagnon) = `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/`
  (19 chapitres extraits) — autorisé 2026-07-10 (#277). Périmètre constaté : **ch.5 « Navigation
  fluviale »** (tables de `river-navigation.json`/`river-perils.json`, critiques fluviaux
  `river-criticals.json`), **ch.10 « Personnalisation »** (8 traits navals d'aménagement de
  `naval-traits.json` : bouteur, murs blindés, coque de course, safran, plat-bord, allègement, gréement de
  course, fourquines), **ch.13 « Bestiaire fluvial »** (créatures), **ch.14 « Maladies transmises par
  l'eau »** (maladies/symptômes/états, `water-exposure.json`), véhicules fluviaux. Curation à la main.
- **NADJ** (Nuits agitées & dures journées) = `Source/Warhammer v4 - Nuits agitees & dures journées/` —
  autorisé 2026-07-10 (arbitrage par-passage). Périmètre constaté : **appendice I « Gnomes »**
  (espèce jouable, `species.json`), **« Jeux de taverne »** (`tavernGames.json`), 3 entrées `gods.json`,
  1 talent, 1 trapping.
- **VDM** (Les Vents de Magie / *Winds of Magic*) = `Source/Warhammer v4 - Les Vents de Magie/` —
  supplément **magie des 8 Collèges** (autorisé 2026-07-22, extrait Marker, 15 chapitres). Périmètre :
  **règles d'incantation RÉVISÉES** (ch.2 — le livre déclare *remplacer* LDB 46-51 : Focalisation,
  Surincantation, Incantations Imparfaites, dissipation, Repousser les Vents ; + **magie rituelle** &
  rituels, nouvelles **Activités**) ; **carrières & compétences arcaniques** (ch.3 — Alchimiste ordinaire,
  Bedeau, Devin, Magister Vigilant, compétences Augure/Psychométrie/Alchimie) ; **8 domaines de couleur**
  (ch.4-11 Hysh/Chamon/Ghyran/Azyr/Ulgu/Shyish/Aqshy/Ghur : Ordre, carrière de sorcier, listes de sorts
  révisées/étendues, mécène nommé) ; **artefacts magiques** (ch.12) ; **créatures magiques** (ch.13 —
  élémentaires incarnés, Fabriqués, familiers jouables) ; **sites, lignes de force & saturation
  environnementale** (ch.14). Ch.1 (histoire de la magie) & ch.15 (némésis/aventures) = majoritairement
  cadre. Curation `src/data` à la main (tag `source.book: "vents-de-la-magie"`), comme AA/ZI/MDG.
- **Tomes de campagne (règles ponctuelles)** : **MSR** (T2 base) — 1 statbloc (`creatures.json`) ;
  **PDT** (T3 base) — 1 entrée de compétence (`skills.json`). Admis par l'arbitrage 2026-07-10, chaque
  entrée taguée à sa `source`.
- `src/data/*.json` est la **SOURCE app-owned** (commitée, éditée dans le Compendium) ; tout contenu
  s'ajoute à la main / via l'éditeur.
  EDO/EDOC/Middenheim sont AUSSI des livres de scénario (cf. ci-dessous) ; seule leur **donnée extraite**
  entre dans les règles, pas leur prose narrative.

## Volumes majoritairement SCÉNARIO (règles ponctuelles admises — voir arbitrage ci-dessus)

- Tome 1 : `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` + `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/`.
- Tome 2 : `Source/Warhammer v4 - 2.0 Mort sur le Reik/` + `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/`.
- Tome 3 : `Source/Warhammer v4 - 3.0 Le Pouvoir Derriere le Trone/` (Compagnon VF connu mais non extrait dans `Source/`).
- Suppléments VF dispo : `Altdorf — La Couronne de l'Empire`, `Aventures à Ubersreik I`,
  `Middenheim — La Cité du Loup Blanc`, `Nuits Agitées & Dures Journées`,
  `Boîte d'Initiation` (+ `WH4_FR_BI_Livre_Aventure` / `…_Ubersreik`).
