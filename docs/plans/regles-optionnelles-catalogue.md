> ⚠️ **ARCHIVE (2026-07-05)** — document DATÉ : constat/plan d'époque, ne décrit PAS l'état courant du code.
> Conservé pour l'historique du raisonnement. Ne JAMAIS s'appuyer dessus pour juger l'architecture ou l'état actuel.

# Catalogue des règles optionnelles WFRP4 — source de vérité du chantier

> Reconstruit (2026-06-18) par un workflow multi-agents lisant **LDB + AA + ZI + Compagnon T1 (C1) +
> Compagnon T2 (C2) + NADJ**. Sigles : `LDB` Livre de base · `AA` Aux Armes · `ZI` Zoo Impérial ·
> `C1`/`C2` Compagnons Tomes 1/2 · `NADJ` Nuits Agitées & Dures Journées. Refs au format
> `<SIGLE> <chap> l.<ligne>`. **~60 règles distinctes : 7 faites, ~53 à faire.** Ambition actée :
> **RAW intégral** (les 4 sous-systèmes XL inclus, faits en dernier).
>
> Le système : `src/engine/policy.ts` = registre `OPTIONAL_RULES` ; une règle = 1 entrée + 1 point de
> lecture `rule(id)` ; le panneau `ui/HouseRulesModal.tsx` se régénère du registre. `flag`=on/off ·
> `param`=nombre · `mode`=choix · `heavy`=sous-système entier. Plan d'exécution :
> `~/.claude/plans/transient-dancing-shamir.md`.

## Déjà implémentées (7)

| id | nom | réf | type |
|---|---|---|---|
| `test-auto-bands` | Réussite/échec automatiques (mode bandes) | LDB 12 l.46/48 | mode |
| `test-fast-sl` | Calcul rapide du DR (dizaines du jet) | LDB 12 l.128 | flag |
| `test-over-100` | Tests supérieurs à 100 % | LDB 12 l.101 | flag |
| `combat-advantage-cap` | Plafond d'Avantage (valeur fixe) | LDB 15 l.17 | param |
| `combat-frappe-mortelle` | Frappe Mortelle | LDB 14 l.9 | flag |
| `combat-sudden-death` | Mort Subite (= AA l.2505) | LDB 18 l.51 | mode |
| `creation-signes-astraux` | Signes astraux à la création | ADE II ch.03 | flag |

## À faire (~53), par sous-système

### Tests
| nom | réf | type | cx | point de code | note |
|---|---|---|---|---|---|
| Largeur des bandes auto (01-N / N-00) | LDB 12 l.48 | param | S | `testPolicy.ts:34-35` (5/96 en dur) | autoFailMin = 101 − largeur ; `maxForcedRoll` dérive. **Lot 1.** |
| Critiques/Maladresses sur tous les Tests (doubles) | LDB 12 l.151 | flag | M | `tests.ts` (`isDouble` déjà fourni), conséquences hors combat | RAW laisse l'effet au MJ → flag + hook. |
| DR 0 en Test étendu = ±1 minimum | LDB 12 l.208 | flag | S | `tests.ts` accumulation Test étendu | centraliser l'accumulation d'abord. |
| Test Combiné (deux Compétences en un jet) | LDB 12 l.229 | mode | M | `tests.ts` (`evaluateCombinedTest`), rollFlow | brique réutilisée par Filature. |
| Filature : Test Combiné Perception+Discrétion | LDB 09 l.165 | mode | M | rollFlow discrétion | appelant du Test Combiné, livrer ensemble. |
| Métier : Int à la place de Dex | LDB 09 l.352 | mode | S | rollFlow metier (override carac) | famille « carac alternative ». |

