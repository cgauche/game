/**
 * Génère docs/sources-vf.md — détail des livres sources VF autorisés (chapitres, périmètre par
 * passage, historique d'extraction). La part FACTUELLE (id, abréviation, dossier `Source/…`) est
 * DÉRIVÉE de `src/data/books.json` (fail-fast si un id cité ici disparaît/est renommé) ; la part
 * ÉDITORIALE (périmètres par passage, arbitrages datés, avertissements d'extraction) N'EST PAS
 * dérivable de la donnée — elle vit ICI, en dur, comme les préambules de
 * `scripts/docs/build-systemes.mjs` / `scripts/gen-sorts-doc.mts`.
 *
 * Mode --check (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé,
 * exit 1 avec message actionnable si diff — jamais d'écriture en mode --check.
 * Composé via `emitOrCheck` de scripts/docs/lib/jsdocUnion.mjs.
 *
 *   node scripts/docs/build-sources-vf.mjs
 */
import { readFileSync } from 'node:fs'
import { emitOrCheck } from './lib/jsdocUnion.mjs'

const BOOKS = JSON.parse(readFileSync('src/data/books.json', 'utf8'))
const byId = new Map(BOOKS.map((b) => [b.id, b]))

function book(id) {
  const b = byId.get(id)
  if (!b) {
    console.error(`build-sources-vf — livre "${id}" introuvable dans src/data/books.json (renommé/supprimé ?)`)
    process.exit(1)
  }
  return b
}

/** Chemin `Source/…/` d'un livre EXTRAIT (fail-fast si `dir` absent — ce script ne devine jamais). */
function dir(id) {
  const b = book(id)
  if (!b.dir) {
    console.error(`build-sources-vf — livre "${id}" (${b.label}) n'a pas de champ "dir" dans books.json (pas encore extrait)`)
    process.exit(1)
  }
  return `${b.dir}/`
}

const abbr = (id) => book(id).abbr
const extractedCount = BOOKS.filter((b) => b.dir).length

