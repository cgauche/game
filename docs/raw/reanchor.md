# Atlas RAW — Ré-ancrage des citations

> Déterministe (`node scripts/raw/reanchor.mjs` ; `--apply` réécrit les dérives HIGH).
> Pour chaque citation verbatim « … » d'une fiche, on relocalise le texte dans le `.md` source
> courant et on vérifie le n° de ligne cité. ✅ juste · 🔧 dérive corrigée (HIGH, unique) · 🟡 ambigu
> (MEDIUM, manuel) · ❌ introuvable (LOW, paraphrase/mauvais chapitre) · ➖ synthèse (réf sans citation).
**Bilan : ✅ 322 · 🔧 0 dérives (relancer --apply) · 🟡 1 ambigus · ❌ 41 introuvables · ➖ 2109 synthèses · 🧭 2176 synthèses ré-ancrées (diff)** (⛔ 113 hors-fichier · ⚠️ 0 sans source) sur 2586 réfs · 364 citations · 27 fiches.


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
| `LDB 76 l.47-55` | ⛔ PAST-EOF | → l.44 (ré-ancré par diff) |
| `LDB 76 l.47-55` | ⛔ PAST-EOF | → l.44 (ré-ancré par diff) |
| `LDB 76 l.63` | ⛔ PAST-EOF | → l.46 (ré-ancré par diff) |
| `LDB 76 l.49` | ⛔ PAST-EOF | → l.45 (ré-ancré par diff) |
| `LDB 76 l.49` | ⛔ PAST-EOF | → l.45 (ré-ancré par diff) |
| `LDB 85 l.276-277` | ❌ LOW | « augmentez f et e de +10, et réduisez ag de -5 … » — aucune occurrence |
| `LDB 76 l.47-55` | ⛔ PAST-EOF | → l.44 (ré-ancré par diff) |
| `LDB 76 l.49` | ⛔ PAST-EOF | → l.45 (ré-ancré par diff) |
| `LDB 76 l.49` | ⛔ PAST-EOF | → l.45 (ré-ancré par diff) |
| `LDB 85 l.321` | ❌ LOW | « corps à corps (bagarre)… » — aucune occurrence |

## carrieres.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 06 l.14` | ❌ LOW | « wfjdr regroupe les carrières similaires en cla… » — aucune occurrence |
| `LDB 06 l.18-19` | ⛔ PAST-EOF | l.18 > 6 lignes (non ré-ancré) |
| `LDB 06 l.14-24` | ⛔ PAST-EOF | l.14 > 6 lignes (non ré-ancré) |
| `LDB 07 l.84` | ❌ LOW | « gagner de l'argent… » — aucune occurrence |

