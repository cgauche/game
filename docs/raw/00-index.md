# Atlas RAW — Index

Base de connaissance des **règles WFRP4 (RAW)** du projet, **consolidées** depuis les 14 livres
autorisés (voir [`sources.md`](sources.md)), à **usage d'agent** : répondre vite et sûrement à
*« est-ce que X est RAW, et que dit exactement la source ? »* quand la réponse est éclatée sur
plusieurs chapitres **et** plusieurs livres.

## Comment c'est organisé

- **1 fichier par domaine** ; dans chaque fichier, **1 section `##` = 1 topic atomique**.
- Chaque topic = **synthèse fidèle** + **Sources RAW** (toutes les refs `LIVRE NN l.X-Y`, tous livres
  confondus) + **citations verbatim** là où le mot compte + **Voir aussi** (renvois entre règles) +
  **Implémente** — champ **GÉNÉRÉ** par `npm run raw:implemente` (#487), jamais écrit à la main :
  code de `src/` citant les réfs du topic (même livre+chapitre, spans à **±10 lignes** — du bruit de
  voisinage est possible sur les pages denses), symboles remontés, `⚠sans-appelant`/`⚠hors-app` sur
  le code mort détecté, `(non implémenté)` sinon. Source éditoriale (dettes/blocages) :
  `src/data/raw.manifest.json` ; fraîcheur gardée par `npm run docs:check` (CI + pre-commit).
- Convention de réf : `<ABRÉV> <NN> l.<début>-<fin>` — `NN` = préfixe du fichier de chapitre,
  `l.` = numéros de ligne du `.md` source. Table des abréviations → [`sources.md`](sources.md).

> ⚠️ Contenu **agent-généré**, contrôlé par une passe de **vérification adversariale** (chaque ref
> est reconfrontée à la source ; règle 1 = zéro invention). **La passe de vérif peut elle-même produire
> des faux-positifs** → toute correction passe par une relecture de la source. Les écarts code↔RAW ne
> se consignent plus en prose dans les fiches : un vrai trou = un ticket (cf. #502 pour le tri du stock).

## Domaines

| Domaine | Fichier | État | Chapitres LDB (+ suppléments) |
|---|---|---|---|
| Combat | [`combat.md`](combat.md) | ✅ pilote (14 topics) | 13, 14, 15, 62, 63, 76, 85 + AA / ZI / ADE / tomes |
| Combat naval (Mer des Griffes) | [`combat-naval.md`](combat-naval.md) | 🟡 brouillon (12 topics) | MDG 12, 13, 14 |
| Tests & Degrés de Réussite | [`tests.md`](tests.md) | ✅ | 12 |
| États | [`etats.md`](etats.md) | ✅ | 16 |
| Déplacement & voyage | [`deplacement.md`](deplacement.md) | ✅ | 15 + EDOC |
| Destin, Résilience & Détermination | [`destin.md`](destin.md) | ✅ | 17 |
| Traumatisme & Blessures critiques | `traumatisme.md` | ⏳ | 18 |
| Corruption & mutation | [`corruption.md`](corruption.md) | ✅ | 19 + EDO App.2 + EDOC ch.8 |
| Maladies & infections | [`maladies.md`](maladies.md) | ✅ | 20 + T2C 14/04 |
| Psychologie | [`psychologie.md`](psychologie.md) | ✅ | 21 + 85 |
| Caractéristiques & Blessures | [`caracteristiques.md`](caracteristiques.md) | ✅ | 05 + 85 (Taille) |
| Compétences | [`competences.md`](competences.md) | ✅ | 09 + AA / ADE I / ADE II |
| Talents | [`talents.md`](talents.md) | ✅ | 10 + AA / ADE |
| Classes, Carrières & Statut | [`carrieres.md`](carrieres.md) | ✅ | 06, 07, 08 (système+statut+index) — détails/niveau catalogue séparé |
| Création de personnage | [`creation.md`](creation.md) | ✅ | 04, 05 + Middenheim Ann.II + ADE I Ann.I |
| Avancement (PX) | [`avancement.md`](avancement.md) | ✅ | 07 + T3 13 |
| Magie (règles, sorts, Imparfaites) | [`magie.md`](magie.md) | ✅ | 44, 46–51 (règles + tables d100) — catalogue sorts séparé |
| Religion (prières, bénédictions, miracles) | [`religion.md`](religion.md) | ✅ | 24–25, 40–42 (règles) ; catalogue 26-43 séparé |
| Équipement, objets & encombrement | [`equipement.md`](equipement.md) | ✅ | 61, 67, 71, 72, 73, 74 (règles) — 64–70, 74–75 catalogue flagué |
| Économie (monnaie, marché, fabrication) | [`economie.md`](economie.md) | ✅ | 57, 59, 60 + T2C Compagnon ch.11 |
| Bestiaire & Traits de créature | [`bestiaire.md`](bestiaire.md) | ✅ | 76, 85 (système) — catalogue 77–83 + ZI / frenchy / EDO / T2 / ADE flagué séparé |
| Activités & événements | [`activites.md`](activites.md) | ✅ | 22, 23 + AA / ADE II / EDOC |

✅ = livré · ⏳ = à construire (fan-out workflow par domaine).

## Catalogues (données mécaniques verbatim — source Marker propre, tous livres)

| Catalogue | Contenu |
|---|---|
| [`catalogue-creatures.md`](catalogue-creatures.md) | Bestiaire complet : LDB 76–85 + Middenheim + ZI + ogres ADE II + Chaos EDO + montures EDOC + fluvial T2C + PNJ T3 |
| [`catalogue-sorts.md`](catalogue-sorts.md) | Sorts : LDB 47–51 + Tzeentch EDO |
| [`catalogue-divin.md`](catalogue-divin.md) | Dieux, cultes, bénédictions, miracles : LDB 24–43 + cultes du Chaos Middenheim/Altdorf |
| [`catalogue-equipement.md`](catalogue-equipement.md) | Objets/prix/Enc : LDB 57–75 + Aux Armes |
| [`catalogue-carrieres.md`](catalogue-carrieres.md) | Détails par niveau : LDB 06–08 + ADE I/II + Middenheim |
| [`catalogue-divers.md`](catalogue-divers.md) | Règles éparses des suppléments (entraînement, espionnage, navigation, mutants, astrologie…) |

## Gardes déterministes (rejouables)

- **[`coverage.md`](coverage.md)** (`node scripts/raw/coverage.mjs`) — chaque chapitre des 15 livres : ✅ couvert / 🟡 effleuré / ⬜ trou / ➖ hors-règle (scénario, prose ≠ règle). **Seuil : ⬜ = 0.**
- **[`reconciliation.md`](reconciliation.md)** (`node scripts/raw/reconcile.mjs`) — code ↔ Atlas. **Sens A : zéro trou dur toléré** (chapitre cité par le code absent de l'Atlas = trou à ticketer ; non-régression LDB verrouillée par `reconcile.test.mjs`, tous livres couverts, folio compris). **Sens B (#434) : tout topic `(non implémenté)` porte une entrée de manifest (ticket #N ou blocage consigné dans `src/data/raw.manifest.json`) — gardé par `npm run raw:implemente --check` (exit 1 sur orphelin).**
- **[`reanchor.md`](reanchor.md)** (`node scripts/raw/reanchor.mjs` ; `--apply` verbatim + `--remap` synthèse) — ré-ancre les réfs `l.X` contre la Source Marker : citations « … » par **match exact**, réfs de synthèse par **diff `git HEAD`↔arbre** (one-shot à relancer après chaque ré-extraction, avant de committer la Source). **Seuils : 🔧 = 0 · 🟡 = 0 · ❌ sous cliquet (`reanchor-low-baseline.json`).** Voir l'**[épreuve du 2026-06-22](epreuve-2026-06-22.md)**.

> Les COMPTES courants (✅/🟡/❌, chapitres non pinés, marqueurs, B2) vivent dans les fichiers GÉNÉRÉS ci-dessus, jamais dans cette page — un compte recopié à la main ment dès le commit suivant.

> **Source = Marker propre pour les 14 livres** (tables intactes, texte exact ; pipeline `scripts/raw/marker-*` + `reextract-all.sh`). L'Atlas remplace la source : 0 trou de règle.

> ⚠️ **Ré-extraction de `Source/` : JAMAIS en masse.** Une re-passe Marker totale décale les numéros de
> ligne de ~3 000 citations du CODE que `reanchor.mjs --remap` ne couvre pas (il ne remappe que les fiches) —
> c'est le chantier de ré-ancrage de 2026-07-16 (#434, ~400 réfs corrigées à la main au Source) à refaire en
> entier. Les trous d'ancrage folio se corrigent par **insertions d'ancres CIBLÉES** (#522), chapitre par
> chapitre, gardes `raw:*` relancées avant commit. Une ré-extraction totale exige d'ABORD un outil de remap
> code-side.

> ⚠️ **Limite connue (#323, vérifiée 2026-07-11)** : Marker perd les GLYPHES des schémas de progression
> (marteau/crâne/bouclier — seule la croix survit en `h`). Les gardes `coverage`/`reconcile` ne peuvent
> PAS le détecter (absence silencieuse, pas un caractère corrompu) — seule une comparaison au rendu-image
> du PDF le peut. La donnée app-owned (`careers.json`/`careerLevels.json`) est vérifiée SAINE (10 carrières
> échantillonnées, 40 valeurs conformes PDF) : le défaut ne touche que la prose `Source/*.md` — réparation
> des glyphes au fil des besoins Atlas, par comparaison PDF.
