# Atlas RAW — cœur 5e

Le cœur de règles **WFRP 5e** de l'Atlas : les fiches de ce cœur vivent dans ce dossier, consolidées
depuis le livre de base qui le déclare (table à jour dans [`sources.md`](../sources.md)), à **usage
d'agent**. La **synthèse** d'une fiche est en français ; les **citations, termes et abréviations de
jeu** restent verbatim dans la langue du livre. Le routeur des cœurs est à
[`../00-index.md`](../00-index.md).

## Domaines

**1 domaine = 1 fiche `<clé>.md`** — la clé est l'id STABLE (c'est elle que nomme un lot du workflow
d'extraction), le titre est de l'affichage. La table ci-dessous est **GÉNÉRÉE** depuis
`scripts/raw/domaines.json` par `node scripts/raw/build-atlas-index.mjs` : un domaine de plus est une
entrée de ce registre, jamais une ligne écrite ici. Une aire **cadrée dont la fiche reste à extraire**
s'y rend sans lien, avec le ticket qui doit son extraction — garde
`scripts/raw/domaines.test.mjs`.

<!-- ATLAS-DOMAINES:DEBUT -->
| Domaine | Titre |
|---|---|
| `creation` | Création de Personnage — aire cadrée, fiche à extraire (#1825) |
| `carrieres` | Classes, Carrières & Statut — aire cadrée, fiche à extraire (#1825) |
| `competences` | Compétences — aire cadrée, fiche à extraire (#1825) |
| `talents` | Talents — aire cadrée, fiche à extraire (#1825) |
| [`tests`](tests.md) | Tests & Success Levels (SL) |
| `intrigue` | Larcins & Subterfuges (vol, discrétion, jeu, pièges) — aire cadrée, fiche à extraire (#1825) |
| `social` | Interactions sociales (statut, influence, beuverie, mensonge) — aire cadrée, fiche à extraire (#1825) |
| `enquete` | Enquête, Recherche & Pistage — aire cadrée, fiche à extraire (#1825) |
| `deplacement` | Déplacement & Voyage (hors combat) — aire cadrée, fiche à extraire (#1825) |
| `artisanat` | Artisanat : fabrication d'objets, de remèdes et de poisons — aire cadrée, fiche à extraire (#1825) |
| `combat` | Combat — aire cadrée, fiche à extraire (#1825) |
| `traumatisme` | Traumatisme & Blessures critiques — aire cadrée, fiche à extraire (#1825) |
| `maladies` | Maladies, Infections & Effets des poisons — aire cadrée, fiche à extraire (#1825) |
| `psychologie` | Psychologie — aire cadrée, fiche à extraire (#1825) |
| `etats` | États — aire cadrée, fiche à extraire (#1825) |
| `corruption` | Corruption & Mutations — aire cadrée, fiche à extraire (#1825) |
| `avancement` | Avancement (Points d'Expérience) — aire cadrée, fiche à extraire (#1825) |
| `activites` | Activités & Événements (Entre deux aventures) — aire cadrée, fiche à extraire (#1825) |
| `religion` | Religion (Prières, Bénédictions, Miracles) — aire cadrée, fiche à extraire (#1825) |
| `magie` | Magie (règles) — aire cadrée, fiche à extraire (#1825) |
| `economie` | Économie : monnaie, marché, marchandage & main-d'œuvre — aire cadrée, fiche à extraire (#1825) |
| `equipement` | Équipement, objets & encombrement — aire cadrée, fiche à extraire (#1825) |
| `bestiaire` | Bestiaire & Profils de créature — aire cadrée, fiche à extraire (#1825) |
| `conversion` | Conversion entre éditions (traits, avantage, difficulté, résilience) — aire cadrée, fiche à extraire (#1825) |
<!-- ATLAS-DOMAINES:FIN -->
