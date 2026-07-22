---
name: game-rig-zones-equipables-nu-espece
description: Modèle rig — CHAQUE zone du corps est une localité ÉQUIPABLE ; le repli = le Nu de l'ESPÈCE (lisse/griffu mains+pieds), jamais un vêtement. footStyle='boot' supprimé (botte = habit). Chantier #736 MERGÉ sur main (7b51eaa6).
metadata:
  type: project
---

**Principe gouvernant (arbitrage user 2026-07-22, verbatim)** : « Chaque zone du corps appartient à
une localité équipable. » + « le système de repli c'est Nu » + « qu'est-ce qui fait qu'une créature a
des griffes aux mains ». → Modèle du rig : toute zone habillable résout par la MÊME chaîne
`override → armure(zone) → tenue(zone) → NU DE L'ESPÈCE(zone)`. Aucune zone « part système recolorée ».

**Ce que ça corrigeait :** `pied`/`main`/`cou` étaient des parts SYSTÈME hors chaîne
(`out.pied=P(footStyle…)`, `out.main=P(HAND)`, `out.cou=P(NECK)`) — l'équipement ne pouvait pas les
piloter en FORME, seulement recolorer. Et `footStyle='boot'` faisait entrer un VÊTEMENT dans le repli
(non-sens : une botte se PORTE). Le trou griffu : monstres à main = poing humain `HAND`, jamais griffue.

**Décisions (livrées) :**
1. **repli = Nu de l'ESPÈCE**, chair nue, jamais un habit. Botte/gant/gorgerin = HABIT
   (`tenue.pied/main/cou`) ou ARMURE (soleret/gantelet/gorgerin), peints par-dessus.
2. **La griffe est de l'ANATOMIE (l'espèce)** : canal `extremites: 'lisses'|'griffues'` sur
   `raceAppearance.json` (+ override `perso.extremites`) → une déclaration griffe mains ET pieds. Art de
   chair dans `parts/bodies/extremites.ts` (`PIED_NU={lisses:PLAINFOOT, griffues:CLAWFOOT}`,
   `MAIN_NUE={lisses:HAND, griffues:MAIN_GRIFFUE}`, `COU_NU=NECK`).
3. **`footStyle='boot'` SUPPRIMÉ** ; « déchaussé » = `tenue.pied == null`. Botte = habit partagé
   `parts/tenues/botte-gabarit.ts#BOTTE_CUIR`.
