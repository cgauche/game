# Atlas RAW — Ré-ancrage des citations

> Déterministe (`node scripts/raw/reanchor.mjs` ; `--apply` réécrit les dérives HIGH). GATE (#434) :
> exit 1 sur dérive non appliquée, ambiguïté, ou hausse de réf FAUSSE (❌) — voir en-tête du script.
> Pour chaque citation verbatim « … » d'une fiche, on relocalise le texte dans le `.md` source
> courant et on vérifie le n° de ligne cité. ✅ juste · 🔧 dérive corrigée (HIGH, unique) · 🟡 ambigu
**Bilan : ✅ 400 · 🔧 0 dérives (relancer --apply) · 🟡 0 ambigus · ❌ 39 introuvables · ➖ 2845 synthèses** (⛔ 9 hors-fichier · ⚠️ 0 sans source) sur 3293 réfs · 439 citations · 28 fiches.

> (MEDIUM, manuel) · ❌ introuvable (LOW, paraphrase/mauvais chapitre) · ➖ synthèse (réf sans citation).

## activites.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 22 l.14` | ❌ LOW | « chaque règle de ce chapitre est optionnelle.… » — texte trouvé en LDB 21 l.110 |

## avancement.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 07 l.43` | ❌ LOW | « votre carrière va influer sur son gain en expé… » — aucune occurrence |
| `LDB 07 l.84` | ❌ LOW | « gagner de l'argent… » — aucune occurrence |
| `LDB 08 l.5` | ❌ LOW | « avec l'accord du mj, vous pouvez également sau… » — aucune occurrence |
| `LDB 08 l.9` | ❌ LOW | « si vous avez achevé votre niveau de carrière a… » — texte trouvé en LDB 7 l.144 |
| `LDB 08 l.11` | ❌ LOW | « votre mj pourra vous demander de justifier tou… » — texte trouvé en LDB 7 l.146 |

## bestiaire.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 85 l.276-277` | ❌ LOW | « augmentez f et e de +10, et réduisez ag de -5 … » — aucune occurrence |
| `LDB 85 l.321` | ❌ LOW | « corps à corps (bagarre)… » — aucune occurrence |

## carrieres.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 06 l.14` | ❌ LOW | « wfjdr regroupe les carrières similaires en cla… » — aucune occurrence |
| `LDB 06 l.18-19` | ⛔ PAST-EOF | l.18 > 6 lignes |
| `LDB 06 l.14-24` | ⛔ PAST-EOF | l.14 > 6 lignes |
| `LDB 07 l.84` | ❌ LOW | « gagner de l'argent… » — aucune occurrence |

## combat.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 63 l.13-14` | ❌ LOW | « certaines armes sont presque aussi susceptible… » — texte trouvé en LDB 62 l.315 |
| `LDB 13 l.184` | ❌ LOW | « lancer pour toucher de corps à corps étant un … » — aucune occurrence |
| `LDB 63 l.14` | ❌ LOW | « tout test de combat qui est un échec et dont l… » — texte trouvé en LDB 14 l.19 |
| `LDB 15 l.37` | ❌ LOW | « chaque avantage ajoute +10 à un test de combat… » — texte trouvé en LDB 14 l.215 |
| `LDB 15 l.40` | ❌ LOW | « si vous échouez à un test opposé au cours d'un… » — aucune occurrence |
| `LDB 15 l.10` | ❌ LOW | « l'avantage représente votre vitesse en combat,… » — texte trouvé en LDB 14 l.191 |
| `LDB 63 l.11` | ❌ LOW | « certaines armes sont juste plus difficiles à u… » — texte trouvé en LDB 62 l.311 |
| `LDB 63 l.14` | ❌ LOW | « tout test raté incluant un 9 sur le dé des diz… » — texte trouvé en LDB 62 l.315 |
| `ADE II 04 l.215` | ❌ LOW | « funeste : l'arme est imprégnée de magie de mor… » — aucune occurrence |
| `ADE II 04 l.235` | ❌ LOW | « de coupure infinie : … si un coup de cette arm… » — aucune occurrence |
| `ADE II 04 l.237` | ❌ LOW | « de blessure grave : … il peut inverser les chi… » — aucune occurrence |
| `LDB 85 l.199-200` | ❌ LOW | « nuée - les nuées sont constituées d'un grand n… » — aucune occurrence |
| `ZI 13 l.984` | ❌ LOW | « nuée - la nuée est considérée comme une seule … » — aucune occurrence |
| `ZI 01 l.702-709` | ⛔ PAST-EOF | l.702 > 296 lignes |
| `ZI 01 l.702-709` | ⛔ PAST-EOF | l.702 > 296 lignes |
| `AA 10 l.215` | ❌ LOW | « pierrier 20 co 5 rare 30 +14 dangereuse, recha… » — aucune occurrence |
| `AA 01 l.4268-4350` | ⛔ PAST-EOF | l.4268 > 65 lignes |
| `AA 01 l.4272-4350` | ⛔ PAST-EOF | l.4272 > 65 lignes |
| `AA 01 l.4202-4205` | ⛔ PAST-EOF | l.4202 > 65 lignes |
| `AA 01 l.4264-4350` | ⛔ PAST-EOF | l.4264 > 65 lignes |

## corruption.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 19 l.51-52` | ❌ LOW | « sur un échec, vous gagnez 2 points de corrupti… » — texte trouvé en LDB 21 l.54 |
| `LDB 17 l.71` | ❌ LOW | « je te renie !… » — aucune occurrence |

## creation.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 05 l.488` | ❌ LOW | « consultez votre carrière. recherchez dans le s… » — aucune occurrence |

## deplacement.md

| Réf | Statut | Détail |
|---|---|---|
| `EDOC 5 l.479` | ⛔ PAST-EOF | l.479 > 292 lignes |
| `MDG 15 l.76` | ❌ LOW | « distance/jour suppose un équipage permettant d… » — aucune occurrence |

## destin.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 18 l.10` | ❌ LOW | « la détermination est récupérée chaque fois que… » — texte trouvé en LDB 17 l.81 |
| `LDB 18 l.14` | ❌ LOW | « le mj peut accorder un point de résilience per… » — texte trouvé en LDB 17 l.85 |

## etats.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 46 l.66` | ❌ LOW | « 16-20 cérumen : vos oreilles se bouchent insta… » — aucune occurrence |
| `LDB 46 l.80` | ❌ LOW | « 56-60 drain de l'âme : gagnez 1 état exténué, … » — aucune occurrence |
| `LDB 46 l.102` | ❌ LOW | « 06-10 regard maudit : vous possédez 1 état ave… » — aucune occurrence |
| `LDB 46 l.126` | ❌ LOW | « 66-70 régurgitation : gagnez l'état sonné, qui… » — aucune occurrence |
| `LDB 18 l.211` | ❌ LOW | « 91-93 cage thoracique perforée : gagnez 1 état… » — aucune occurrence |
| `LDB 18 l.213` | ❌ LOW | « 97-99 hémorragie interne : gagnez 1 état hémor… » — aucune occurrence |
| `LDB 18 l.104` | ❌ LOW | « 76-80 commotion cérébrale : gagnez l'état exté… » — aucune occurrence |
| `NADJ 05 l.117` | ❌ LOW | « état fatigué… » — aucune occurrence |

## tests.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 17 l.73` | ❌ LOW | « "je ne faillirai pas !" : au lieu de lancer le… » — aucune occurrence |