## combat.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 13 l.47` | ❌ LOW | « relancer l'initiative à chaque round… » — aucune occurrence |
| `LDB 13 l.118` | ❌ LOW | « combat-defensive-stance - action sur la défens… » — aucune occurrence |
| `Ubersreik 05 l.24` | ❌ LOW | « frappe mortelle (wfjdr, page 160). en raison d… » — texte trouvé en Ubersreik 4 l.18 |
| `Ubersreik 05 l.24` | ⛔ PAST-EOF | l.24 > 6 lignes (non ré-ancré) |
| `Ubersreik 05 l.24` | ⛔ PAST-EOF | l.24 > 6 lignes (non ré-ancré) |
| `LDB 63 l.13-14` | ❌ LOW | « certaines armes sont presque aussi susceptible… » — texte trouvé en LDB 62 l.315 |
| `LDB 13 l.184` | ❌ LOW | « lancer pour toucher de corps à corps étant un … » — aucune occurrence |
| `LDB 63 l.14` | ❌ LOW | « tout test de combat qui est un échec et dont l… » — texte trouvé en LDB 14 l.19 |
| `LDB 14 l.223` | ⛔ PAST-EOF | → l.215 (ré-ancré par diff) |
| `LDB 14 l.225` | ⛔ PAST-EOF | → l.217 (ré-ancré par diff) |
| `LDB 15 l.37` | ❌ LOW | « chaque avantage ajoute +10 à un test de combat… » — texte trouvé en LDB 14 l.215 |
| `LDB 15 l.40` | ❌ LOW | « si vous échouez à un test opposé au cours d'un… » — aucune occurrence |
| `LDB 15 l.10` | ❌ LOW | « l'avantage représente votre vitesse en combat,… » — texte trouvé en LDB 14 l.191 |
| `LDB 15 l.127` | ⛔ PAST-EOF | → l.90 (ré-ancré par diff) |
| `LDB 15 l.143-144` | ⛔ PAST-EOF | → l.105 (ré-ancré par diff) |
| `LDB 15 l.124-126` | ⛔ PAST-EOF | → l.87 (ré-ancré par diff) |
| `LDB 15 l.127` | ⛔ PAST-EOF | → l.90 (ré-ancré par diff) |
| `LDB 15 l.129` | ⛔ PAST-EOF | → l.92 (ré-ancré par diff) |
| `LDB 15 l.131` | ⛔ PAST-EOF | → l.93 (ré-ancré par diff) |
| `LDB 15 l.133` | ⛔ PAST-EOF | → l.95 (ré-ancré par diff) |
| `LDB 15 l.135` | ⛔ PAST-EOF | → l.96 (ré-ancré par diff) |
| `LDB 15 l.137-141` | ⛔ PAST-EOF | → l.98 (ré-ancré par diff) |
| `LDB 15 l.143-144` | ⛔ PAST-EOF | → l.105 (ré-ancré par diff) |
| `LDB 15 l.146` | ⛔ PAST-EOF | → l.108 (ré-ancré par diff) |
| `LDB 63 l.11` | ❌ LOW | « certaines armes sont juste plus difficiles à u… » — texte trouvé en LDB 62 l.311 |
| `LDB 63 l.14` | ❌ LOW | « tout test raté incluant un 9 sur le dé des diz… » — texte trouvé en LDB 62 l.315 |
| `ADE II 04 l.215` | ❌ LOW | « funeste : l'arme est imprégnée de magie de mor… » — aucune occurrence |
| `ADE II 04 l.235` | ❌ LOW | « de coupure infinie : … si un coup de cette arm… » — aucune occurrence |
| `ADE II 04 l.237` | ❌ LOW | « de blessure grave : … il peut inverser les chi… » — aucune occurrence |
| `LDB 63 l.105-106` | ⛔ PAST-EOF | → l.73 (ré-ancré par diff) |
| `LDB 63 l.108-109` | ⛔ PAST-EOF | → l.77 (ré-ancré par diff) |
| `LDB 63 l.114-115` | ⛔ PAST-EOF | → l.85 (ré-ancré par diff) |
| `LDB 63 l.117-118` | ⛔ PAST-EOF | → l.89 (ré-ancré par diff) |
| `LDB 63 l.105-106` | ⛔ PAST-EOF | → l.73 (ré-ancré par diff) |
| `LDB 63 l.108-109` | ⛔ PAST-EOF | → l.77 (ré-ancré par diff) |
| `LDB 63 l.114-115` | ⛔ PAST-EOF | → l.85 (ré-ancré par diff) |
| `LDB 63 l.117-118` | ⛔ PAST-EOF | → l.89 (ré-ancré par diff) |
| `ZI 01 l.2953` | 🟡 MEDIUM | « cette créature peut se déplacer en creusant un… » candidats l.630/4111/4159 → plus proche l.4111 |
| `Ubersreik 05 l.22` | ⛔ PAST-EOF | l.22 > 6 lignes (non ré-ancré) |
| `LDB 85 l.199-200` | ❌ LOW | « nuée - les nuées sont constituées d'un grand n… » — aucune occurrence |
| `ZI 01 l.2993` | ❌ LOW | « nuée - la nuée est considérée comme une seule … » — aucune occurrence |
| `AA 01 l.3885` | ❌ LOW | « pierrier 20 co 5 rare 30 +14 dangereuse, recha… » — aucune occurrence |
| `LDB 15 l.124-126` | ⛔ PAST-EOF | → l.87 (ré-ancré par diff) |
| `LDB 15 l.146` | ⛔ PAST-EOF | → l.108 (ré-ancré par diff) |
| `LDB 63 l.105-106` | ⛔ PAST-EOF | → l.73 (ré-ancré par diff) |

## competences.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 09 l.581` | ⛔ PAST-EOF | → l.573 (ré-ancré par diff) |
| `LDB 09 l.579` | ⛔ PAST-EOF | → l.571 (ré-ancré par diff) |
| `LDB 09 l.576-581` | ⛔ PAST-EOF | → l.568 (ré-ancré par diff) |
| `LDB 09 l.576-581` | ⛔ PAST-EOF | → l.568 (ré-ancré par diff) |

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
| `LDB 15 l.124-147` | ⛔ PAST-EOF | → l.87 (ré-ancré par diff) |
| `LDB 15 l.143-146` | ⛔ PAST-EOF | → l.105 (ré-ancré par diff) |
| `LDB 18 l.417-422` | ⛔ PAST-EOF | → l.337 (ré-ancré par diff) |

## destin.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 18 l.10` | ❌ LOW | « la détermination est récupérée chaque fois que… » — texte trouvé en LDB 17 l.81 |
| `LDB 18 l.14` | ❌ LOW | « le mj peut accorder un point de résilience per… » — texte trouvé en LDB 17 l.85 |

