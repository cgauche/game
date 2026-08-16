# Spec HUD de combat — zones et adresses (sur Invariant V2) — RÉVISION 2 post-juge

> Plan daté, à supprimer une fois exécuté. BASE : `docs/plans/2026-08-16-hud-combat.md`
> (Invariant V2). Toute contradiction avec les arbitrages §1 se résout POUR le §1.
> RÉVISION 2 (2026-08-16) : les corrections b1/b3 du juge-de-spec sont INTÉGRÉES ; les
> Les 4 décisions b2 sont TRANCHÉES (AskUserQuestion 2026-08-16, toutes sur la
> recommandation) : gauche déduite du set · touche = CASE · console lecture + bandeau ·
> écran de capacités. La spec est PRÊTE À BRIEFER.
> Sondes du juge à PROMOUVOIR en tests au premier lot concerné : (i) co-occurrence G6
> (`fleau-d-armes`+`lance-harpon` → 2 gestes disponibles ensemble, prouvé) ; (ii) charge de
> grille par pré-tiré (Anselm = 14 capacités non-sort candidates > 12 cases) ; (iii) débord
> `StateChips` qui masque un remède (`en-flammes` 5ᵉ chip → « Se rouler » invisible).

---

## Zone 1 — LA CONSOLE (dock bas)

