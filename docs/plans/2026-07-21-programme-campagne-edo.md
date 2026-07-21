# Programme — Campagne « L'Ennemi dans l'Ombre » (EDO + Compagnon EDOC)

> Artefact DATÉ (2026-07-21). Programme du chantier `campagne:EDO` — à supprimer une fois la
> campagne livrée (git porte l'historique). L'index des tickets vit sur l'ÉPIQUE GitHub ;
> ce document porte le POURQUOI et l'architecture d'adaptation.

**Mission (user, 2026-07-21, verbatim)** : « je te donne pour mission d'intégrer la campagne
Ennemi dans l'ombre de bout en bout, compagnon compris, pour une expérience en jeu vidéo RPG
inoubliable. […] Tu n'es pas la pour réaliser le travail mais de préparer le terrain et
formaliser cela sous une documentation/tickets complets. »

**Arbitrages rendus (2026-07-21, verbatim)** :
- « Le premier jalon est a supprimé completement, l'existant est tres vieux et l'application a
  énormement evolué » → le contenu Tome 1 existant (`tome1-*`, Jalon 4 du ROADMAP) se **PURGE
  intégralement**, aucune migration : reconstruction sur le pipeline canonique.
- « Pas certains que "creer-une-campagne" soit a jour, fais y tres attention » → skill et
  `docs/campagne-authoring.md` audités claim par claim (verdict : chemin exact, mais incomplet —
  §2.5) ; remise à niveau = ticket de Phase 0.

## 1. Vision & barre de qualité

Le jeu EST cette campagne (CLAUDE.md : « On contrôle un groupe de 4 aventuriers à travers la
campagne L'Ennemi Intérieur ») ; EDO en est le Tome 1. La barre : une expérience type
*Baldur's Gate / Neverwinter Nights* — mise en scène, enquête, festival vivant, comptes à
rebours visibles, PNJ incarnés — **sans MJ** (règle 7 : chaque « à vous de décider » du livre
reçoit un arbitrage explicite), **fidèle au RAW** (règle 1 ; prose verbatim, règle 5), **tout
en données éditables** (règle 2 : aucune scène codée en dur), sur le pipeline canonique
(`scripts/campagne/lib.mjs` → projet `{ schema: 2, scenes, worldMap }`).

Le Compagnon est DANS le périmètre : ses règles s'extraient intégralement (montures/véhicules,
voyage, patrouilleurs, mutations, Main pourpre) ; ses contenus jouables deviennent des
**modules insérables** de la campagne (ouverture alternative, rencontres de route, Joyau
caché, Carnaval).

## 2. État des lieux (mesuré le 2026-07-21, agents de grounding + audits)

### 2.1 Sources (FR, `Source/`)

- **EDO** = `Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` : 9 chapitres jouables + Appendice 1
  (guide de Bögenhafen, ~50 lieux) + Appendice 2 (nouvelles règles) + Annexe 3 (calendrier +
  11 documents joueur + 3 plans). ~90 beats, ~60 PNJ à statbloc, ~20 rencontres hostiles,
  ~30 points « au MJ », structure temporelle forte (foire 3 jours, enquête 4 jours, Morrslieb,
  rituel à minuit).
- **EDOC** = `…l'Ombre Compagnon/` : ch.1-3 fluff ; ch.4 montures/véhicules (9 tables + 8
  statblocs) ; ch.5 Voyager (système complet par Étapes) ; ch.6 patrouilleurs (péages + 4 PNJ) ;
  ch.7 pool de 16 PNJ de route + ouverture alternative « In Media Fuite » ; ch.8 catalogue de
  ~100 mutations (5 colonnes par Puissance) ; ch.9 Main pourpre (culte, 3 talents, carrière
  Magus 4 niveaux, Dhar, ~21 sorts, 3 créatures) ; ch.10 deux rencontres insérables ; ch.11
  scénario complet « L'Affaire du joyau caché » (donjon 10 zones) ; ch.12 Carnaval du
  Pandémonium (cadre + 6 créatures + 5 accroches + 6 prétirés hors-périmètre NADJ).
- **Défauts d'extraction relevés** (à réparer, autorisation user 2026-07-10) : le fichier
  `09 - _GoBack.md` d'EDOC porte la FIN du ch.5 (coupe fautive) ; EDOC ch.8 semble tronqué
  après les mutations mentales (folios annoncés p.65-72 non couverts) ; l'en-tête du ch.3
  EDOC est orphelin en fin du fichier ch.2 ; chronologie de Bögenhafen (fin EDO ch.9) à
  re-vérifier.

### 2.2 Systèmes moteur/UI (20 verdicts, vérifiés sur code)

| Système | Verdict | Note |
|---|---|---|
| worldMap/routes (terrestre `inns`, fluvial, mer), transitions, entrées multiples | EXISTE | `src/state/worldMap.ts` |
| Voyage terrestre joué jour par jour (péripéties, relais, coût, durée) | EXISTE | `travelFlow.ts` ; #298 |
| Voyage fluvial (périls, exposition maladies) | PARTIEL | #267/#268 |
| État narratif : flags, objectifs, journal, `VictoryCondition` (6 formes), ~51 Effects | EXISTE | `scene.ts` |
| Dialogues (when/cost/flow/testNode) | PARTIEL | 1 portrait par session, pas de multi-PNJ, pas de reprise de nœud |
| Temps & Calendrier Impérial (date vivante, avance au voyage/repos) | PARTIEL | aucun événement à date/jour ABSOLU (`delayedEffect` relatif seul) |
| Interlude/activités (gating `where` par lieu) | PARTIEL | gating sous-utilisé (5/40) |
| Hub de ville (`CityHubScreen`, POI) | EXISTE | pas de service écurie (#625) |
| Poursuite terre+mer | EXISTE | `engine/pursuit.ts`, Effect `startPursuit` |
| Multi-niveaux (égouts, étages) via `z` + arêtes climb | EXISTE | pas de type séparé |
| Réputation/déguisement/identité secrète | ABSENT | #433 ; `statusMod` temporaire seul |
| Enquête (indices, carnet) | ABSENT | rien au-delà de flags/journal |
| PNJ hors combat (planning horaire, foule) | PARTIEL | entités statiques |
| Cutscenes/mise en scène (`ParchmentCard`, musique par scène) | PARTIEL | bannière d'événement = #589 |
| Récompenses de scénario (`giveXp` OK, `giveFate` absent, jalons) | PARTIEL | #442 confirmé |
| Vocabulaire Campagne > Aventure > Session | TICKET | #530 (Session existe : `sessionEnd`) |
| Save/load (v13, migrations, goldens) | EXISTE | reprise en cours de campagne OK |
| Menu campagnes (`builtinCampaigns`) | EXISTE | `scenes/campaign.ts` |
| Compagnons/recrues (`partyAddHero`, Effect `openCharacterCreator`) | EXISTE | coop-aware |
| Économie (bourse PAR HÉROS #531, marchandage) | EXISTE | #298 (fork bargain) |

### 2.3 Données & Atlas déjà en base (EDO/EDOC) — mesuré et CÂBLÉ

**199 entrées taguées EDO (41) / EDOC (158) dans 21 fichiers `src/data/*.json`** — l'extraction
est bien plus avancée que la mémoire de projet ne le disait, et les fichiers sondés sont
BRANCHÉS au moteur (contre-grep orchestrateur 2026-07-21) :

- Ids de livres : les 5 tomes + 5 compagnons de L'Ennemi Intérieur sont catalogués
  (`ennemi-dans-l-ombre`, `ennemi-dans-l-ombre-compagnon`, …).
- EDOC ch.4/5 (voyage) : `weather.json` (11 → `engine/activities/combat/exposure`),
  `activities.json` (8 activités de voyage), `rencontres-edoc.json` (→ `engine/travelTables`),
  `incidents-monture.json` (→ `engine/mountTravel`), `problemes-vehicule.json`
  (→ `engine/drivingMishap`), `montures.json`, `vehicles.json` (6), 8 montures dans
  `creatures.json`.
- EDOC ch.8/9 : `mutations.json` 69 + `mutationTables.json` 15 tables (→ `engine/ops`),
  `obsessions.json` (→ `engine/corruption`), 23 sorts Tzeentch, 4 talents,
  `marque-de-tzeentch`/`feu-de-tzeentch`, 4 tables d'Allure démoniaque, 3 démons.
- EDO : App.2 partiellement en base (6 traits, 5 mutations, `fievre-cerebrale-pourpre`,
  symptômes `delire`/`gonflement`, état `digere`) ; Calendrier Impérial complet (4 fichiers,
  → `engine/clock.ts`).
- Atlas : EDO/EDOC cités dans 18 fiches ; `raw.manifest.json` ne déclare AUCUNE dette
  EDO/EDOC ; dérive de nommage possible (`catalogue-sorts` dit « Tzeentch EDO », la donnée
  tague EDOC).
- `art-ref/` : `edo-vehicules` = 213 scans EDOC (aucun `gameId`, inexploités) + 1 carte
  d'Altdorf incidente ; ZÉRO référence Bögenhafen ; aucune carte de ville en donnée jeu.

Conséquence : la Phase B est un **SOLDE par confrontation adversariale** (chapitre du livre →
base → câblage → fidélité), pas une extraction from scratch. Trous connus d'avance : Pneumonie/
Rhume commun, carrière Magus 4 niveaux, Anneau d'Opsianon, portes/serrures (BE/B), difficultés
étendues −40/−50, table des accents, création rapide de PNJ, péages/compagnies de diligence,
Dhar (#517), et 0 entrée `locations`/`gods`/`careers`.

### 2.4 Legacy tome1 : purge DÉJÀ EFFECTIVE dans l'arbre — résidus à solder

Contre-vérifié (ls + grep, 2026-07-21) : plus AUCUN fichier ni référence `tome1*` dans `src/`.
Restent à solder : images QC orphelines (`dist/qc/tome1-quads.png`, `public/qc/tome1-quads.png`),
le **ROADMAP Jalon 4 qui décrit encore ce contenu comme « ✅ livré »** (référence vivante qui
ment), et le cas `src/scenes/ambush-test.ts` (EDO ch.2 legacy, consommé par le scénario de test
`embuscade.ts` et 4 tests d'état — à instruire : conserver comme banc de test ou refondre).
Le scénario de test `embuscade.ts` (« Du Sang sur la Route », Knud Cratinx + 4 brigands en
`CustomStatblock`) reste un scénario de TEST, pas une scène de campagne.

### 2.5 Docs d'authoring (audit du 2026-07-21)

`creer-une-campagne` + `docs/campagne-authoring.md` : chemin décrit EXACT (lib, compilateur,
schéma 2, validateurs id-only, catalogues navals confirmés sur pièces) mais INCOMPLET :
Effect `givePossession` (socle possessions #614/#615) absent, 6ᵉ `VictoryCondition`
`firstBlood` absente, 3ᵉ précédent `barge-du-sel` non cité, 2 réfs de lignes mortes (bridge
vessel⇄combat : réel = `combatSlice.ts:2476` / `combatFlow.ts:4629`), et aucune carte des
~51 Effects pour l'auteur.

### 2.6 Backlog existant à articuler (ne pas dupliquer)

#530 (vocabulaire Campagne>Aventure>Session — prérequis partagé avec l'ossature D.0),
#442 (récompenses de scénario/giveFate — débloque les fins de chapitre), #517 (Dhar, cité
EDOC ch.9), #459 (5 mutations EDOC sans mécanique — absorbé par B.4), #589 (bannière
d'événement — mise en scène), #433 (Statut/identité — lié, non bloquant pour T1), #343/#345
(hubs/POI), #298 (voyage/marchandage), #211 (méthode attendu-vs-réalité : l'ATTENDU utilisateur
se capture en OUVERTURE de chaque passe), #571 (animaux possédés), #625 (écurie), #626
(capture de bêtes), #395/#560/#648/#656 (possessions/dotations).

### 2.7 Vocabulaire de scène & éditeur (audit d'expressivité, 2026-07-21)

Demande user (verbatim) : « L'éditeur peut aussi avoir de grand manque de vocabulaire, ou
d'élément, qui permettent de mieux correspondre a la description des scenes de l'aventure. »
Audit mené : ~45 éléments de scène exigés par les 9 chapitres confrontés au vocabulaire réel
(25 terrains, 110 defs de décor dont 59 à fiche mécanique `props.json`, 7 styles
`addBuilding`, 29 structures brèchables, lumière 5 paliers + sources portées/posées, météo
câblée, `z`/relief/escalade, zones d'effet, palette éditeur 12 outils). **La majorité est
EXPRIMABLE par composition** (cour d'auberge murée, épave de diligence, corps fouillables,
placards, pilori+PNJ, enclos, plaque d'égout, obscurité+torches, jardin muré 3 m, portes qui
se verrouillent en cours de scène…). **7 familles de manques confirmés** → Phase V
(#700-#706) : porte secrète + fenêtre franchissable (`WallSeg`), déplacement scripté
d'entité + SFX ponctuel, géométrie dynamique en cours de scène (fosse du rituel — LOURD),
FX scéniques persistants (portail/incendie/fumée — LOURD), ciel nocturne & lunes (les phases
sont DÉJÀ en donnée calendaire, sans surface), décor data-only (ring, roulotte-cage, palan,
quai, borne, eau-sale, octogramme, écurie/brasserie, jeu de cartes), et **masses
environnementales** (#706, recadrage user : « des choses comme de la foret ou autres éléments
qui ne soit ni un sol, un mur ou un "objet décors" » — aujourd'hui la forêt est soit un bloc
infranchissable `bois`, soit un semis manuel de 5 props ; il faut le peuplement seedé, le
sous-bois praticable avec couvert RAW, les lisières). Conceptions actées : le canal du ch.4
reste un OBSTACLE longé par le halage (pas de « marche sur l'eau ») ; le pont du Bérébéli
s'authore en scène normale (la facette `deck` n'est pas requise) ; le véhicule terrestre
FONCTIONNEL posable (monter/toit praticable) n'est exigé par AUCUN beat des 9 chapitres
(épave + décor couvrent les scènes, les trajets sont du voyage) — besoin inexistant, pas un
report : s'il émerge à l'authoring, il se ticket à ce moment-là.

## 3. Architecture d'adaptation

### 3.1 Conventions

- **Projet** : `scripts/edo/generate.mjs` (imports depuis `scripts/campagne/lib.mjs`, jamais
  copiés) → `src/scenes/edo/edo-projet.json` (`{ schema: 2, scenes, worldMap }`) + test
  `edo-projet.test.ts` + garde de FLUX (modèle `arene-flow.test.ts`).
- **Ids stables préfixés** `edo-` : scènes `edo-ch1-auberge`, flags `edo.ch2.lettre-lue`,
  objectifs `edo-obj-*`, dialogues `edo-dlg-*`. Aucun label en logique.
- **Un chapitre = une AVENTURE** au sens #530 : frontières authorées (interlude + `sessionEnd`
  + récompenses), objectifs posés/soldés par chapitre (`setObjective`/`clearObjective`).
- **Prose** : les encadrés de lecture à voix haute et documents du livre se collent VERBATIM
  (règle 5, Markdown). Le dialogue interactif est de l'ÉCRITURE D'ADAPTATION (français, ton du
  livre) — il ne paraphrase jamais une règle et ne porte jamais de méta technique.

### 3.2 Politique « points au MJ » (règle 7)

Chaque occurrence relevée (~30) reçoit dans le ticket de son chapitre UN arbitrage explicite :
valeur/voie maison **taguée `maison`** en donnée éditable quand le livre laisse le choix
(cas 1), implémentation fidèle quand le livre définit et que le moteur manque (cas 2 = dette,
jamais « adaptation »). La liste vit dans les tickets D.1-D.9, pas ici.

### 3.3 Politique variantes d'encart

Le livre propose des variantes alternatives (destin d'Adolphus ×4, Grand Méchant substituable
×5, rencontre mutants ×5, « Libérez le démon », félin→loup-garou…). **La campagne implémente
LA voie canonique du livre** (le texte principal), UNE par embranchement, choisie et consignée
dans le ticket du chapitre. Les encarts alternatifs ne sont NI implémentés NI « différés » :
c'est un choix éditorial DÉFINITIF (le jeu EST cette campagne), pas de la dette — une variante
ne redevient du travail que sur demande explicite de l'utilisateur. Seule exception : une
variante qui tient en donnée pure triviale (substitution de statbloc) peut entrer dans le
geste. Zéro demi-implémentation, zéro langage de versionnement (pas de « v2 »).

### 3.4 PNJ nommés = registre de PRESETS (reprise du Lot C, Jalon 8.6)

~60 PNJ EDO + ~30 PNJ EDOC portent des statblocs complets. Le mécanisme `CustomStatblock`
par scène ne passe pas à cette échelle (PNJ récurrents multi-scènes : Josef, Teugen, Gideon…).
Fondation P0.6 : un registre data-driven de presets (id stable, statbloc, apparence/tenue,
portrait), éditable au Codex, consommé par `entities`/`encounters` et le dialogue. La
politique mémoire « créature d'aventure = CustomStatblock » est SUPERSÉDÉE pour les PNJ de
campagne par ce registre (les one-shots restent libres).

### 3.5 Structure narrative du Tome 1

| Ch. | Titre | Lieu/échelle | Nature dominante | Cartes à produire |
|---|---|---|---|---|
| 1 | On recherche : aventuriers courageux | Auberge « La Diligence » (12 zones) | Social, jeu de cartes, 0 combat obligatoire | auberge (int.) |
| 2 | Erreur sur la personne | Route forestière | Embuscade mutants, sosie, patrouilleurs | route + Sept Rayons |
| 3 | Le cœur de l'Empire | Altdorf (Königsplatz, tavernes) | Urbain, filatures, bagarre | Altdorf partiel |
| 4 | Sur la route de Bögenhafen | Canal de Weissbruck, Bérébéli | Voyage fluvial, attaque nocturne | canal/Weissbruck + pont du bateau |
| 5 | Le faux héritage | Bögenhafen, Garten Weg | Piège, horreur hors-champ | ruelle/cabinet |
| 6 | La Schaffenfest | Champ de foire | Festival 3 jours, 2 scènes-clés | foire |
| 7 | Dans les ténèbres | Égouts + temple secret | Exploration, rencontres, démon | égouts multi-branches + temple |
| 8 | Chasser les ombres | Bögenhafen ville | ENQUÊTE 4 jours, Morrslieb | bureaux Steinhäger + lieux App.1 |
| 9 | L'heure fatidique | Ostendamm, Entrepôt 13 | Poursuite, rituel à minuit, 3 fins | entrepôts |

La worldMap du Tome 1 : Auberge de la Diligence → Altdorf (route impériale) → canal de
Weissbruck (fluvial) → Bögenhafen ; relais/péages EDOC ch.3/6 posés en `inns`/péripéties.

### 3.6 Modules Compagnon insérables

| Module | Source | Insertion |
|---|---|---|
| Ouverture alternative « In Media Fuite » | EDOC 11 | remplace ch.1-2 (option de lancement) |
| PNJ de route (pool 16) | EDOC 11 | rencontres de voyage + relais, réutilisés en ville (réfs datées par page EDO) |
| Emmaretta (Métamorphe) / Un ami dans le besoin | EDOC 14 | routes ; « Ami » suggéré route de Helmgart |
| L'Affaire du joyau caché | EDOC 15 | libre, tout long voyage routier |
| Carnaval du Pandémonium | EDOC 16 | libre, mi-campagne |

## 4. Phases & tickets

> **Épique : #665** (label `campagne:EDO`) — l'index vivant. Dépendances portées par les
> tickets (« Bloqué par #N »). Correspondance codes → tickets :
> P0.1=#666 · P0.2=#667 · P0.3=#668 · P0.4=#669 · P0.5=#670 · P0.6=#671 ·
> B.1=#672 · B.2=#673 · B.3=#674 · B.4=#675 · B.5=#676 · B.6=#677 · B.7=#678 · B.8=#679 ·
> B.9=#680 · C.1=#681 · C.2=#682 · C.3=#683 · D.0=#684 · D.1-D.9=#685-#693 · D.10=#694 ·
> E.1=#695 · E.2=#696 · E.3=#697 · F.1=#698 · F.2=#699 ·
> V.1=#700 · V.2=#701 · V.3=#702 · V.4=#703 · V.5=#704 · V.6=#705 · V.7=#706.

**Phase 0 — Fondations & purge** : P0.1 solde des résidus tome1 (QC orphelins, ROADMAP
Jalon 4 réécrit, cas `ambush-test.ts` instruit) ; P0.2 remise à niveau skill/doc campagne +
carte des Effects GÉNÉRÉE ; P0.3 échéancier narratif absolu (jour de campagne/date impériale
+ compte à rebours visible) ; P0.4 dialogues multi-interlocuteurs (portrait par nœud,
reprise) ; P0.5 carnet d'enquête (indices data-driven, `maison`) ; P0.6 registre de presets
PNJ.

**Phase V — Vocabulaire de scène & éditeur** (audit §2.7) : V.1 arêtes d'état avancé (porte
secrète + fenêtre franchissable — bloque D.8/D.1) ; V.2 mise en scène scriptée (déplacement
d'entité + `playSfx`) ; V.3 géométrie dynamique (fosse du rituel — bloque D.9, LOURD) ;
V.4 FX scéniques persistants (portail/incendie/fumée — LOURD) ; V.5 ciel nocturne & lunes
(Morrslieb — consommé par D.8/D.9) ; V.6 décor & données de scène (data-only — alimente
E.1/D.1/D.6/D.7) ; V.7 masses environnementales (forêt praticable/peuplement seedé/couvert —
bloque D.2, alimente D.1/E.1). V.3/V.4 ne bloquent que le climax : à lancer tôt, en
parallèle de B/C.

**Phase B — RAW & données, SOLDE par confrontation** (`livre:EDO-EDOC` ; l'essentiel est déjà
en base et câblé, cf. §2.3 — chaque ticket confronte le chapitre à la base : présence, câblage,
fidélité, puis comble) : B.1 solde EDO App.2 (+ portes/serrures, difficultés −40/−50, Anneau
d'Opsianon, accents, création rapide PNJ) ; B.2 solde EDOC ch.4 (localisations quadrupèdes/
véhicules, réparation, sauts en marche) ; B.3 solde EDOC ch.5 (Étapes/arrivée/Sociabilité,
Pneumonie/Rhume, activités manquantes) ; B.4 solde EDOC ch.8 (+#459) ; B.5 solde EDOC ch.9
(carrière Magus, structure du culte ; Dhar→#517) ; B.6 EDOC ch.3+6 routes/péages/compagnies +
4 PNJ patrouilleurs ; B.7 réparation d'extraction Source ; B.8 documents joueur + plans ;
B.9 curation des ~90 statblocs PNJ en presets.

**Phase C — Systèmes d'expérience** : C.1 fête foraine (événements d100, ring de lutte,
attractions — patron réutilisé par le Carnaval) ; C.2 mise en scène (bannière #589, musiques,
prophéties, foule/incendie) ; C.3 Bögenhafen hub & lieux (App.1 → sélection jouable, POI,
temples/guildes).

**Phase D — Authoring** : D.0 ossature projet (worldMap, builtinCampaigns, interludes,
récompenses — avec #530/#442) ; D.1-D.9 un ticket par chapitre (beats, arbitrages MJ,
variante canonique, DoD = recette joueur du chapitre) ; D.10 modules Compagnon (§3.6).

**Phase E — Art** : E.1 cartes & décors ; E.2 PNJ presets (tenues/têtes/portraits, barre
d'art en vigueur) ; E.3 créatures & props manquants (gobelin mutant à 3 pattes, amibe,
héraut de Tzeentch, animaux de foire, parchemins).

**Phase F — Recette** : F.1 outillage/scénarios de test des systèmes neufs ; F.2 recette de
campagne (par chapitre au fil de D, bout-en-bout, personas, coop).

Ordre : P0 d'abord (P0.1/P0.2 immédiats) ; B et C parallélisables ensuite ; D.0 dès P0 fini ;
D.n consomme B/C au fil de l'eau ; E en parallèle de D ; F ferme chaque chapitre puis le tout.

## 5. Risques & gardes

- **Fidélité** : chaque donnée extraite taguée `source {book,page}` ; gardes existantes
  (docs:check, raw:implemente, cliquets) restent vertes ; tout topic non implémenté déclaré
  dans `raw.manifest.json` (CI rouge sinon).
- **Anti-régression contenu** : test projet + garde de FLUX par campagne (modèle arène) ;
  la recette joueur est le DoD de CHAQUE chapitre (pas de fermeture sur tests verts seuls).
- **Échelle** : ~35 tickets, plusieurs mois — l'épique est l'index vivant ; toute prémisse
  corrigée se commente sur le ticket DANS LE TOUR (credo).
- **Coop** : chaque système neuf (carnet, échéancier, dialogues) déclare son comportement
  multi-joueurs (mémoire : intents par propriétaire, jamais miroir-hôte).