## economie.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 60 l.80` | ⛔ PAST-EOF | → l.47 (ré-ancré par diff) |
| `LDB 60 l.75` | ⛔ PAST-EOF | → l.42 (ré-ancré par diff) |
| `LDB 60 l.82` | ⛔ PAST-EOF | → l.50 (ré-ancré par diff) |
| `LDB 60 l.80` | ⛔ PAST-EOF | → l.47 (ré-ancré par diff) |
| `LDB 60 l.69` | ⛔ PAST-EOF | → l.35 (ré-ancré par diff) |

## equipement.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 60 l.91` | ⛔ PAST-EOF | → l.62 (ré-ancré par diff) |
| `LDB 72 l.37` | ⛔ PAST-EOF | → l.28 (ré-ancré par diff) |
| `LDB 74 l.70` | ⛔ PAST-EOF | → l.41 (ré-ancré par diff) |
| `LDB 74 l.72` | ⛔ PAST-EOF | → l.43 (ré-ancré par diff) |
| `LDB 74 l.72` | ⛔ PAST-EOF | → l.43 (ré-ancré par diff) |
| `LDB 74 l.72` | ⛔ PAST-EOF | → l.43 (ré-ancré par diff) |
| `LDB 74 l.74` | ⛔ PAST-EOF | → l.45 (ré-ancré par diff) |
| `LDB 72 l.37` | ⛔ PAST-EOF | → l.28 (ré-ancré par diff) |
| `LDB 74 l.70` | ⛔ PAST-EOF | → l.41 (ré-ancré par diff) |
| `LDB 18 l.352` | ⛔ PAST-EOF | → l.262 (ré-ancré par diff) |

## etats.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 46 l.66` | ❌ LOW | « 16-20 cérumen : vos oreilles se bouchent insta… » — aucune occurrence |
| `LDB 46 l.80` | ❌ LOW | « 56-60 drain de l'âme : gagnez 1 état exténué, … » — aucune occurrence |
| `LDB 46 l.102` | ❌ LOW | « 06-10 regard maudit : vous possédez 1 état ave… » — aucune occurrence |
| `LDB 46 l.126` | ❌ LOW | « 66-70 régurgitation : gagnez l'état sonné, qui… » — aucune occurrence |
| `LDB 40 l.105` | ⛔ PAST-EOF | → l.99 (ré-ancré par diff) |
| `LDB 40 l.107-108` | ⛔ PAST-EOF | → l.101 (ré-ancré par diff) |
| `LDB 40 l.122-123` | ⛔ PAST-EOF | → l.101 (ré-ancré par diff) |
| `LDB 40 l.124-125` | ⛔ PAST-EOF | → l.101 (ré-ancré par diff) |
| `LDB 40 l.105` | ⛔ PAST-EOF | → l.99 (ré-ancré par diff) |
| `LDB 40 l.122-123` | ⛔ PAST-EOF | → l.101 (ré-ancré par diff) |
| `LDB 40 l.124-125` | ⛔ PAST-EOF | → l.101 (ré-ancré par diff) |
| `LDB 18 l.211` | ❌ LOW | « 91-93 cage thoracique perforée : gagnez 1 état… » — aucune occurrence |
| `LDB 18 l.213` | ❌ LOW | « 97-99 hémorragie interne : gagnez 1 état hémor… » — aucune occurrence |
| `LDB 18 l.104` | ❌ LOW | « 76-80 commotion cérébrale : gagnez l'état exté… » — aucune occurrence |

## magie.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 46 l.193-195` | ⛔ PAST-EOF | → l.143 (ré-ancré par diff) |
| `LDB 46 l.197-199` | ⛔ PAST-EOF | → l.148 (ré-ancré par diff) |
| `LDB 46 l.201-202` | ⛔ PAST-EOF | → l.154 (ré-ancré par diff) |
| `LDB 46 l.204-207` | ⛔ PAST-EOF | → l.159 (ré-ancré par diff) |
| `LDB 49 l.93-96` | ⛔ PAST-EOF | → l.5 (ré-ancré par diff) |
| `LDB 49 l.93-94` | ⛔ PAST-EOF | → l.5 (ré-ancré par diff) |
| `LDB 46 l.193-195` | ⛔ PAST-EOF | → l.143 (ré-ancré par diff) |
| `LDB 46 l.197-199` | ⛔ PAST-EOF | → l.148 (ré-ancré par diff) |
| `LDB 46 l.201-202` | ⛔ PAST-EOF | → l.154 (ré-ancré par diff) |
| `LDB 46 l.204-207` | ⛔ PAST-EOF | → l.159 (ré-ancré par diff) |
| `LDB 49 l.93-96` | ⛔ PAST-EOF | → l.5 (ré-ancré par diff) |

