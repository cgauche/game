# Atlas RAW — cœur 4e

Le cœur de règles **WFRP 4e** de l'Atlas : les fiches, catalogues et épreuves de ce cœur vivent dans
ce dossier, **consolidés** depuis les livres autorisés qui le déclarent (table à jour dans
[`sources.md`](../sources.md)), à **usage d'agent** : répondre vite et sûrement à *« est-ce que X est
RAW, et que dit exactement la source ? »* quand la réponse est éclatée sur plusieurs chapitres **et**
plusieurs livres. Les rapports transverses et le routeur des cœurs sont à
[`../00-index.md`](../00-index.md).

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
  `l.` = numéros de ligne du `.md` source. Table des abréviations → [`sources.md`](../sources.md).

> ⚠️ Contenu **agent-généré**, contrôlé par une passe de **vérification adversariale** (chaque ref
> est reconfrontée à la source ; règle 1 = zéro invention). **La passe de vérif peut elle-même produire
> des faux-positifs** → toute correction passe par une relecture de la source. Les écarts code↔RAW ne
> se consignent plus en prose dans les fiches : un vrai trou = un ticket (cf. #502 pour le tri du stock).

## Domaines

| Domaine | Fichier | État | Chapitres LDB (+ suppléments) |
|---|---|---|---|
| Combat | [`combat.md`](combat.md) | ✅ pilote | 13, 14, 15, 62, 63, 76, 85 + AA / ZI / ADE / tomes |
| Combat naval (Mer des Griffes) | [`combat-naval.md`](combat-naval.md) | 🟡 brouillon | MDG 12, 13, 14 |
| Tests & Degrés de Réussite | [`tests.md`](tests.md) | ✅ | 12 |
| États | [`etats.md`](etats.md) | ✅ | 16 |
| Déplacement & voyage | [`deplacement.md`](deplacement.md) | ✅ | 15 + EDOC |
| Destin, Résilience & Détermination | [`destin.md`](destin.md) | ✅ | 17 |
| Traumatisme & Blessures critiques | `traumatisme.md` | ⏳ | 18 |
| Corruption & mutation | [`corruption.md`](corruption.md) | ✅ | 19 + EDO App.2 + EDOC 8 |
| Maladies & infections | [`maladies.md`](maladies.md) | ✅ | 20 + MSRC 14/04 |
| Psychologie | [`psychologie.md`](psychologie.md) | ✅ | 21 + 85 |
| Caractéristiques & Blessures | [`caracteristiques.md`](caracteristiques.md) | ✅ | 05 + 85 (Taille) |
| Compétences | [`competences.md`](competences.md) | ✅ | 09 + AA / ADE I / ADE II |
| Talents | [`talents.md`](talents.md) | ✅ | 10 + AA / ADE |
| Classes, Carrières & Statut | [`carrieres.md`](carrieres.md) | ✅ | 06, 07, 08 (système+statut+index) — détails/niveau catalogue séparé |
| Création de personnage | [`creation.md`](creation.md) | ✅ | 04, 05 + MCLB Ann.II + ADE I Ann.I |
| Avancement (PX) | [`avancement.md`](avancement.md) | ✅ | 07 + PDT 13 |
| Magie (règles, sorts, Imparfaites) | [`magie.md`](magie.md) | ✅ | 44, 46–51 (règles + tables d100) — catalogue sorts séparé |
| Religion (prières, bénédictions, miracles) | [`religion.md`](religion.md) | ✅ | 24–25, 40–42 (règles) ; catalogue 26-43 séparé |
| Équipement, objets & encombrement | [`equipement.md`](equipement.md) | ✅ | 61, 67, 71, 72, 73, 74 (règles) — 64–70, 74–75 catalogue flagué |
| Économie (monnaie, marché, fabrication) | [`economie.md`](economie.md) | ✅ | 57, 59, 60 + MSRC Compagnon ch.11 |
| Bestiaire & Traits de créature | [`bestiaire.md`](bestiaire.md) | ✅ | 76, 85 (système) — catalogue 77–83 + ZI / frenchy / EDO / MSR / ADE flagué séparé |
| Activités & événements | [`activites.md`](activites.md) | ✅ | 22, 23 + AA / ADE II / EDOC |

✅ = livré · ⏳ = à construire (fan-out workflow par domaine).

## Catalogues (données mécaniques verbatim — source Marker propre, tous livres)

> La colonne **Contenu** décrit ce que le catalogue TRANSCRIT. Les LIVRES et CHAPITRES qui l'alimentent
> ne s'écrivent pas ici : chaque catalogue porte sa ligne **« Chapitres source »** dans son propre
> en-tête, GÉNÉRÉE depuis `scripts/raw/chapitres.json#enCatalogue` — une liste recopiée ici mentirait
> dès le livre suivant.

| Catalogue | Contenu |
|---|---|
| [`catalogue-creatures.md`](catalogue-creatures.md) | Bestiaire : profils de créature, Point d'Impact, Traits |
| [`catalogue-sorts.md`](catalogue-sorts.md) | Sorts, avec leurs blocs NI / Portée / Cible / Durée |
| [`catalogue-divin.md`](catalogue-divin.md) | Dieux, cultes, bénédictions, miracles |
| [`catalogue-equipement.md`](catalogue-equipement.md) | Objets, prix, Encombrement, armes et armures |
| [`catalogue-carrieres.md`](catalogue-carrieres.md) | Carrières, détails par niveau |
| [`catalogue-divers.md`](catalogue-divers.md) | Règles éparses des suppléments (entraînement, espionnage, navigation, mutants, astrologie…) |
