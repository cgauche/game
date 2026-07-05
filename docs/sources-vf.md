# Sources VF — détail des livres autorisés

> Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05). À lire pour le détail d'un livre
> (chapitres, périmètre autorisé, historique d'extraction). La règle et la liste compacte
> restent dans `CLAUDE.md`.

Tout est en **français** sous `Source/`, dossiers préfixés **`Warhammer v4 - …`**. Les dossiers
SANS ce préfixe (Enemy Within…, Altdorf…, Archives of the Empire…) sont la **VO** (base de
connaissance MJ du dépôt parent) — **ne jamais les lire/citer** ici (la donnée du jeu est FR :
CC/CT/F/E…). Au moindre doute, **lire le `.md` et citer** `LDB <chap> l.<ligne>` / `ADE…`.

> **Couche de lecture consolidée = l'Atlas [`docs/raw/`](raw/00-index.md)** : il agrège
> ces 15 livres par domaine + catalogues de stats. Lis l'Atlas pour comprendre/vérifier ; n'ouvre `Source/`
> que pour **citer** ou lever un doute. ⚠ **Source ré-extraite à Marker le 2026-06-22** (tables fiables,
> remplace l'ancien OCR pymupdf4llm) → les **n° de ligne** des anciennes réfs `l.<ligne>` ont **dérivé**
> (le **chapitre** reste juste, la **ligne** est approximative) ; pipeline `scripts/raw/marker-*` + `reextract-all.sh`.

## RÈGLES & STATS (règle 1 — seules sources autorisées)

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
  2026-06-11 : sorts de Tzeentch, créatures du Chaos (Horreurs, Furie), 3 talents + 3 traits.
- **EDOC** (Compagnon T1) = `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/` — 9 véhicules.
- **Middenheim** = `Source/Warhammer v4 - Middenheim la cité du Loup Blanc/` — 3 origines humaines + carrière Frère Loup.
- **AA** (Aux Armes / *Up in Arms*) = `Source/WH - V4 - Aux Armes/` — supplément combat & armes (autorisé 2026-06-14 ;
  source des talents que frenchy.bzh référence : Fusilier, Officier de Siège, etc.).
- **ZI** (Zoo Impérial / *The Imperial Zoo*) = `Source/WH - V4 - Le zoo impérial/` — créatures exotiques + le trait
  **Redoutable** (*Grim*) (autorisé 2026-06-14). NB : AA/ZI ne sont PAS dans `all-data.json` → leur donnée est
  **curée à la main directement dans `src/data/*.json`** (commitée, éditable au Codex), chaque entrée taguée à sa
  `source`, pas par `build:data`.
- **MDG** (La Mer des Griffes / *Sea of Claws*) = `Source/WH - V4 - La Mer de Griffe/` — **cadre côtier + règles navales**
  (autorisé 2026-06-22) : navires & construction/artillerie (ch.12), navigation/manœuvres/**combat naval** + dégâts &
  Critiques sur navire (ch.13), tests d'équipage & moral (ch.14), longs voyages/commerce/**activités & maladies en mer**
  (ch.15), classe **Côtier** (8 carrières, ch.9) + carrières norses (ch.7), cultes **Manann/Stromfels** + miracles
  (ch.10-11), magie des mers (ch.2), **bestiaire marin** + capitaines nommés (ch.16). Comme AA/ZI : extraction curée, pas `build:data`.
- **ACE** (Altdorf – Couronne de l'Empire) = `Source/Warhammer v4 - Aldorf la Couronne de l'Empire/` — **UNIQUEMENT
  l'Annexe I « Activités à Altdorf » (ch.12)** : 5 Activités « entre deux aventures » gated par lieu (Pénitence,
  Entraînement à une arme inhabituelle, Tester des objets magiques, Mécénat, Recherche universitaire) — cf. `activities.json`
  (`source.book: "ACE"`, `where: ["altdorf"]`). Le reste du livre reste **CONTENU de campagne**, pas des règles.
  Comme AA/ZI/MDG : extraction curée à la main, pas `build:data`.
- `Source/all-data.json` = ancienne extraction (LDB/ADE1/ADE2 + EDO/Middenheim/EDOC). **La migration
  `build:data` a été RETIRÉE** (elle régénérait `src/data/*.json` et écrasait les données curées —
  apparence des créatures, etc.). `src/data/*.json` est désormais la **SOURCE app-owned** (commitée,
  éditée dans le Compendium) ; tout nouveau contenu s'ajoute à la main / via l'éditeur, plus par re-seed.
  EDO/EDOC/Middenheim sont AUSSI des livres de scénario (cf. ci-dessous) ; seule leur **donnée extraite**
  entre dans les règles, pas leur prose narrative.

## SCÉNARIOS / CONTENU de campagne (PAS pour les règles)

- Tome 1 : `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` + `… L'ennemi dans l'Ombre Compagnon/`.
- Tome 2 : `Source/Warhammer v4 - 2.0 Mort sur le Reik/` + `… Mort sur le Reik Compagnon/`.
- Tome 3 : `Source/Warhammer v4 - 3.0 Le Pouvoir Derriere le Trone/` (pas de Compagnon VF).
- Suppléments VF dispo : `Aldorf la Couronne de l'Empire`, `Aventures a Ubersreik`,
  `Middenheim la cité du Loup Blanc`, `Nuits agitees & dures journées`,
  `Boîte d'Initiation WFRP 4e Edition VF` (+ `WH4_FR_BI_Livre_Aventure` / `…_Ubersreik`).