4. `cou` = SURCOUCHE : `NECK` toujours peint dessous (cou garanti #633 P2) + gagnant par-dessus.
5. `coversSlot` complet : pied→jambeG/D, main→brasG/D, cou→corps (visuel + PA DÉRIVÉ, AUCUNE nouvelle
   HitLocation moteur ; les 6 locs `engine/types.ts` inchangées).

**Localités du jeu (HitLocation, LDB p.159, `data/localisation.json`)** : 6 — tête/brasG/brasD/corps/
jambeG/jambeD. Une HitLocation couvre PLUSIEURS slots de rig (brasG → bras+avantBras+main ; jambeG →
jambes+pied ; corps → torse+cou). Le cou n'a AUCUNE HitLocation propre → gorgerin rattaché à `corps`.

**CHANTIER #736 COMPLET (4 lots, branche de chantier) :**
- **Lot 0 `ecff6001`** : plomberie iso-rendu — `pied/main/cou` pilotables (`TenueSet`+`ArmourSet`),
  résolution uniforme (`equipWinner`), `coversSlot` complet, art déménagé dans `extremites.ts`, `cou`
  surcouche, garde `extremites-resolution.test.ts`. Bit-identique.
- **Lot 1 `35f0962c`** (138 fichiers) : bascule atomique — footStyle/bareFoot/TENUE_FOOT_STYLE/
  TENUE_BAREFOOT SUPPRIMÉS ; 100 defs `pied: BOTTE_CUIR`, 9 nu-pieds ; repli pied = `PIED_NU[extremites]` ;
  griffes préservées (races griffues Démon/Skaven/Squelette + perso Chamane-Brey/Géant/Liche +
  **Mournbreath/Whiptongue** rattrapés par le JUGE ADVERSARIAL) ; garde de classe `creature-extremites-griffues`.
- **Lot 2 `051371ed`** : griffes DATA-GROUNDED — 10 créatures marquées `griffues` (chacune avec indice
  cité : GRIFFES_ART / `monster.griffes` / arme « Griffes »). ⚠ **Goule/Troll/Minotaure EXCLUS** : AUCUN
  indice de griffe dans leur donnée → non marqués (credo, réfutation de ma prémisse). Si on les veut
  griffus → **fix de STATBLOCK** (ajouter l'arme), pas un marquage rig.
- **Lot 3 `9ac513d3`** : ART + câblage — `MAIN_GRIFFUE` (main griffue d'espèce) + `Plaque.set.pied/main/cou`
  (soleret/gantelet/gorgerin) ; repli main = `MAIN_NUE[extremites]` ; **13 doublons de griffe purgés**
  (2 chemins : `features:GRIFFES_ART` ×7 + `monster.griffes:true`→monsterInjection ×6 ; Fantome gardé).
  Art VALIDÉ à l'œil par l'utilisateur (ma lecture d'image bloquée). **Équiper de la plaque → solerets +
  gantelets + gorgerin visibles** (question initiale résolue).

**⚠ PIÈGE ENV (bloqua le commit Lot 1, à retenir)** : `core.hooksPath` = arbre PRINCIPAL → committer dans
un WORKTREE fait valider `main` par le pre-commit (`ROOT` du hook = chemin du script = principal).
`raw:implemente --check`/`docs:check` portent sur `main`, PAS le worktree. Symptôme : `--check` worktree =
OK, hook git échoue « N fiches périmées » (de `main`). Fix : `npm run raw:implemente` dans `Game/`.
Vécu : 4 fiches `main` (combat/destin/etats/traumatisme, sans rapport rig) bloquaient le commit worktree.

**⚠ Lecture d'image (Read/ctx image) DENY récurrent cette session** (worktree ET agents juges) → validation
de goût de l'art par l'UTILISATEUR via `SendUserFile` ; restaurer = redémarrage de session.

**Pièges QC restants** : silhouettes dérivées de jambe cuisent le fût de botte en `@cuir` ; halflings
(Chevaucheur/Gardechamps) pleinement nu-pieds ; tenues PARTIELLES → jambes nues (voulu) ; prothèses/blessures
remplacent pied/main APRÈS la chaîne ; membre supérieur reste en UNITÉ (`resolveUpperLimb`, #633 D1).

**PORTE DE MERGE FRANCHIE 2026-07-22 (`7b51eaa6`, ff 17 commits)** : rebase ×2 sur main mouvant (0 conflit),
goldens régénérés (2106 snapshots), et le JUGE VISION (vue restaurée) a RÉFUTÉ la 1re passe : **défaut de
CLASSE — le front de `set.jambes` des 4 ARMURES s'arrêtait à y44-47.5** (profile/back 49, cheville 50) →
bande de fond entre jambière et soleret (l'armure REMPLACE la part, pas de chair dessous). Fix artiste
(4 défs, bas à y47-49.5) + garde `armour-jambes-reach.test.ts` (maxY front ≥ 48, |front−profile| ≤ 2, test
de morsure). Suite ENTIÈRE verte sur main : 1001 fichiers / 12 848 tests. Leçon : un « validé à l'œil »
sur PNG plein pied rate un trou de 9px — le juge vision au PIXEL est l'instrument, pas le survol.
**« Manchettes » du sanguinaire élucidées** : SABOT de patte caprine (`monster/defs/chevre.ts`, race Démon
`legs:"chevre"`) — anatomie légitime ; MAIS peinte en `@cuir` (token de tenue) → la tenue REPEINT le corps
(nu `#5a3f24` défaut vs habillé `#4a3424`) = flanc doctrine tiqueté **#769** (jumeau du flanc `cheveux*` #629).

**Post-merge (`23ba6245`)** : régression attrapée par recette+juge vision — l'armure SYNTHÉTISÉE
du trait Armure chaussait des solerets par-dessus les griffes (les overlays purgés au Lot 3
masquaient le cas) → `ItemInstance.synthetic` + garde `coversSlot` (jamais pied/main/cou), garde
`armour-jambes-reach` (front ≥ 48) après le défaut de classe des 4 jambières courtes. Arbitrage
user dans la foulée : [[game-pa-statblock-apparence-opt-in]] (#774).

Lié : [[game-rig-3vues-contrat-prod-chantier]] (chantier rig prod parent),
[[game-doctrine-une-tenue-nhabille-pas-le-porteur]] (chair = porteur/espèce), #736/#722/#736 (pieds art),
#759 (migration jambe `jambeVetue`, à coordonner — `jambes` ≠ `pied`).
