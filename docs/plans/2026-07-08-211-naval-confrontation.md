# Programme #211 — passe NAVAL : grand livre de la CONFRONTATION (2026-07-08)

> **Artefact daté**, quatrième pièce de la passe (attendu / écrans / scénario / **confrontation**).
> Méthode choisie par l'utilisateur : CONSTRUIRE la campagne « Le Loup et la Saumure » avec les
> outils réels (journal : [`2026-07-08-211-naval-authoring-journal.md`](2026-07-08-211-naval-authoring-journal.md)),
> puis réfuter adversarialement chaque mur (3 juges), puis recette joueur.
>
> **État à la clôture de session (limite API, reset minuit)** : construction ✅ (générateur +
> projet 5 scènes + 10 tests verts, régénération déterministe vérifiée par l'orchestrateur) ·
> réfutation des murs ✅ (verdicts A-N ci-dessous) · **recette joueur ⏸ INTERROMPUE** par la
> limite de session APRÈS avoir trouvé un bug bloquant P0. À reprendre : recette complète,
> puis ouverture des tickets listés en §4 sur #211, puis skill `creer-une-campagne`.

## 1. Le livrable de construction (vérifié)

- `scripts/loup-et-saumure/generate.mjs` — générateur (pipeline canonique `scripts/arene/lib.mjs`
  + ASCII/MapSpec/buildScene, réutilisé par import, zéro modification de l'existant).
- `src/scenes/loup-et-saumure/loup-et-saumure-projet.json` — projet v2 généré : 5 scènes
  (`ls-quai-salzenmund` → `ls-abordage-cogue` → `ls-quai-erengrad` → `ls-abordage-olg` →
  `ls-epilogue-salzenmund`), worldMap 2 ports / 2 routes mer (chacune son `ambush`).
- `src/scenes/loup-et-saumure/loup-et-saumure-projet.test.ts` — 10 assertions, suite verte
  (rejouée par l'orchestrateur via `node_modules/.bin/vitest` — le hook RTK tronque `npx vitest`
  sur ce repo à cause du préambule gen-registry : friction d'outillage à part).
- Journal d'authoring : 14 EXPRIMABLE · 9 CONTOURNÉ · 5 INEXPRIMABLE (avant réfutation).

## 2. Verdicts de la réfutation adversariale (3 juges, preuves fichier:ligne)

| # | Mur du journal | Verdict juge | Preuve / couture ratée |
|---|---|---|---|
| A | Humeur de Manann inaccessible aux Effects | **CONFIRMÉ** (fix bon marché) | Seul `setVessel` touche le navire (`scene.ts:345`), zéro op `vessel/manann` dans `ops.ts` ; MAIS `applyManannFactor` + facteur `grand-sacrifice` existent (`engine/seaVoyage.ts:89`) — il ne manque qu'un Effect wrapper |
| B | Sabotage (−1à−5 DR) inexprimable | **RÉFUTÉ en combat / CONFIRMÉ en voyage** | `Combatant.saboteurDR` est AUTHORABLE sur la coque (`engine/types.ts:971-975`, commenté « authoré par le scénario ») → injecté dans les Tests d'équipage de COMBAT (`combatSlice.ts:152-157`) ; le VOYAGE l'ignore (`seaVoyageFlow.ts:216-248` n'importe pas `shipSaboteurDR`). **POISON** : `types.ts:974` prétend « TOUT Test d'équipage (… Rude épreuve…) » — faux, sur-vendeur |
| C | Pas de bridge navire-campagne ⇄ combat | **RÉFUTÉ** | Le pont existe (#30) : réconciliation au début (`combatSlice.ts:2292-2294`, si `creatureId === vessel.vehicleId`) et écriture retour en fin (`combatFlow.ts:4308-4310`). Condition : câbler la coque via `setVessel` |
| D | Ambush de route MER injouable sur traversée calme | **CONFIRMÉ (structurel)** | `route.ambush` lu uniquement par `startChaseBoarding` (`seaVoyageFlow.ts:841`) sur poursuite PERDUE d'un événement RNG hostile ; la mer ne lit JAMAIS `route.perils/perilDie` (chemin terrestre « Attaqués ! » inaccessible, `travelFlow.ts:596-605`). Aucun combat authoré garanti sur route maritime |
| E | Coques impossibles en `enemies[]` terse | **RÉFUTÉ (gap d'UNE ligne)** | `creatureId()` (`lib.mjs:33-38`) n'a pas de fallback `findVehicleById` ; le SCHÉMA les supporte (`encounterAuthoring.ts:46-54,89-93`) et `16-embuscade-fluviale.ts:40-49` pose des coques terse |
| F | Pas de helper ShipPoste, réplication à la main | **RÉFUTÉ** | `itemFromTrappingById` exporté (`engine/items.ts:166`), importable côté tsx, uid déterministe — le helper local du générateur ré-implémente inutilement |
| G | Poste `crewIds:[]` servable en jeu | **CONFIRMÉ (exprimable, pas un mur)** | `servablePostes`/`serveAtPoste` (`shipPostes.ts:276-322`), chemin de production (`ActionBar.tsx:365,397`) |
| H | Pas de reddition à mi-Blessures | **CONFIRMÉ** | Union à 4 formes (`scene.ts:717-721`) ; les replis IA (`ai.ts:223-226`, fuite Brisé) sont du MOUVEMENT, ne terminent jamais le combat (`combatFlow.ts:4326-4370`) |
| I | Sens de route non imposable (aller/retour) | **CONFIRMÉ (mur mou)** | Routes bidirectionnelles (`worldMap.ts:128-129`), le joueur choisit librement (`WorldMapView.tsx:377-440`) — nommage, pas verrou |
| J | Pas de créature norse/marin générique | **CONFIRMÉ (curation)** | MDG folder = boss `named:true` + monstres ; mais `maraudeur-du-chaos` (`creatures.json:29235`) = l'archétype norse canonique, meilleur réemploi que `pirate-fluvial` |
| K | Proue-idole = invention de règle, renoncé | **RÉFUTÉ (faux renoncement)** | Catalogue réel = `naval-traits.json` (19 entrées, éditables), `figure-de-proue` existe (`:372`) ; un trait maison TAGUÉ est du contenu légitime (règles 2 et 7). Limite réelle : le vocabulaire passif est keyé par SKILL, pas par crew-test-type (le +1 DR « Poursuite seulement » fuiterait sur toute Navigation) |
| L | Salaires d'équipage absents des données | **CONFIRMÉ** | RAW vérifié (`MDG 14 l.293-302`) ; zéro champ wage/paie dans `crew-roles.json` et tout `src/` — table RAW non implémentée (règle 7) |
| M | Pas d'archétype marchand avitailleur | **CONFIRMÉ** | 4 archétypes TS seulement (`src/state/merchants/defs/`) ; `pieces-detachees-de-navire` (`trappings.json:12024`) hors de tout `curated`. Note : archétypes = TS codé, tension avec la règle 2 |
| N | Index des ports MDG absent en donnée | **CONFIRMÉ (gap de curation)** | `PortProfile` = type authorable par worldMap (`worldMap.ts:31`) ; aucun catalogue des villes MDG (l'index RAW `MDG 15 l.439-506` non extrait) |

## 2bis. Requalification (lecture utilisateur, 2026-07-08 soir) — les « réfutés » sont des défauts d'EXPÉRIENCE AUTEUR

Un mur « réfuté » ne blanchit pas le jeu : il accuse la documentation. Chaque couture ratée l'a
été pour une cause reproductible par TOUT futur auteur :
- **B (saboteurDR)** : couture documentée uniquement par un commentaire de `types.ts` (hors de
  toute table de routage/doc/skill) — et ce commentaire MENT sur son périmètre (poison, §2.B).
- **C (bridge vessel⇄combat)** : mécanisme éclaté entre `combatSlice`/`combatFlow`, invisible
  depuis `spawn.ts` (le point d'entrée naturel d'un lecteur) ; mode d'emploi (`setVessel` +
  `vehicleId` identique) écrit nulle part.
- **E (coques terse)** : le MESSAGE D'ERREUR de `creatureId` (« créature introuvable ») enseigne
  le faux — l'ergonomie d'erreur est le doc que l'auteur lit en premier.
- **F (helper postes)** : le principe « un générateur PEUT importer les primitives moteur » n'est
  énoncé nulle part (la lib arène le pratique sans l'ériger en règle).
- **K (Proue-idole)** : catalogue `naval-traits.json` non cartographié (l'auteur a cherché dans
  `vehicles.json`) + doctrine house-rule-taguée mal transmise.

**Taxonomie finale des trouvailles de la passe** : (1) coutures moteur manquantes — A, D, H,
B-voyage, armement non persistant du navire ; (2) données/curation absentes — J, L, M, N ;
(3) **expérience auteur** (tout existait, rien n'était trouvable) — friction n°0, B, C, E, F, K,
+ le P0 (une donnée d'auteur qui crashe l'UI = validation d'entrée absente = la même classe).
La classe (3) est la plus volumineuse — c'est elle que le chantier tickets 8+9 doit fermer par
des GARDES (doc vivant + skill + messages d'erreur), pas par une purge ponctuelle.

## 3. Recette joueur — COMPLÉTÉE le 2026-07-09 (128 appels/150, méta-rapport au dossier)

**P0 tranché : SYSTÉMIQUE, sur main, pour tout le monde** (témoin « ⚓ Voyage maritime » crashe
aussi, 2/2). Cause racine : `engine/travel.ts:138` `vehicleTravel(mode)!.classes` — assertion
menteuse, `vehicleTravel('mer')` = `undefined` (le navire de campagne n'est pas un transport
loué) ; site déclencheur `WorldMapView.tsx:291-292` (n'exclut pas `'mer'` du calcul de tarif) ;
AUCUNE error boundary → React démonte tout, écran vide, session perdue. Stack au dossier.
**Conséquence recette : la TRAVERSÉE (cœur du système — jours, météo, Tests d'équipage, Humeur)
n'a jamais pu être vécue à l'écran** — son seul point d'entrée joueur est cassé. FIX EN COURS.

**Segments joués** (contournement `__wfrp.go()` consigné comme échec de flux) : quai de
Salzenmund JOUABLE (tous dialogues + marchand réels) ; combats cogue et Olg JOUABLES (frise,
victoire, butin ; vomissement d'Olg présent en donnée mais pas observé déclenché) ; Erengrad
PARTIEL (réparation par dialogue dédié, pas de bouton Port — à revérifier hors contournement) ;
épilogue JOUABLE.

**Trouvailles nouvelles** :
- **Les navires se rendent en BIPÈDES HUMAINS au combat** — `pickBackend` ne résout pas les refs
  `loup-imperial`/`cogue` en rig (8 warnings console) : la lecture visuelle du combat naval
  n'existe pas (screenshot au dossier).
- **Notes d'auteur FUITÉES dans le texte joueur** (3 dialogues/6 : Aldo, Kramer ×2 — du
  `state.vessel.manann [INEXPRIMABLE]` affiché au joueur) — défaut de MON codeur, purge en cours.
- **Nom du navire incohérent** : « le Grimm » (dialogues) vs « Loup impérial » (HUD/journal
  système) — vérifier si le navire de campagne est NOMMABLE par l'auteur, sinon ticket.
- **Hit-target des routes quasi incliquable** (UX joueur réel, pas que testeur) :
  `pointer-events: stroke` sur le tracé seul, libellé/badge en `pointer-events: none` — ~35
  appels du budget recette engloutis là ; entrée de doc recette en cours d'ajout.
- **Pas d'error boundary globale** : un TypeError de render = perte de session totale.
- **Les 5 écarts d'EXPÉRIENCE** (confrontation aux éléments B/C de l'attendu) : (1) traversée
  inaccessible [P0] ; (2) navires invisibles [rigs] ; (3) AUCUN tableau de bord navire persistant
  hors combat (attendu C.1 — coque/Moral/Humeur enfouis dans le state) ; (4) escale = dialogues
  épars, pas de hub (attendu C.12) ; (5) équipage-ressource sans surface UI hors combat (attendu
  C.7/C.10 — Aldo/Griet n'existent qu'en combat).

## 4. Tickets de la passe — OUVERTS le 2026-07-09 (entrées 2-13 → issues #212-#223)

**Correspondance** : 2→#212 · 3→#213 · 4→#214 · 5→#215 · 6→#216 · 7→#217 · 8→#218 (chantier
expérience auteur) · 9→#219 (skill, dépend de #218) · 10→#220 · 11→#221 · 12→#222 · 13→#223.
**Rectifications faites PAR l'agent d'ouverture (vérification, pas recopie)** : (a) la citation
« cogue rompt à mi-Blessures, MDG 14 l.45-47 » du journal était une MÉPRISE (c'est la règle de
sabotage) — le RAW est réellement muet sur un seuil de reddition ; précédent réel : créatures
« repoussées à mi-Blessures » (`MDG 15 l.143/166-168`) ; et `resolveShipUnits`
(`shipCrew.ts:202-223`) gère DÉJÀ la capture par anéantissement d'équipage → le trou est le seuil
PARTIEL seulement (#215 recentré). (b) Vrai site de matérialisation des postes :
`siegeEmplacement.ts:41-44`, pas `editorState.ts:38-46` (#222 corrigé). (c) #223 recentré
post-`dabac920` sur les gardes restantes (le fix refs est commité ; tenue/arme par libellé =
contrat du rig, le grand livre sur-généralisait).
**2e vague OUVERTE le 2026-07-09** : 14→#224 (précision juge : la chaîne véhicule→rendu existe,
vrais défauts prouvés = routage du rendu de combat par `c.name`/label `pickBackend.tsx:117` +
garde DEV aveugle aux véhicules — les « 8 warnings » étaient des faux positifs) · 15→#225
(recentré : `SceneErrorBoundary` EXISTE, `WorldMapView` est hors périmètre `CampaignView.tsx:272`)
· 16→#226 · 17→#227 · 18→#228 (précision : `PortView` existe, bouton gaté `CampaignView.tsx:216` ;
triage Erengrad à refaire post-fix) · 19→#229 · 20→#230. **Commentaire récapitulatif POSTÉ sur
#211** (issues + corrections directes avec hashes).

**Entrée 1 (P0) : CLOSE — corrigée `c706cf9d`, VÉRIFIÉE navigateur le 2026-07-09** (clic réel de
la route mer : 0 erreur console, écran vivant). Le « PAS CORRIGÉ » de la mini-recette était un
DOUBLE artefact d'outillage, consigné au doc recette : module Vite périmé (watcher Windows ayant
raté l'écriture du codeur — `?t=` des URLs faisant foi, remède = toucher le mtime) + buffer
console MCP partagé entre sessions (`all:true` remontait les crashes de la session précédente).

**Compléments d'expérience de la traversée jouée (3 jours, mini-recette 2026-07-09)** — le récit
confirme #227/#229 et ajoute :
**Dernière vague OUVERTE le 2026-07-09** : 21→#231 (cartographié site par site : `MapRoute.km`
porte des MILLES en mer, affichages tantôt conscients du mode tantôt « km » en dur) · 22→#232
(rectification en vérifiant : la « Perception 1 jour/3 » était une MÉLECTURE — c'est le test du
PHARE d'arrivée, gaté ≤15 milles + port à phare, `seaVoyageFlow.ts:363-373` ; le défaut UX de
déclencheur incompris tient). Complément posté sur #211. **Le skill #219 est LIVRÉ et FERMÉ**
(`f6581b33`, `.claude/skills/creer-une-campagne/SKILL.md` — corrigé de l'erreur bridge du journal).
**PASSE NAVALE INTÉGRALEMENT CLOSE : #212-#232 + 4 corrections directes commitées.**

## 6. TRAITEMENT des tickets (l'utilisateur a confié le chantier, 2026-07-09 ~1h — « garant de la campagne »)

**Vague 1 LIVRÉE** (4 codeurs //, suite 9182 verte, typecheck 0) : #213+#214 → `02743fd5`
(adjustManann + saboteurDR voyage + commentaire corrigé) · #224 → `d752c173` (rendu par
creatureId) · #231+#226 → `4219db2e` (unités + hit-target) · #225 → `5fa66a0f` (boundary 3
étages). **Campagne étalon CÂBLÉE sur les coutures neuves** (Aldo → facteurs réels, Kramer →
saboteurDR −2 [maison] ; journal : 16 EXPRIMABLE · 9 CONTOURNÉ · 4 INEXPRIMABLE). Recette de fin
de vague EN COURS (5 preuves d'écran) — fermetures des issues après preuves.
**Trouvaille du câblage → #233 ouvert** : `setVessel` = remplacement TOTAL (`combatEffects.ts:
1176-1189`) — ajuster sans effacer (lever un sabotage) inexprimable ; fix proposé : instancier
vs ajuster (merge partiel ou `adjustVessel`).
**Vagues suivantes** : 2 = données (#216 salaires, #217 ports MDG, #220 avitailleur, #221
marin/Proue-idole, #230 nommage) · 3 = moteur (#212 événements ancrables, #215 reddition, #222
ShipPoste-référence+garde, #223 gardes anti-repli, #218 expérience-auteur, #233) · 4 = écrans
d'expérience (#227 dossier navire, #228 escale-hub, #229 équipage visible, #232 traversée
commandée — spec = les maquettes de `2026-07-08-211-naval-ecrans.md`).

21. **Unités km/milles mélangées pour la MÊME valeur** (tracé carte « 480 km » vs panneau
    « 480 milles » ; récap « 202 km » vs liste « 202 milles ») — le libellé km du système
    terrestre jamais adapté au mode mer. À ouvrir.
22. **[Expérience] La traversée est SUBIE, pas commandée** — 2 à 4 modales « Tout lancer →
    Appliquer » par jour, zéro décision (cap, allure, réaction à la météo affichée) entre
    l'assignation des postes au départ et l'arrivée ; l'écran de fin de journée est le camp
    TERRESTRE recyclé sans affordance navale ; la cadence de la modale Perception (1 jour sur 3)
    n'est jamais expliquée au joueur ; l'Humeur de Manann n'a AUCUNE surface visible en 3 jours.
    C'est la confrontation directe des attendus B.3 (horloge mise en scène), C.2 (journal de
    bord) et C.5 (Humeur visible). À ouvrir.

1. **[P0] Crash UI au clic d'une route maritime** (recette §3) — repro projet loup-et-saumure ;
   DoD : plus de crash + validation d'entrée des routes mer authorées + recette re-déroulée.
2. **Combat scénarisé injoignable sur route maritime** (D) — la mer ne lit ni `perils` ni
   d'événement ANCRABLE ; un `ambush` ne part que sur poursuite RNG perdue. Fix proposé : lecture
   des `perils` d'auteur par `seaVoyageFlow` OU événement de bord authorable ancré (jour/segment
   de route). DoD : la Dent de Manann se joue à l'aller SANS RNG favorable.
3. **Effect `adjustManann`/acte de piété authorable** (A) — wrapper vers `applyManannFactor`
   existant ; DoD : bénédiction/sacrifice d'auteur bougent la jauge, scène 0.3 rejouée.
4. **Sabotage en VOYAGE** (B) — brancher `shipSaboteurDR` dans `openVoyageCrewTest` + CORRIGER le
   commentaire menteur `types.ts:974` (poison). DoD : un saboteur authoré pèse sur
   Progression/Orientation, commentaire exact.
5. **VictoryCondition de reddition/seuil partiel** (H) — forme « ennemi X sous N % → rompt/amène
   le pavillon » ; DoD : la cogue rompt à mi-Blessures comme au RAW.
6. **Barème de salaires d'équipage en donnée** (L) — table `MDG 14 l.293-302` (règle 7) ;
   éditable ; branchée au recalcul de Moral (facteur paie) et à l'épilogue (solde).
7. **Catalogue des ports MDG** (N) — extraire l'index (`MDG 15 l.439-506`) en donnée partagée
   (villes Mer des Griffes avec Taille/Richesse/Production/Surplus/Demande), consommée par les
   worldMaps au lieu de profils recopiés par projet.
8. **Chantier « expérience auteur » — la classe (3) au complet** (friction n°0 + B + C + E + F +
   K, cf. §2bis) : promouvoir `scripts/arene/lib.mjs` en lib de campagne partagée + fallback
   `findVehicleById` dans `creatureId` **avec message d'erreur qui dit la vérité** ; helper de
   poste sur `itemFromTrappingById` ; **doc vivant `docs/campagne-authoring.md`** cartographiant
   les coutures invisibles (saboteurDR, setVessel⇄combat, coques terse, import des primitives
   moteur, catalogues navals) ; ligne dans la table de routage de CLAUDE.md. DoD : un agent SANS
   brief privilégié reconstruit une scène navale de campagne sans buter sur un seul des 6 murs.
9. **Skill `creer-une-campagne`** (trouvaille n°1, utilisateur) — le walkthrough du journal
   DEVIENT le skill, adossé au doc vivant du ticket 8 ; il nomme d'entrée le pipeline
   generate.mjs/ASCII et les pièges (routes bidirectionnelles, ambush-mer, câblage vessel).
10. **Marchand avitailleur** (M) — archétype (ou curation) portant eau/rations/pièces
    détachées/munitions navales ; noter la tension archétypes-TS vs règle 2.
11. **Mineurs** : créature « marin » générique + réemploi `maraudeur-du-chaos` pour les norses
    (J) ; trait de coque maison « Proue-idole » à AUTHORER en donnée taguée (K — le renoncement
    était le mauvais réflexe) avec, si retenu, extension du vocabulaire passif par crew-test-type.
12. **`ShipPoste` par RÉFÉRENCE, pas par copie** (trouvaille utilisateur 2026-07-08 soir —
    requalifie le verdict F) : le schéma (`engine/types.ts:870-872`) exige une `ItemInstance`
    matérialisée → le contenu authoré porte des COPIES des stats de `trappings.json` (preuve :
    `loup-et-saumure-projet.json`, poste tribord — damage/range/qualities/enc dupliqués), et
    l'ÉDITEUR écrit la même copie (palette `emplacement` par `trappingId`, `editorState.ts:38-46`,
    puis matérialisation, test verrouillant `editorState.test.ts:250`). Classe déjà éradiquée
    partout ailleurs (créatures par `ref`, traits par `NavalTraitRef`, migrations label→id) —
    un erratum d'arme laisserait toutes les scènes/sauvegardes avec les vieilles stats. Fix :
    **hydratation** — le format stocke `trappingId` + état d'instance (loaded/reloadProgress/
    munitions/uid) + dérogations ; les stats de base se résolvent au CHARGEMENT par la couture
    unique (`itemFromTrappingById`/`buildWeapon`). Conséquences : l'API d'auteur script devient
    le miroir de la palette (`poste('canon-moyen','tribord')` — plus AUCUN besoin d'importer le
    moteur, ce qui vide la moitié du ticket 8-helper) ; migration des scènes existantes + tests ;
    GARDE de classe : un test balayant les JSON de scènes/projets pour toute stat de base
    matérialisée d'un trapping référencé (anti-copie-périmée).
13. **[Régression visible] PNJ clonés partout + Galerie de modèles morte** (signalement
    utilisateur 2026-07-08 soir, deux causes PROUVÉES) :
    (a) **Pourriture de vocabulaire post-migration** — `galerie-modeles.ts:55,67,74` authore par
    LIBELLÉ (`ref: c.label`, `tenue: c.label` de carrière, `weapon: w.label`) ; depuis les
    migrations label→id (+ name-matcher supprimé), rien ne résout, et `spawn.ts:360` fait un
    **repli SILENCIEUX** (statbloc « Ennemi » B 10) → 97 créatures + toutes les carrières +
    toutes les armes rendues en clones humains à tenue par défaut. La vitrine de TOUT le rendu
    est morte sans un bruit. Fix immédiat : la galerie parle en ids (3 lignes).
    (b) **Zéro variété des humains génériques** — les 133 PNJ-personnages d'`arene-projet.json`
    ont TOUS `tenue` vide (20 sans `ref`), et aucune variété d'apparence par défaut n'existe
    pour un humain sans tenue (reste avoué du sweep rig : « villager »). Même refs saines →
    mêmes clones.
    **GARDES de classe (le vrai livrable)** : (i) un repli qui SE VOIT — ref/tenue/arme
    irrésoluble = erreur console + marqueur visuel « REF ? » sur le modèle (jamais un mannequin
    muet) ; (ii) test de balayage étendu : CHAQUE scénario/projet chargé, CHAQUE
    ref/tenue/weapon d'entité résout dans son registre (extension de `refs-migrated.test.ts` à
    tout `src/scenes`, y compris les refs générées à l'exécution comme la galerie) ; (iii) design
    à trancher : apparence seedée par entité pour les humains génériques (variété par défaut).
    Classe-mère commune avec le n°8 : **le lexique n'est pas exposé, et le runtime répond au
    vocabulaire inconnu par du silence** — l'auteur ne peut ni le découvrir ni voir ses erreurs.
14. **[P1] Les navires se rendent en bipèdes humains au combat** (recette 2026-07-09) —
    `pickBackend` ne résout pas `loup-imperial`/`cogue` en rig de coque (8 warnings) alors que
    `vehicles.json` porte `hull.rig` : la couture ref-véhicule → rendu est morte ou jamais
    branchée au spawn de combat. DoD : un combat naval MONTRE deux navires, recette re-déroulée.
    (Même famille de silence que 13.i : warning console au lieu d'un rendu-erreur visible.)
15. **Error boundary globale** — un TypeError de render ne doit JAMAIS coûter la session (écran
    d'erreur + état préservé) ; le P0 l'a prouvé à l'écran vide.
16. **[UX] Hit-target des routes de la carte du monde** — cliquable au TRAIT seul
    (`pointer-events: stroke`), libellé/badge morts (`none`) : pénible au vrai joueur, ruineux en
    recette. Élargir la zone cliquable (libellé + badge + tolérance du tracé).
17. **[Expérience, attendu C.1] Tableau de bord navire persistant** — coque/Moral/Humeur/cale
    visibles hors combat (le « dossier de navire » de l'attendu ; aujourd'hui : enfoui, mentions
    journal ponctuelles).
18. **[Expérience, attendu C.12] L'escale-hub** — un écran de port unifié (chantier/négoce/
    équipage/relâche) au lieu de dialogues épars ; l'absence du bouton Port à Erengrad est à
    re-trier une fois le P0 corrigé (artefact possible du contournement de recette).
19. **[Expérience, attendu C.7/C.10] L'équipage visible hors combat** — Aldo/Griet/les marins
    n'existent qu'en combat ; aucun poste/état/quart à l'écran entre deux scènes. (Se nourrit du
    ticket 6 — salaires — et de la décision villageois/tenues du 13.iii.)
20. **Nommage du navire de campagne par l'auteur** — si `setVessel`/`CampaignVessel` n'a pas de
    champ de nom (vérif en cours), l'ajouter ; le HUD/journal affichent le nom d'auteur
    (« Grimm »), plus jamais le libellé de type seul.

## 5. Reprise (prochaine session)

1. Trier/consigner le P0 (triage `14-voyage-maritime` vs projet custom), recette COMPLÈTE de la
   campagne (brief conservé dans l'historique de session : segments 1-7, budget ~150).
2. Confronter les résultats de recette aux éléments d'EXPÉRIENCE de l'attendu (B.1-B.10 : le
   ruban, l'horloge, le plan de pont, les urgences — ce que la construction seule ne teste pas).
3. Ouvrir les tickets §4 (`gh issue create`, gabarit) + les lister en commentaire de #211.
4. Écrire le skill `creer-une-campagne` (matériau : journal + verdicts E/F/G).
5. Statuer avec l'utilisateur : la campagne loup-et-saumure reste-t-elle comme scénario de
   référence commité (à committer alors : scripts/ + src/scenes/loup-et-saumure/ + les 5 docs de
   plans) ou artefact de passe jetable ?