## psychologie.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 21 l.29` | ❌ LOW | « un seul test par tour quand la source s'approc… » — aucune occurrence |

## religion.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 46 l.201` | ⛔ PAST-EOF | → l.154 (ré-ancré par diff) |
| `LDB 40 l.110-113` | ⛔ PAST-EOF | → l.101 (ré-ancré par diff) |
| `LDB 25 l.62-63` | ⛔ PAST-EOF | → l.35 (ré-ancré par diff) |

## tests.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 12 l.213-227` | ⛔ PAST-EOF | → l.188 (ré-ancré par diff) |
| `LDB 12 l.229-234` | ⛔ PAST-EOF | → l.203 (ré-ancré par diff) |
| `LDB 17 l.73` | ❌ LOW | « "je ne faillirai pas !" : au lieu de lancer le… » — aucune occurrence |

## traumatisme.md

| Réf | Statut | Détail |
|---|---|---|
| `LDB 18 l.360` | ⛔ PAST-EOF | → l.272 (ré-ancré par diff) |
| `LDB 18 l.352` | ⛔ PAST-EOF | → l.262 (ré-ancré par diff) |
| `LDB 18 l.374-384` | ⛔ PAST-EOF | → l.289 (ré-ancré par diff) |
| `LDB 18 l.382` | ⛔ PAST-EOF | → l.298 (ré-ancré par diff) |
| `LDB 18 l.374-384` | ⛔ PAST-EOF | → l.289 (ré-ancré par diff) |
| `LDB 18 l.380` | ⛔ PAST-EOF | → l.296 (ré-ancré par diff) |
| `LDB 18 l.417-422` | ⛔ PAST-EOF | → l.337 (ré-ancré par diff) |
| `LDB 18 l.382` | ⛔ PAST-EOF | → l.298 (ré-ancré par diff) |
| `LDB 18 l.386-403` | ⛔ PAST-EOF | → l.303 (ré-ancré par diff) |
| `LDB 18 l.387` | ⛔ PAST-EOF | → l.304 (ré-ancré par diff) |
| `LDB 18 l.389-396` | ⛔ PAST-EOF | → l.307 (ré-ancré par diff) |
| `LDB 18 l.398-403` | ⛔ PAST-EOF | → l.314 (ré-ancré par diff) |
| `LDB 18 l.387-388` | ⛔ PAST-EOF | → l.304 (ré-ancré par diff) |
| `LDB 18 l.389-396` | ⛔ PAST-EOF | → l.307 (ré-ancré par diff) |
| `LDB 18 l.398-403` | ⛔ PAST-EOF | → l.314 (ré-ancré par diff) |
| `LDB 18 l.382` | ⛔ PAST-EOF | → l.298 (ré-ancré par diff) |
| `LDB 18 l.408-415` | ⛔ PAST-EOF | → l.327 (ré-ancré par diff) |
| `LDB 18 l.411-413` | ⛔ PAST-EOF | → l.330 (ré-ancré par diff) |
| `LDB 18 l.415` | ⛔ PAST-EOF | → l.334 (ré-ancré par diff) |
| `LDB 18 l.408-415` | ⛔ PAST-EOF | → l.327 (ré-ancré par diff) |
| `LDB 18 l.408-415` | ⛔ PAST-EOF | → l.327 (ré-ancré par diff) |
| `LDB 18 l.417-422` | ⛔ PAST-EOF | → l.337 (ré-ancré par diff) |
| `LDB 18 l.420` | ⛔ PAST-EOF | → l.340 (ré-ancré par diff) |
| `LDB 18 l.422` | ⛔ PAST-EOF | → l.343 (ré-ancré par diff) |
| `LDB 18 l.417-422` | ⛔ PAST-EOF | → l.337 (ré-ancré par diff) |
| `LDB 18 l.422` | ⛔ PAST-EOF | → l.343 (ré-ancré par diff) |
| `LDB 18 l.422` | ⛔ PAST-EOF | → l.343 (ré-ancré par diff) |
| `LDB 18 l.420-422` | ⛔ PAST-EOF | → l.340 (ré-ancré par diff) |
| `LDB 18 l.424-425` | ⛔ PAST-EOF | → l.345 (ré-ancré par diff) |
| `LDB 18 l.424-425` | ⛔ PAST-EOF | → l.345 (ré-ancré par diff) |
| `LDB 18 l.424-425` | ⛔ PAST-EOF | → l.345 (ré-ancré par diff) |