Une seule surface, géométrie IMMUABLE (position, hauteur, comptes de cases fixes).
Remplace l'actuel `.action-bar`/`.ab-bar` recomposé par condition. ⚠ Géométrie mobile À
MESURER au lot console : à 360px, une rangée de 8×52+7×4 = 444px > 336px utiles — la travée
gauche se plie en 2×4.
✅ MAQUETTE MESURÉE (2026-08-16, worktree `agent-ac9da5df07ad973dd` = BRANCHE DE BASE du
lot console — composant réel `CombatConsole.tsx` + `combat-console.css`, monté sur le store,
captures + DOM) : **1280×800 TIENT** (console 185px = 23 % du viewport, zéro débordement,
géométrie immuable PROUVÉE — 8/12 cases constantes entre la sorcière 211 sorts et un tireur
nu) ; **360×640 : 69 %** (442px) — le budget ~40 % explose en portrait.
✅ ARBITRAGE mobile (AskUserQuestion 2026-08-16) : **composition COMPACTE dédiée à ≤560px**,
sans rien perdre — arche réduite à une ligne (portrait mini + jauges fines), conduit fondu
dans le bord de la grille, commutateur replié sur l'icône du set actif, coin intégré —
cible ~40-45 % (~280px), à re-mesurer sur la même maquette.
Écarts maquette → ITEMS du lot console : bandeau de phase à couvrir AUSSI pour les
interludes (`pendingCleave`/`pendingDualStrike`/`pickingTargets`/`battery`) ; fin de tour
gatée sur le même prédicat que le store (`combatBusy`/cascade) avec sa RAISON (`GatedAction`)
— aujourd'hui clic muet ; pont clavier de console (l'actuel `hotbarBridge` meurt avec
`ActionBar`) ; purge d'`ActionBar` + knip ; dé-tripler l'Avantage (le conduit REMPLACE les
2 rendus d'`ActiveFrame`) ; touches des cases 9-12 à régler au volet clavier (1-8 posées).

### 1a. Travée GAUCHE — l'arsenal et le nécessaire (compte FIXE : 8 cases, 2×4 à 360px)

✅ TRANCHÉ (2026-08-16) : G1-G6 sont DÉDUITES du set au poing (changer de set change la
travée — c'est sa logique) ; le placement joueur vaut pour la grille + les cases objets.
« Entièrement à la main » visait les sorts/capacités, pas l'arsenal.

| Case | Contenu | Mécanisme |
|---|---|---|
| G1 | Attaque de l'arme du set — bouton d'intention (mode `attaque`) ; clic-ennemi direct inchangé | alvéole + `TargetingMode 'attaque'` |
| G2 | Charge — bouton d'intention (mode `charge`, `chargeReach` M×2 dans la bande Course) | alvéole + patron `pushEngine` |
| G3 | Viser (existant) | alvéole |
| G4 | Recharger + progression | alvéole |
| G5 | **Postures de tir** « Tir immobile » / « Dans le tas » — SEUL ACCÈS (verbatim « plutôt qu'une option dans la modale ») : la fenêtre de jet AFFICHE la posture armée et sa valeur calculée (lecture seule), elle ne porte plus le contrôle. ⚠ Les setters `attackSet*` sont des NO-OP sans `pendingAttack` (`combatSlice.ts:2210-2219`, `if (!pa) return`) → NOUVEAU champ de POSTURE PRÉ-ARMÉE (sur `battle` côté hôte, posé par intent — c'est un choix de JEU, pas d'affichage), consommé à la construction du `PendingAttack` (`combatFlow.ts:367`), remis à zéro au tir/fin de tour | alvéoles-toggle + champ `battle.stances` + intent |
| G6-G6bis | ✅ TRANCHÉ (matrice mesurée + AskUserQuestion 2026-08-16) : max prouvé = 5 gestes simultanés → **les gestes ouverts par une ENTITÉ adjacente sortent de la barre** : Monter → pastille sur la MONTURE, Servir la pièce / Pousser l'engin → pastille sur la PIÈCE (patron pastille-ⓘ, zone 4). La barre garde **2 cases fixes** : G6 = geste d'ARME (Repousser — jauge d'ARSENAL standing, `canPushback` sur `active.weapons` ; à terme posture-empoignade) ; G6bis = geste d'ÉTAT du héros (Quitter la pièce / Descendre / Manœuvrer le navire — résiduel mesuré ~2, priorité rare affichée, tous atteignables au focus). Sonde `g6-sonde.ts` promue en test au lot | matrice consignée |
| G7 | ✅ FUSION ACTÉE PAR LA MAQUETTE (la travée écrite faisait 9 cases pour 8 annoncées) : Consommables + Soin + Asperger d'eau = **UNE case objets/soin** à placement joueur (débord → inventaire ; le « panneau de débord » reste SUPPRIMÉ, garde anti-liste) | alvéole + `ItemIcon` |

**Sous la travée** : commutateur de sets (⚠ 4 `style={{…}}` en dur à purger — le 4ᵉ est
dans le tiroir munitions `ActionBar.tsx:568`, l'invariant n'en comptait que 3) + choix de
munition adossé à l'arme de tir. Munition FIXÉE AU CHARGEMENT (arbitrage) : le lot
munitions PRÉCÈDE le lot console (b3.20) pour ne jamais exposer une sémantique double.

### 1b. Travée DROITE — la grille de capacités (compte FIXE : 12 cases, 2×6)

2×6, gap 4 (332px ≤ 336px utiles à 360px — mesuré). Touche imprimée (zone 8), coût en
crans (⚠ coûts VARIABLES à prévoir : Se désengager gratuit `canFreeDisengage`, Frénésie
`freeFrenzy` — le cran s'affiche selon l'état, la donnée vient des gates existants).
Cases vides dessinées. Placement JOUEUR, remplissage par défaut fourni.

✅ TRANCHÉ (2026-08-16) : plancher non-sort mesuré = 14 candidats > 12 cases → l'exhaustif
des capacités NON posées vit dans l'ÉCRAN DE CAPACITÉS (zone 6 : le grimoire ÉTENDU —
sorts + manœuvres + talents à activation, sections par famille, PLACE et LANCE). La
grille reste 12 ; le panneau-liste reste banni de la barre.

**Défauts de remplissage** : keyés sur des CAPACITÉS MESURABLES (`spells.length`,
`combatAdvantageSkills`, `hasBattement`…, JAMAIS une pseudo-classe — les 9 classes réelles
de `careers.json` ne sont pas l'axe). Donnée : `src/data/console-defaults.json` + schéma
`src/data/schemas/defs/consoleDefaults.ts`, éditable Compendium.

**Conduit d'Avantage** branché sur la grille (10 colliers, plaque chiffrée, reflux).
⚠ Anti-sur-affichage : le conduit REMPLACE les rendus d'Avantage d'`ActiveFrame`
(jauge crantée l.63 + texte l.71) — jamais 3 écritures de la même donnée (défaut RT).

### 1c. Coin FIN DE TOUR + chrome de l'arche — PRÊT À BRIEFER

`end-turn` isolé + garde-fou existant. `undo-move` adossé à la jauge de Mouvement
d'`ActiveFrame` (⚠ `ActiveFrame` est pur-à-props — il gagne 1 prop de callback, pas un
accès store). Les chips `.ab-actor-top` (Assailli ×N, Cloué, Renfort — `ActionBar.tsx:646-657`)
restent le chrome d'état de l'arche, inchangées. `MovementIntent` (`:625-631`) reste le
porteur du coût de déplacement (loi 1 amendée) — ancré en bas, son apparition ne déplace
pas la console (à contractualiser en test de géométrie).

### 1d. Ce qui DISPARAÎT / se RELOGE (adresses COMPLÈTES)

- Tiroir sorts → grille (posés) + GRIMOIRE. **`cast` disparaît comme slot** ; son
  `castBlockReason` (`:265-269`, #516) migre en `GatedAction` sur CHAQUE alvéole de sort.
  **Focaliser** (`battleFocusSpell`, `:514-527`) : action PAR SORT → affordance secondaire
  de l'alvéole du sort (appui long / clic droit, geste précisé au lot grimoire) ET rangée
  de la fiche-sort du grimoire. **Chip Vents de Magie** (`:479-488`) → l'arche
  (`ActiveFrame`, à côté de l'Avantage-conduit) pour les lanceurs, porteur déclaré.
- Tiroir dissipation → alvéole Dissiper + **nouveau `DISPEL_MODE`** au registre
  `targetingModes.ts` ; cible = le PORTEUR (clic token), puis si N sorts sur le porteur, le
  panneau-PARAMÈTRE naît de l'alvéole (choix du sort à dissiper = paramètre, borné) ; la
  **progression du Test étendu** (`prog/ni DR`, `:537`) s'affiche sur l'alvéole.
- Tiroir Avantage → alvéoles par Compétence (posées ; exhaustif : b2.15).
- Tiroir munitions → commutateur (lot munitions d'abord).
- Tiroir attaques → G1/G2 + grille (naturelles). Tiroir Détermination → alvéole + pastilles.
- `pickup-*` → pastille ⓘ (zone 4). `raise-hand` → frise. `mount`/`man-poste`/
  `push-engine` → pastilles sur l'ENTITÉ (zone 4, tranché) ; `dismount`/`leave-poste`/
  `maneuver-ship` → G6bis (état du héros).

---

## Zone 2 — LA FRISE : pause de Round jouable — volet RAW PRÊT

- Insertion par Chance à RANG LIBRE (#1332, verbatim LDB 17 l.21-27 re-vérifié par le
  juge) : interstices déposables ET focusables (la frise gagne `role="listbox"` + roving —
  elle n'a AUCUN role aujourd'hui, c'est un ajout d'a11y, pas une surface neuve).
  `roundStartPromote(heroId, rank)` — 2ᵉ argument TRANSPORTÉ PAR L'INTENT
  (`net/intents.ts:120`) ; la garde `combatSlice.ts:1656` (`order[0] → return`) SE LÈVE
  (retarder depuis la tête est un droit RAW).
- Coop : pendant le choix d'interstice, les autres clients voient l'état INCHANGÉ (le
  choix est local jusqu'au commit de l'intent) ; le ready-check existant reste la surface
  d'attente.
- Tir rapide : inchangé (armement frise → cible au champ → fenêtre de jet).

## Zone 3 — PASTILLES D'ÉTAT : remède sur la chip

Affordance DISTINCTE du clic Codex, surfaces de combat seulement, `GatedAction`, cible
tactile ≥ 44px (`pointer: coarse`). **RÈGLE NOUVELLE : une chip porteuse de REMÈDE n'entre
jamais dans le débord** — le tri de `summarizeEffects` place les États à remède AVANT le
`max=4` (sonde du juge : aujourd'hui `en-flammes` en 5ᵉ position cache « Se rouler »).
Sonde (iii) promue en test au lot.

## Zone 4 — LE CHAMP : intentions, portées, objets

- Gestes par défaut INCHANGÉS. Patron d'intention généralisé (modes `attaque`/`charge`/
  `course`, `chargeReach` pur, 3ᵉ `kind` de highlight, annulation Échap+re-clic).
- **Coop — le mode d'intention est LOCAL et a un PORTEUR NOMMÉ** : nouveau champ
  `localIntent` à la RACINE du store (HORS `battle`, hors allowlist d'intents, hors
  snapshot — `applyHostSnapshot` écrase `battle`, `src/state/netFlow.ts:140-142`) ; les
  overlays de portée lisent `localIntent` ; seul le COMMIT du geste part en intent. ⚠ Les
  POSTURES G5, elles, sont du JEU → `battle` + intent (zone 1a).
- **Pastilles d'ENTITÉ** (patron unique, tranché 2026-08-16) : objets au sol (ramasser),
  MONTURE (Monter), PIÈCE de siège/navire (Servir / Pousser l'engin) — le geste vit sur ce
  qui l'offre, adjacence évidente, coût de l'Action affiché + `GatedAction` ; N choix d'une
  même entité → panneau-paramètre né de la pastille (borné à CETTE entité).

## Zone 5 — LA FENÊTRE DE JET : inventaire STATUÉ (10/10)

| Option | Statut V2 |
|---|---|
| `attackSetLocation` / `attackSetWeapon` / `attackSetDualMode` (LDB 10 l.767-773) | RESTENT en modale |
| `attackSetIntoCrowd` / `attackSetHeldGround` | CONTRÔLE = G5 seul (verbatim §1) ; la modale AFFICHE posture + valeur, lecture seule |
| `attackSetHarpoonRopeCut` / `attackSetWithhold` / `attackSetGrapple` | RESTENT ; Empoignade aussi via G6 (même mécanisme de posture si hors-jet) |
| `attackSetCritLocation` (LDB 17 l.68) | RESTE (post-jet) |
| **`attackSetForcedRoll`** (`store.ts:1122`, LDB 17 l.68 — manquait à l'inventaire) | RESTE (pré-jet, réussite forcée) |
| Défense (mode/arme de parade/Porte-Bouclier/Détermination) | INCHANGÉS (pas de médaillons) |
| Incantation (9 options `CastModal`) | INCHANGÉES cette vague |
| Autres pendings (désengagement, au-contact, empoignade, monture, chute) | INCHANGÉS |

## Zone 6 — ÉCRAN DE CAPACITÉS (grimoire étendu) + RAIL D'OUTILS — PRÊT

Le grimoire devient l'ÉCRAN DES CAPACITÉS du personnage (tranché 2026-08-16) : sorts ET
manœuvres ET talents à activation, sections par famille (`ScreenShell` +
`MasterDetail`/`GroupedPickGrid` + `SearchFilterField`), il PLACE (glisser vers une case)
et LANCE (le ban ne vise que la barre), ferme après lancement. ⚠ ORDONNANCEMENT : se
livre DANS le même lot que la purge des tiroirs (b3.16) — jamais un lot entre les deux
sans surface exhaustive.

## Zone 7 — LES PHASES

✅ TRANCHÉ (2026-08-16) : l'interlude de ciblage (`ActionBar.tsx:234-245`) et la pause de
Round (`:139-164`) cessent de REMPLACER la barre — console en LECTURE (géométrie tenue,
cases inertes) + BANDEAU fin par-dessus portant le message de phase et sa sortie
(Terminer/Renoncer ; pause : le ready-check). Les deux sites se réécrivent au lot console.
Le reste : tour adverse/autre joueur/auto-combat = console en LECTURE (mêmes cases,
inertes) ; tour du NAVIRE = la console charge le contenu navire dans la MÊME géométrie
(6 ids mesurés : `maneuver-ship`, `battery`, `crew-test`, `sing-shanty`, `ship-reload`,
`end-turn` — `battery` reste un interlude) ; placement navire : clé `(partyKey, actorId)`
— `actorId` couvre héros ET navire (b3.19) ; combat fini = console retirée (transition).

## Zone 8 — LE CLAVIER

✅ TRANCHÉ (2026-08-16, RÉVISION EXPLICITE de l'arbitrage « touche par ID ») : **la touche
suit la CASE** (position apprise, état de l'art MMO — le joueur pose sa capacité sur
« sa » touche) : 1-8 = cases de la grille visible. Les HORS-CASE gardent leurs touches
dédiées existantes (`Space` = fin de tour…) ; le contrat « aucune action légale ne
disparaît » gagne un volet CLAVIER : toute action doit conserver AU MOINS un accès
clavier ou être atteignable au focus (remèdes de pastille, pickup, navire — roving).
Acquis hors arbitrage : table sans modificateur, badge = touche réelle, réfs
`LDB 10 → LDB 11 l.97-103` + `raw:implemente` (lot 1 réduit).

## Zone 9 — PERSISTANCE

`saveId` N'EXISTE PAS (sonde négative ; saves par SLOT 1-3, `SAVE_VERSION = 23` — la
mention « v12→v13 » de l'invariant était fausse). Clé retenue : **`(partyKey, actorId)`**
— `partyKey` = UUID posé à la création de partie DANS `data` (suit la save via le snapshot
zéro-maintenance de `saves.ts:4-8`, aucun bump) ; `heroId` actuel est un compteur de
module NON stable (`character.ts:409-411`) → le lot pose `partyKey` et documente la
limite des ids de pré-tirés (identiques entre parties : `pregen-${seed}` — acceptable car
scoping par `partyKey`). Barre personnelle au client en coop (hors snapshot).

## Zone 10 — MIGRATION (ordre CORRIGÉ, b3)

1. **Lot réfs** (ex-lot 1 réduit) : `LDB 10 → LDB 11 l.97-103` (`keybindings.ts:76,122`)
   + `raw:implemente`. Trivial, autonome.
2. **Lot munitions** (avancé, b3.20) : munition fixée au chargement (moteur + tests) —
   AVANT toute UI de barre.
3. **Lot console** (gros lot unique, b3.16-17) : travées + grille + coin + conduit +
   clavier (mapping livré AVEC les cases) + purge tiroirs + GRIMOIRE + placement/
   persistance (`partyKey`) + phases lecture/navire. Prérequis internes : matrice G6
   (b3.18), maquette 360px validée, arbitrages b2 tranchés.
4. **Lot intentions** : modes + `chargeReach` + 3ᵉ kind + annulation + `localIntent`.
5. **Lot pastilles + pickup ⓘ** (avec la règle anti-débord des remèdes).
6. **Lot frise jouable** (#1332).
7. **Solde** : réfs design 2026-07-31 migrées + suppression des docs plans, cliquets,
   recette d'ensemble (héros nu, tireur, mage 211 sorts, prêtre, monté, poste, naval,
   coop invité, 360px).

Gardes au fil des lots : contrat « aucune action légale ne disparaît » (DOM **et
CLAVIER**, par scénario — promotion de la sonde 2) ; garde de géométrie (comptes constants
par viewport, y compris pendant interlude/pause selon b2.14) ; garde anti-liste (panneau
borné au paramètre : munition, localisation, objets d'UNE pastille, sort à dissiper d'UN
porteur) ; les 3 sondes du juge promues en tests (co-occurrence G6, charge de grille,
débord des remèdes).

---

## Vague 2 — RETOUR VISUEL (validée par l'utilisateur le 2026-08-16, 5 éléments)

Grounding mesuré (lecteur du 2026-08-16, arbre `98d72164`) : la couture pure unique est
`HoverTargeting` (registre `TargetingMode.affordance` — même donnée que le clic, mensonge
impossible) ; `battle.preview` est la source unique du coût (aperçu/commit/IA) ;
`AimOverlay.tsx:97-140` est déjà l'infobulle pré-jet à 80 %. Les silhouettes d'occultés
sont DÉJÀ LIVRÉES (#1297 LOT C, WebGL) — hors vague.

Lots, dans l'ordre (chacun : recette + juge vision) :
1. **Réparer #1327** — les flottants typés (`FxLayer`/`useCombatFx`) sont câblés SEULEMENT
   dans `IsoStage.tsx:130,513` → muets en volumique alors qu'`ANIM_IMPACT` y est bien émis
   (`GameStage3D.tsx:1213`). Le volet « SFX muets » du ticket est INFIRMÉ (audio global,
   `main.tsx:33`) — commenté au ticket. Préalable de canal à toute la vague.
2. **Plaquette de conséquence** — extension des flottants typés existants (`FloatKind`) :
   réaction (parée/esquivée/encaissée) + localisation + Blessures en langage joueur
   (« ✓ Touché · Bras gauche · 5 Blessures ») sur le pion touché. Le journal garde
   l'historique, la fenêtre garde le choix.
3. **Infobulle-contrat enrichie** — `AimOverlay` + l'ATTAQUE GRATUITE ENCOURUE annoncée
   avant le geste (`freeAttackSourcesOf` pure, `triggeredEffects.ts:147` — zéro consommateur
   UI aujourd'hui) + palier de Difficulté nommé. Le sous-point RT « Réaction restante du
   défenseur » TOMBE : sans objet RAW (pas d'épuisement de réaction par Round chez WFRP ;
   seul `usedShieldReactionRound` existe, spécifique Porte-Bouclier).
4. **Curseur porteur du coût** — le coût du geste (Action/Mouvement/palier) au survol en
   permanence, lu de `battle.preview`/`previewResourceDelta` (`combatFlow.ts:1010-1026`) —
   aujourd'hui seulement au tap-1 (`TapPreview`, `MoveOverlays.tsx:57-87`).
5. **Prévision de zone par créature** — badge PAR cible affectée au placement d'un gabarit
   (jamais un total) : fonction « affectés par cette position candidate » À ÉCRIRE sur
   `zoneCovers`/`sceneZoneTiles` (`zones.ts:114-116`) — câblage, pas vocabulaire.

⚠ Canal : (3)(4) sont SVG-only SANS seam builder (composants React directs) — le canal
volumique exige soit un builder pur nouveau (patron `buildHighlights`/`tokenChromes`,
déjà bi-backend), soit un peintre monté par `GameStage3D` ; à articuler avec le GO/NO-GO
WebGL (#1160). La vague livre le SVG d'abord, le canal volumique passe par le lot 1 (#1327)
qui décide du patron.
