# Dette technique, réductions de fidélité & lacunes de jouabilité/éditabilité

> Document VIVANT — registre unique et durable de ce qui n'est PAS conforme à notre standard
> (« suivre le RAW à 100 % **et** rendre tout scénarisable dans l'éditeur »). Tenu à jour au fil des
> corrections. Avant de déclarer un système « fini », vérifier qu'il n'a pas d'entrée ouverte ici.
>
> Deux axes :
> - **A. Réductions de fidélité** — systèmes IMPLÉMENTÉS mais SIMPLIFIÉS vs le livre (le moteur ne suit
>   pas le RAW à 100 %).
> - **B. Lacunes jouabilité/éditabilité** — systèmes qui n'ont pas de scénario jouable au menu ET/OU ne
>   sont pas authorables depuis l'éditeur (issus de l'audit transversal des 75 systèmes).
>
> Le code lui-même ne porte AUCUN marqueur `TODO`/`FIXME` : tout ce qui est connu comme incomplet est ICI.

## Statut de conformité (référence rapide)

- Backlog GitHub d'audit de conformité : **39/39 issues fermées** (juillet 2026).
- Chantiers de fiabilisation post-backlog : combat de masse #69 (fidélité + éditabilité), combat naval
  (abordage), audit jouabilité/éditabilité — cf. sections ci-dessous.

---

## A. Réductions de fidélité (implémenté mais simplifié vs RAW)

Chaque entrée : la règle RAW non entièrement suivie, ce qui est fait, ce qui manque pour être fidèle.

### Combat de masse (#69, ADE II ch.8)
- **« Tenez votre position »** : le sous-système Point-de-rupture / bonus cumulatif +10 n'est pas
  modélisé (résolu en simple Test enemy −2/hold).
- **« Percée »** : modélisée en Scène `test` et non `combat` (pour rendre la branche échec→Charge
  atteignable).
- **Duel** : pas de branche « le champion ALLIÉ perd → allié −20 » (une défaite tactique = écran de
  défaite, hors périmètre du flux de bataille).
- **Activités de bataille** : les Tests combinés (l.79-110) sont réduits à leur compétence primaire.
- **Aléa de bataille** : appliqué en narratif (option RAW l.309), pas mécanisé.
- **Coût / Horreurs de la guerre** (options ADE II) : non modélisés.

### Système alternatif Aux Armes — Blessures & Critiques (#38, sous toggle `combat-aa-blessures`)
- **Variante +10/Blessure globale** d'Aux Armes : laissée hors périmètre (seules les tables de
  Critiques AA par localisation + la règle d'Inconscient-à-0-PB sont câblées).

### Avantage de groupe Aux Armes (#39, sous toggle `combat-aa-avantage-groupe`)
- **Dépenses d'Avantage en mode groupe** : les manœuvres de créature (Regard pétrifiant, souffle…),
  le Désengagement-sacrifice et la Retraite stratégique / Porte-bouclier AA mutent la projection
  `.advantage` mais ne DÉDUISENT pas de la réserve de camp (restaurée au prochain sync).
- **Empoignade opposée** (`resolveGrappleOpposed`) : le +1 du vainqueur reste par-combattant, non
  durablement crédité à la réserve.