### Combat
| nom | réf | type | cx | point de code | note |
|---|---|---|---|---|---|
| Plafonds « Combiner les Difficultés » +60/−30 | LDB 14 l.126 | param×2 | S | `combat.ts combineMods:211` | **Lot 1.** point unique attaque+défense. |
| Plafond d'Avantage = Bonus d'Initiative | LDB 15 l.15 | flag | S→M | `advantage.gainAdvantage` + `ActiveFrame` | plafond PAR combattant ; enrichir `combat-advantage-cap`. |
| Sur la Défensive (Action → +20 défense) | LDB 13 l.118 | flag | M | `combatFlow` (Action) + `rollFlow` (buff temporisé) | jusqu'au prochain tour. |
| Retenir ses coups (ignorer les Critiques) | LDB 18 l.45 | flag | M | résolveur d'attaque (flag pré-jet) | ≈ AA l.2500 mais variante AA divergente (→ pack XL). |
| Cible sans défense : critique (défaut) ou mort-auto | LDB 16 l.112 | mode | S→M | `combat.ts helplessTest:551` | commentaire trompeur à retirer (**Lot 1**), option au **Lot 2**. |
| Tir dans un corps à corps (−20, friendly fire) | LDB 14 l.133 | flag | M | `attackModifiers` (−20) + re-résolution cible | volet friendly-fire optionnel. |
| Empoignade : compétence alternative pour se libérer | LDB 14 l.209 | mode | M | flux Empoignade | vérifier qu'un flux d'Empoignade existe. |
| Initiative : méthode et fréquence | LDB 13 l.39 | mode | M | `combatFlow` (ordre / relance par Round) | 2 axes (méthode + fréquence). |
| Se Fatiguer (Exténué par effort soutenu) | LDB 16 l.99 | flag | M | `conditions`/`combatFlow` (compteur Rounds + Test) | |
| Difficulté de récupération des États | LDB 16 l.102 | mode | S | `conditions.endOfRound:189/213` ('intermediaire' ×2) | défaut valide ; nettoyer le commentaire. |
| Déviation Critique (armure absorbe le critique) | LDB 63 l.63 | flag | M | résolution critique/localisation/PA | point de décision défenseur. |
| Longueur d'arme et combat au contact | LDB 62 l.215 | heavy | L | `baseTestMods` (−10) + Action « entrer au contact » + types Weapon | 2 volets. |
| Pétards de l'Opéra : dégâts aléatoires | NADJ 08 l.160 | — | — | **FAUX POSITIF** → Effet de scène scripté, pas le registre. |

### Social
| nom | réf | type | cx | point de code | note |
|---|---|---|---|---|---|
| Réaction aléatoire au Statut (1d10) | LDB 08 l.54 | mode | S | `combat.ts baseTestMods` (social) | famille « modificateurs sociaux » + RNG. |
| Mendicité et Statut (+10 au lieu de −10) | LDB 08 l.92 | flag | S | `baseTestMods` (social) | même point. |
| Modificateurs de Charme intra-Échelon (Standing) | LDB 08 l.88 | flag | S | `baseTestMods` (social) | même point. |
| Caractéristique alternative pour l'Intimidation | LDB 09 l.266 | mode | S | `baseTestMods` / rollFlow intimidation | famille « carac alternative ». |

### Marché / Commerce
| nom | réf | type | cx | point de code | note |
|---|---|---|---|---|---|
| Achat/vente : système optionnel (Disponibilité/Marchandage) | LDB 59 l.15 | mode | M | `merchantFlow` (toggle) | étapes désactivables. |
| Tenir les Comptes (seuil de Statut) | LDB 59 l.18 | flag | M | `merchantFlow`/argent | change le modèle d'argent. |
| Guildes d'Artisans (inversion Disponibilité) | LDB 60 l.69 | flag | S | `merchantFlow` (calcul Disponibilité) | localisé. |
| Commerce fluvial : rumeurs vs calcul | C2 ch.11 l.159 | mode | L | `merchantFlow` (bascule) | niche, dépend d'un système de commerce. |
| Commerce : Marchandage PNJ par jet/valeur fixe | C2 ch.11 l.115 | mode | S | `merchantFlow` (PNJ simplifié) | niche. |
| Commerce : exonération « Argent à gaspiller » | C2 ch.11 l.10 | flag | S | `merchantFlow`/`partyFlow` | dépend d'« Argent à gaspiller ». |

### Magie
| nom | réf | type | cx | point de code | note |
|---|---|---|---|---|---|
| Incantation Critique : choix de l'effet | LDB 46 l.53 | mode | M | `magic.ts` + rollFlow castConfirm | 3 effets au choix. |
| Composants d'incantation | LDB 46 l.159 | flag | M | `magic.ts applyMiscast` + inventaire | consommable + dégradation Imparfaite. |
| Dissipation collective en Test Soutenu | LDB 46 l.207 | flag | M | `magic.ts` + rollFlow dispelConfirm | réutilise le Test étendu. |
| Guérison divine des animaux (Taal) | C1 ch.4 l.279 | flag | S | `ops.ts heal` (cible animaux) | niche. |
| Gnomes : dissipation sans Talent de lanceur | NADJ 15 l.21 | — | — | **FAUX POSITIF** → trait de race en donnée. |