const out = `# Sources VF — détail des livres autorisés

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-sources-vf.mjs\` (\`npm run docs:sources-vf\`) — NE PAS ÉDITER À LA MAIN.
> Source factuelle (id, abréviation, dossier \`Source/…\`) : \`src/data/books.json\`. Part éditoriale (périmètres
> par passage, arbitrages datés, avertissements d'extraction) : maintenue dans ce script — pas dérivable de la
> donnée. Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05) : lire ici pour le détail d'un livre ; la règle
> et la liste compacte restent dans \`CLAUDE.md\`.

**Périmètre mesuré / angles morts** — les chemins \`Source/…\` et abréviations ci-dessous sont LUS depuis
\`src/data/books.json\` (\`id\`/\`abbr\`/\`dir\`) : un livre renommé/déplacé casse ce script au lieu de laisser le
\`.md\` mentir. Le compte « ${extractedCount} livres » (paragraphe Atlas) = nombre d'entrées de \`books.json\` portant
un champ \`dir\` (livre effectivement extrait sous \`Source/\`) ; un livre \`language: "VF"\` SANS \`dir\` (ex.
Aventures à Ubersreik II, Compagnon du Pouvoir derrière le Trône) est une édition française CONNUE mais NON
EXTRAITE — ce script ne peut pas distinguer « pas de VF » de « VF pas encore sourcé », il rapporte l'un ou
l'autre selon le champ \`dir\`, jamais une hypothèse. Le reste (chapitres, périmètres par passage, arbitrages
datés, méthodologie d'extraction) est de l'ÉDITORIAL fixé dans ce script, non re-dérivé à chaque run — une
décision de périmètre qui change se corrige ICI, à la main, comme tout arbitrage.

Tout est en **français** sous \`Source/\`, dossiers préfixés **\`Warhammer v4 - …\`**. Les dossiers
SANS ce préfixe (Enemy Within…, Altdorf…, Archives of the Empire…) sont la **VO** (base de
connaissance MJ du dépôt parent) — **ne jamais les lire/citer** ici (la donnée du jeu est FR :
CC/CT/F/E…). Au moindre doute, **lire le \`.md\` et citer** \`LDB <chap> l.<ligne>\` / \`ADE…\`.

> **Couche de lecture consolidée = l'Atlas [\`docs/raw/\`](raw/00-index.md)** : il agrège
> ces ${extractedCount} livres par domaine + catalogues de stats. Lis l'Atlas pour comprendre/vérifier ; n'ouvre \`Source/\`
> que pour **citer** ou lever un doute. ⚠ **Source ré-extraite à Marker le 2026-06-22** (tables fiables,
> remplace l'ancien OCR pymupdf4llm) → les **n° de ligne** des anciennes réfs \`l.<ligne>\` ont **dérivé**
> (le **chapitre** reste juste, la **ligne** est approximative) ; pipeline \`scripts/raw/marker-*\` + \`reextract-all.sh\`.

## RÈGLES & STATS — périmètres documentés (règle 1)

> **Arbitrage utilisateur 2026-07-10** : « Tous les livres contiennent des règles. Parfois c'est plus
> 90 % scénario, mais souvent il y a quelques règles. » — la dichotomie livre-de-règles / livre-de-contenu
> ne se juge PAS au niveau du livre : le périmètre s'établit **par passage**, documenté ici, au même
> standard partout (verbatim citable \`l.<ligne>\`, extraction FR dans \`Source/\` obligatoire — un livre sans
> extraction ne peut pas fournir de mécanique vérifiable). La VO reste interdite.

- **${abbr('livre-de-base')}** = \`${dir('livre-de-base')}\` — chapitres \`NN - Titre.md\` ;
  les commentaires de code \`LDB <n> l.<ligne>\` pointent ces fichiers. Chapitres clés :
  06 Classes · 07 Carrières · 08 Statut · 09 Compétences · 10 Talents · 12 Tests · **13 Combat** ·
  15 Déplacement · **16 États** · **17 Destin et Résistance** (« Résilience/Détermination ») ·
  **18 Traumatisme** (critiques) · 19 Corruption · 20 Maladies · **21 Psychologie** ·
  40-43 Prières/Bénédictions/Miracles · 46-51 Règles magiques/Sorts/Magie des Couleurs/Sorcellerie ·
  57 Monnaie · 59 Faire son marché · 60 Fabrication · 61 Encombrement · **62 Les armes** ·
  **63 Armures** · 71 Drogues et poisons · **76 Point d'Impact des Créatures** · 77-83 bestiaire ·
  **85 Traits de créature**. Index : \`00 - Index.md\`.
- **${abbr('archives-de-l-empire-1')}** = \`${dir('archives-de-l-empire-1')}\`.
- **${abbr('archives-de-l-empire-2')}** = \`${dir('archives-de-l-empire-2')}\`.
- **${abbr('ennemi-dans-l-ombre')}** (L'Ennemi dans l'Ombre, T1) = \`${dir('ennemi-dans-l-ombre')}\` — inclus
  2026-06-11 : sorts de Tzeentch, créatures du Chaos (Horreurs, Furie), 3 talents + 3 traits ;
  2026-07-11 (#309) : Calendrier Impérial (Annexe 3, folios 149-150 — mois/jours/intercalaires ;
  la table est INTROUVABLE au LDB, l'ancienne attribution « LDB » des datasets calendrier était fausse).
- **${abbr('ennemi-dans-l-ombre-compagnon')}** (Compagnon T1) = \`${dir('ennemi-dans-l-ombre-compagnon')}\` — 9 véhicules.
- **Middenheim** = \`${dir('middenheim')}\` — 3 origines humaines + carrière Frère Loup.
- **${abbr('aux-armes')}** (Aux Armes / *Up in Arms*) = \`${dir('aux-armes')}\` — supplément combat & armes (autorisé 2026-06-14 ;
  source des talents que frenchy.bzh référence : Fusilier, Officier de Siège, etc.).
- **${abbr('zoo-imperial')}** (Zoo Impérial / *The Imperial Zoo*) = \`${dir('zoo-imperial')}\` — créatures exotiques + le trait
  **Redoutable** (*Grim*) (autorisé 2026-06-14). Donnée **curée à la main directement dans
  \`src/data/*.json\`** (commitée, éditable au Codex), chaque entrée taguée à sa \`source\`.
- **${abbr('mer-des-griffes')}** (La Mer des Griffes / *Sea of Claws*) = \`${dir('mer-des-griffes')}\` — **cadre côtier + règles navales**
  (autorisé 2026-06-22) : navires & construction/artillerie (ch.12), navigation/manœuvres/**combat naval** + dégâts &
  Critiques sur navire (ch.13), tests d'équipage & moral (ch.14), longs voyages/commerce/**activités & maladies en mer**
  (ch.15), classe **Côtier** (8 carrières, ch.9) + carrières norses (ch.7), cultes **Manann/Stromfels** + miracles
  (ch.10-11), magie des mers (ch.2), **bestiaire marin** + capitaines nommés (ch.16). Comme AA/ZI : extraction curée à la main.
- **${abbr('altdorf-couronne-de-l-empire')}** (Altdorf – Couronne de l'Empire) = \`${dir('altdorf-couronne-de-l-empire')}\` — **UNIQUEMENT
  l'Annexe I « Activités à Altdorf » (ch.12)** : 5 Activités « entre deux aventures » gated par lieu (Pénitence,
  Entraînement à une arme inhabituelle, Tester des objets magiques, Mécénat, Recherche universitaire) — cf. \`activities.json\`
  (\`book: "${book('altdorf-couronne-de-l-empire').id}"\`, l'id de \`books.json\` ; \`where: ["altdorf"]\`). Le reste du livre = contenu de campagne (tout passage de
  règle supplémentaire s'ajoute au périmètre ici, arbitrage 2026-07-10). Comme AA/ZI/MDG : extraction curée à la main.
- **${abbr('mort-sur-le-reik-compagnon')}** (Mort sur le Reik – Compagnon) = \`${dir('mort-sur-le-reik-compagnon')}\`
  (19 chapitres extraits) — autorisé 2026-07-10 (#277). Périmètre constaté : **ch.5 « Navigation
  fluviale »** (tables de \`river-navigation.json\`/\`river-perils.json\`, critiques fluviaux
  \`river-criticals.json\`), **ch.10 « Personnalisation »** (8 traits navals d'aménagement de
  \`naval-traits.json\` : bouteur, murs blindés, coque de course, safran, plat-bord, allègement, gréement de
  course, fourquines), **ch.13 « Bestiaire fluvial »** (créatures), **ch.14 « Maladies transmises par
  l'eau »** (maladies/symptômes/états, \`water-exposure.json\`), véhicules fluviaux. Curation à la main.
- **${abbr('nuits-agitees-et-dures-journees')}** (Nuits agitées & dures journées) = \`${dir('nuits-agitees-et-dures-journees')}\` —
  autorisé 2026-07-10 (arbitrage par-passage). Périmètre constaté : **appendice I « Gnomes »**
  (espèce jouable, \`species.json\`), **« Jeux de taverne »** (\`tavernGames.json\`), 3 entrées \`gods.json\`,
  1 talent, 1 trapping.
- **${abbr('vents-de-la-magie')}** (Les Vents de Magie / *Winds of Magic*) = \`${dir('vents-de-la-magie')}\` —
  supplément **magie des 8 Collèges** (autorisé 2026-07-22, extrait Marker, 15 chapitres). Périmètre :
  **règles d'incantation RÉVISÉES** (ch.2 — le livre déclare *remplacer* LDB 46-51 : Focalisation,
  Surincantation, Incantations Imparfaites, dissipation, Repousser les Vents ; + **magie rituelle** &
  rituels, nouvelles **Activités**) ; **carrières & compétences arcaniques** (ch.3 — Alchimiste ordinaire,
  Bedeau, Devin, Magister Vigilant, compétences Augure/Psychométrie/Alchimie) ; **8 domaines de couleur**
  (ch.4-11 Hysh/Chamon/Ghyran/Azyr/Ulgu/Shyish/Aqshy/Ghur : Ordre, carrière de sorcier, listes de sorts
  révisées/étendues, mécène nommé) ; **artefacts magiques** (ch.12) ; **créatures magiques** (ch.13 —
  élémentaires incarnés, Fabriqués, familiers jouables) ; **sites, lignes de force & saturation
  environnementale** (ch.14). Ch.1 (histoire de la magie) & ch.15 (némésis/aventures) = majoritairement
  cadre. Curation \`src/data\` à la main (tag \`source.book: "${book('vents-de-la-magie').id}"\`), comme AA/ZI/MDG.
- **Tomes de campagne (règles ponctuelles)** : **${abbr('mort-sur-le-reik')}** (T2 base) — 1 statbloc (\`creatures.json\`) ;
  **${abbr('pouvoir-derriere-le-trone')}** (T3 base) — 1 entrée de compétence (\`skills.json\`). Admis par l'arbitrage 2026-07-10, chaque
  entrée taguée à sa \`source\`.
- \`src/data/*.json\` est la **SOURCE app-owned** (commitée, éditée dans le Compendium) ; tout contenu
  s'ajoute à la main / via l'éditeur.
  EDO/EDOC/Middenheim sont AUSSI des livres de scénario (cf. ci-dessous) ; seule leur **donnée extraite**
  entre dans les règles, pas leur prose narrative.

## Volumes majoritairement SCÉNARIO (règles ponctuelles admises — voir arbitrage ci-dessus)

- Tome 1 : \`${dir('ennemi-dans-l-ombre')}\` + \`${dir('ennemi-dans-l-ombre-compagnon')}\`.
- Tome 2 : \`${dir('mort-sur-le-reik')}\` + \`${dir('mort-sur-le-reik-compagnon')}\`.
- Tome 3 : \`${dir('pouvoir-derriere-le-trone')}\` (Compagnon ${book('pouvoir-derriere-le-trone-compagnon').dir ? `= \`${dir('pouvoir-derriere-le-trone-compagnon')}\`` : `${book('pouvoir-derriere-le-trone-compagnon').language === 'VF' ? 'VF connu mais' : 'VO,'} non extrait dans \`Source/\``}).
- Suppléments VF dispo : \`${book('altdorf-couronne-de-l-empire').label}\`, \`${book('aventures-a-ubersreik-1').label}\`,
  \`${book('middenheim').label}\`, \`${book('nuits-agitees-et-dures-journees').label}\`,
  \`${book('boite-d-initiation').label}\` (+ \`WH4_FR_BI_Livre_Aventure\` / \`…_Ubersreik\`).
`

emitOrCheck({
  out,
  path: 'docs/sources-vf.md',
  check: process.argv.includes('--check'),
  staleMsg: 'docs:sources-vf — docs/sources-vf.md est PÉRIMÉ (diverge de src/data/books.json ou du script).',
  rerunMsg: '  → relancer `npm run docs:sources-vf` et committer le résultat.',
  okMsg: 'docs:sources-vf — OK (docs/sources-vf.md à jour)',
  writeMsg: `docs/sources-vf.md — ${extractedCount} livres extraits référencés.`,
})