- **Op `grantAdvantage` hors début de tour** (un sort octroyant de l'Avantage) : réconciliée à la
  réserve seulement au turn-start (Redoutable) ; ailleurs = edge non réconcilié.
- **Table d'Avantage initial** : auto-dérive Surnombre + Surprise ; Menace / Manœuvrabilité / Terrain
  attendent une entrée d'éditeur (la fonction les supporte, testée).
- **Talents en mode groupe** : *Cavalier émérite* (le moteur ne décompose pas la Peur par cause →
  Taille-vs-Peur non appliquée) ; *Battement / Distraire / Impitoyable* = `descAA` seul (manœuvres non
  modélisées dans les DEUX modes).

### Économie (#57)
- **Recherche active de Disponibilité « journée entière + Ragot »** (LDB 59 l.50) : le bonus est
  exposé au moteur mais non auto-déclenché (pas de sous-système « passer la journée aux marchés »).

### Commerce de cargaison terrestre T2C (#58)
- **Rumeur commerciale cross-Lieu** : adaptée au Lieu courant ; la version « ce bien se vend le double
  à tel AUTRE port » (index géographique du Reikland) reste une feature de scénario future (nécessite
  un index géographique mappé à la carte + un board de rumeurs persistant).

### Naval (MDG)
- **Artilleur haut-elfe** : la substitution de compétence par espèce (MDG 09) n'a aucun siège moteur
  (les carrières sont sans dimension d'espèce) → règle laissée verbatim dans le `desc` de la carrière.
- **Baliste portée 100 (MDG) vs 150 (AA)** : collision de variante entre livres, différée au dossier
  « collisions entre livres » (décision projet).
- **Désertion à la relâche** (`desertionRoll`) : équipage PNJ abstrait tenu par les PJ (MDG 14 l.39) →
  pas de cible applicable en l'état.

### Divers
- **Faxtoryll** : l'effet `preventInfection` (hors-RAW) a été RETIRÉ (LDB 72 l.22 ne le mentionne pas).
- **Filets ZI** (États, #41) : la section « Filets » du .md ZI est OCR-inexploitable → l'entrave
  aléatoire générique (`escapeStrength` 1d10×5) est prête à les porter dès décodage de la source.

---

## B. Lacunes jouabilité / éditabilité (audit transversal — 40 trous / 75 systèmes)

Source : audit adversarial par domaine (juillet 2026). Statut = jouable (scénario au menu) × éditable
(Effet + édition, ou champ de carte, ou donnée Codex).

### 🔴 Ni jouable ni éditable

| Système | Domaine | Ce qu'il manque |
|---|---|---|
| Commerce terrestre T2C (`MapPlace.market`) | Économie | Accès au commerce (Effet/action) + section « Marché » dans WorldMapEditor + scénario. Moteur `landCargo.ts` FAIT. **Mutualiser avec « Marchés terrestres » (même trou).** |
| Poursuites terrestres (`pursuit`) | Voyage | Flux de poursuite dans `travelFlow` (UI, sur le modèle `seaVoyageFlow`) + scénario + Effet `startPursuit`. `pursuit.ts` FAIT. |
| Jeux de taverne | Économie | Effet `openTavernGames` + scénario + activer la règle `tavern-games`. Moteur (`tavernGame.ts`/`tavernFlow.ts`) FAIT. |
| Troc (objet ↔ objet) | Économie | Brancher l'UI de troc au panneau marchand (action store `barterExchange` déjà là) + scénario. |
| Suffocation (Souffle) | Santé | Effet `inflictSuffocation` + scénario (souterrain noyé/forge). `suffocation.ts` FAIT. |
| Ivresse & alcool | Santé | Effet `intoxicate`/`inflictDrunkenness` + scénario (taverne). `drunkenness.ts` FAIT. |
| Trauma psy. (`ambitionLost`) | Santé | Champs d'édition dans `EffectList.tsx` + trigger de scénario. **Handler déjà présent.** |
| Escalade hors-combat | Voyage | Trancher : « Test de compétence normal » (doc) OU Effet `climbTest`/`extendedTest` + scénario. |
| Création de personnage | Progression | Effet `startCharacterCreator` (ouvre l'assistant en jeu) + scénario. `CharacterCreator.tsx` existe. |
| Avancement / changement de carrière | Progression | Effet `partyAction`/`changeCareer` ouvrant l'écran avancement + scénario fin de chapitre. Actions `partyFlow.ts` FAITES. |
| Fin de séance (PX Ambition/Détermination) | Progression | Effet `sessionEnd` (= `heroSessionXp` + `regainDetermination`) + scénario de bilan. `session.ts` FAIT (aujourd'hui : entrée GameMenu hors éditeur). |
| Roster persistant | Progression | Discutable (save auto marche). Vrai manque = Effets d'auteur `addHero`/`removeHero`/`swapHero`. |

### 🟠 Jouable mais pas éditable par l'auteur

| Système | Domaine | Ce qu'il manque |
|---|---|---|
| Ports maritimes (`PortProfile`) | Voyage | Section « Port » dans WorldMapEditor (taille/richesse/production/`lighthouse`/…). |
| Voyage maritime (route `sea`) | Voyage | WorldMapEditor : checkbox `sea` + select `seaHeading`. |
| Navire de campagne (`vessel`) | Voyage | Panneau UI `vessel` (véhicule/morale/coque/eau) + Effet `setVessel`. |
| Postes d'équipage (`shipRole`) | Voyage | `ScenarioShipRolesPanel` (analogue `TravelRolesPanel`). |
| Disponibilité (LDB 59/60) | Économie | Exposer `market-guild`/`market-mode`/`market-tenir-comptes` comme champs du marchand. |
| Marchandage / Évaluation / Réparation | Économie | Exposer en flags de l'entité marchand (déjà jouables via `openMerchant`). |
| Commerce maritime/port | Économie | Effet `openPort` pour SCRIPTER l'accès (aujourd'hui auto à l'accostage). |
| Exposition Froid/Chaleur | Santé | Effet `exposureNight` (severity/kind). `exposure.ts` FAIT. |
| Faim & Soif (provisions) | Santé | Effet `inflictHunger`. `provisions.ts` FAIT. |
| Repas (`mealParty`) | Santé | Champs d'édition optionnels dans `EffectList`. |
| Psychologie combat (Peur/Terreur/Frénésie) | Combat | Quasi-OK par design (hooks auto + Traits/États du Codex). Option : Effet `inflictPsychology` (source de peur scénique). |
| Engagement/Désengagement, Empoignade | Combat | **OK par design** — actions de combat (choix modal). À DOCUMENTER, pas à coder. |

### 🟡 Éditable/auto mais aucun scénario ne l'exerce (moteur déjà fait & testé en Vitest)

| Système | Domaine | Ce qu'il manque |
|---|---|---|
| Imparfaites (miscast) | Magie | Scénario `magie-imparfaites` (caster à compétence basse → tables d100 en jeu). |
| Contre-sort / Dissipation | Magie | Scénario `magie-counterspell` (IA caster paramétrée pour riposter). |
| Surincantation (Overcast) | Magie | Scénario `magie-overcast` (ressource forçant le choix). |
| Colère des dieux | Magie | Scénario `religion-colere` (Prêtre +3 Péchés, prière forcée + dé des unités ≤ 3 garanti). |
| Magie des Mers (Manann/Stromfels) | Magie | Prêtre de Manann embarqué dans `14-voyage-maritime.ts`. Données présentes (14 sorts). |
| Petites Prières (`petitePriere`) | Magie | Scénario `religion-petites-prieres`. Effet DÉJÀ éditable. |
| Retrait de Péché (`sinMod`) | Magie | Contenu : Miracle « Absolution » (LDB 42) OU scénario `religion-absolution`. Op DÉJÀ là. |
| Critiques & Traumatismes (`inflictTrauma`) | Santé | Trigger `inflictTrauma` dans un scénario (ex. `opera.ts`). Éditeur DÉJÀ là. |
| Soins & infirmerie (`medicalAid`) | Santé | Effet `medicalAid` dans un scénario (médecin). Éditeur DÉJÀ là. |
| Exposition hydrique (`waterExposure`) | Santé | Scénario naval/port fluvial l'exerçant. Effet DÉJÀ éditable. |
| Chute hors-combat (`fall`) | Voyage | Scénario (trappe/balcon effondré → `fall`). Effet DÉJÀ là. |
| Activités d'Altdorf | Progression | Scénario `altdorf-interlude` (groupe à Altdorf, interlude → activités taguées `altdorf`). |

### Priorisation recommandée (issue de l'audit)
1. **Vague 1 (max de couverture / min de code)** : les scénarios magie-religion + les triggers santé —
   tous petits, moteur déjà testé, transforme ~11 systèmes « non-jouables » en « jouables » et prouve la
   conformité RAW EN JEU.
2. **Vague 2 (éditabilité à bas coût)** : Effets `inflictHunger`/`exposureNight`/`intoxicate`/
   `inflictSuffocation` + champs WorldMapEditor (`sea`/`seaHeading`, Port) + `vessel`/`shipRole`/`openPort`.
3. **Vague 3 (chantiers lourds, moteur partiel)** : Commerce terrestre T2C + Marchés (mutualisés),
   Poursuites terrestres, Jeux de taverne, Troc.
4. **Vague 4 (décision de design)** : méta-flux Création / Avancement / Fin de séance — les scripter
   in-game (Effet ouvrant l'écran existant) ou les laisser hors-scénario.
5. **Ne pas coder** : Engagement/Empoignade/Psychologie (design OK — documenter), Roster (save auto).

### Réserves de fiabilité de l'audit lui-même
- Verdicts « magie OK » adossés à un seul scénario (`magie.ts`) — couverture en LARGEUR plus faible que
  le « OK » ne le suggère.
- Critère à deux vitesses sur le déclenchement RNG : *Mutations* jugé OK (corruption proche du seuil)
  mais *Colère des dieux* recalé en SCÉNARIO-MANQUANT sur le même argument → uniformiser vers un
  scénario GARANTI dans les deux cas.
- Pas d'Effet `castSpell`/`forceCast` : on ne peut pas SCRIPTER un lancer de sort depuis un
  dialogue/trigger (éditable comme donnée/PNJ seulement) — décision de design à trancher.