### Corruption
| nom | réf | type | cx | point de code | note |
|---|---|---|---|---|---|
| Embrasser les Ombres (Sombres Pactes narratifs) | LDB 19 l.18 | flag | S | `corruptionFlow` (hook narratif) | flag + événement, pas de chiffre. |
| Manifestations Lentes (mutation progressive) | LDB 19 l.189 | flag | M | `corruptionFlow.gainCorruption` (timing) | état « mutation en germe ». |
| Traits Psychologiques personnalisés | LDB 21 l.59 | — | — | **FAUX POSITIF** → `GameOp[]` au Codex (`GameOpEditor`). |

### Maladies
| nom | réf | type | cx | point de code | note |
|---|---|---|---|---|---|
| Utilisation des Maladies (mode d'engagement) | LDB 20 l.36 | mode | S | `upkeep`/`conditions` (gate global) | pleine/situationnelle/off. |
| Maladies de l'eau : application au jugé | C2 ch.14 l.34 | flag | S | `conditions`/`upkeep` | recoupe le gate global. |
| Maladies de l'eau par blessures ouvertes | C2 ch.14 l.11 | flag | S | `conditions` | sous-cas. |

### Voyage / Survie / Déplacement
| nom | réf | type | cx | point de code | note |
|---|---|---|---|---|---|
| Voyage par Étapes (toggle parent) | C1 ch.5 l.29 | heavy | L | `travelFlow` | parent de stepCount/froid/navigation. |
| Nombre d'Étapes augmenté | C1 ch.5 l.34 | param | S | `travelFlow` (stepCount) | inerte sans le parent. |
| Attraper froid (Exposition après intempéries) | C1 ch.5 l.73 | flag | M | `travelFlow`/`upkeep` | réutilise Exposition+maladies. |
| Trouver Nourriture & Herbes (subsistance détaillée) | LDB 09 l.565 | heavy | L | `travelFlow`/`provisions` | Test de Survie Soutenu de groupe. |
| Tables de mésaventures de monte/conduite | C1 ch.4 l.121 | mode | M | `travel.ts` (dispatch d'incidents) | remplace résolution p.120. |
| Cavalier = Mouvement de la monture | AA l.3282 | flag | S | `combat.ts`/`combatGeometry` (M monté) | simplification, point unique. |
| Navigation : Test par étape (intégration C1) | C2 ch.5 l.17 | flag | M | `travelFlow` | sous-option Navigation. |
| Voile non acquise : Test d'Agilité journalier | C2 ch.5 l.19 | flag | M | `travelFlow` (vitesse bateau) | sous-option Navigation. |
| Localisation coup sur un bateau (dé inversé/d100) | C2 ch.5 l.50 | mode | S | `combat.ts` (réutilise l'inversion du dé) | sous-option Navigation. |
| Poursuite : Esquive-moi ça (créer un Obstacle) | LDB 16 l.10 | flag | M | `travelFlow` (poursuite DR) | dépend du système de poursuite. |
| Poursuite : Environnement variable (Tests variés) | LDB 16 l.12 | flag | M | `travelFlow` (type de Test/Round) | idem. |

### Activités / Entre-deux-aventures
| nom | réf | type | cx | point de code | note |
|---|---|---|---|---|---|
| Tout « Entre deux aventures » est facultatif | LDB 22 l.14 | flag | M | `upkeep`/`travelFlow` (toggle parent) | englobe devoirs Elfes + Argent à gaspiller. |
| Ignorer les devoirs d'Activité « Prestige Elfique » | LDB 23 l.48 | flag | S | `travelFlow`/`upkeep` | niche (Elfes haut rang). |
| Récupération de Chance en cours de session | LDB 17 l.52 | flag | S | `upkeep`/store (chancePoints) | notion de « session » ambiguë en solo. |
| PNJ avec Destin / Résilience | LDB 17 l.12 | — | — | **FAUX POSITIF** → donnée d'entité (fiche PNJ). |

### Création de personnage
| nom | réf | type | cx | point de code | note |
|---|---|---|---|---|---|
| Sélection aléatoire de race (+20 PX) | NADJ 14 l.64 | mode | M | `character.ts`/`draft.ts` | s'aligne sur le pattern Signes astraux. |
| Race Gnome jouable (toggle) | NADJ 14 l.10 | flag | L | `character.ts`/`creation.ts`/données | contenu = données ; registre = activation seule. |

### Sous-systèmes XL (en dernier)
| nom | réf | type | note |
|---|---|---|---|
| Système alternatif Blessures/Critiques/Mort (AA) | AA l.2451 | heavy XL | refonte du cœur combat, mode exclusif ; englobe Retenir vos coups AA (l.2500) + Mort Subite AA (l.2505). |
| Avantages de Groupe (réserves collectives, AA) | AA l.4202 | heavy XL | mode exclusif vs Avantage individuel ; + Avantage Initial (l.4276). |
| Navigation fluviale (pack C2) | C2 ch.5 l.73 | heavy XL | vents/dégâts/échouage/Tests par étape. |
| Poursuites complexes (suivi individuel, AA) | AA l.4001 | heavy L | extension de la poursuite simple. |
| Jeux de Taverne (NADJ) | NADJ 16 l.8 | heavy XL | 11 mini-jeux + mode rapide (l.13) + Middenball (l.119). |

## Carte de nettoyage (audit code)

1. **Code mort** — `RuleKind 'flow'` (`policy.ts:13` + `HouseRulesModal:59`) inutilisé, rendu comme `flag`. Retirer. **(Lot 1)**
2. **Constante en dur** — `testPolicy.ts:34-35` (5/96) → `param test-auto-band-width`. **(Lot 1)**
3. **Constante en dur** — `combat.ts combineMods:211` (60/−30) → 2 `param`. **(Lot 1)**
4. **Duplication** — `combat.ts rangeBandModifier:598` / `rangeBandName:609` : 5 seuils dupliqués → table `RANGE_BANDS`. **(Lot 1)**
5. **Constante en dur + commentaire trompeur** — `combat.ts helplessTest:549` (variante figée + commentaire « non retenue »). **(Lot 1 : commentaire ; Lot 2 : option)**
6. **Texte tuto** — `HouseRulesModal:21-24` (`.hr-intro`) contraire à « pas de tuto UI ». Retirer + CSS. **(Lot 1)**
7. **Constante en dur** — `conditions.endOfRound:189/213` ('intermediaire' ×2, + commentaire « non modélisée »). Faible priorité. **(Lot 2)**
8. **Couplage (à surveiller)** — `policy.ts` surcharges en `Map` module-level (état global). OK en mono-instance ; **avant la coop autoritaire-serveur**, passer la policy en argument explicite (comme `TestPolicy` l'est déjà). Ne rien changer maintenant.
9. **À centraliser** — accumulation des Tests étendus (medicFlow/chirurgie + magie) en UN point avant LDB 12 l.208 + dissipation collective. **(Lot 4)**
10. **À mutualiser** — modificateurs sociaux de Statut (4 règles) + pattern « carac/compétence alternative » : UN point de lecture, des branches, pas du calcul dupliqué. **(Lot 3)**

## Notes du synthétiseur (verbatim)

> Les 7 vrais quick wins sont des cleanups d'audit qui DEVIENNENT des règles (constantes en dur → `param`
> lus à un point unique déjà existant) : `test-auto-band-width`, `combat-diff-cap-bonus/malus`,
> `combat-cible-sans-defense`. Le nettoyage et les règles se recoupent le mieux là exactement :
> `combineMods` (l.211), `getTestPolicy` (l.34-35), `helplessTest` (l.549). Dédup confirmées : Mort Subite
> LDB 18 = AA l.2505 (déjà `combat-sudden-death`) ; `combat-advantage-cap` (fixe) ⊥ LDB 15 l.15 (= BI, axe
> distinct) ; « Retenir ses coups » LDB 18 ≈ AA l.2500 mais variantes divergentes (l'AA → pack XL). Écartés
> du registre (contenu/donnée, pas moteur) : Traits psycho perso, PNJ avec Destin, pétards de l'Opéra,
> dissipation Gnome. Écartée car c'est le RAW par défaut, PAS une option : « États différents non
> cumulatifs » (LDB 16 l.20). ZI (Zoo Impérial) non extrait (échec agent) — re-balayer si besoin, ~0 règle
> attendue dans le bestiaire.
