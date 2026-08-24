> ⚠️ **ARCHIVE (2026-07-05)** — document DATÉ : constat/plan d'époque, ne décrit PAS l'état courant du code.
> Conservé pour l'historique du raisonnement. Ne JAMAIS s'appuyer dessus pour juger l'architecture ou l'état actuel.

# Audit — sous-systèmes d'INTERACTION (entrée joueur, ciblage, modales)

*2026-06-29. Périmètre : ce qui a émergé du chantier « jouer au clavier/manette » — les couches par
lesquelles le joueur AGIT (clic/touche/manette → effet). Pas le moteur de règles (pur, à part).*

But : **répertorier les sous-systèmes qui fonctionnent DIFFÉREMMENT**, dire pourquoi ça diverge, et
où mutualiser. Légende : ✅ déjà bon · ⚠️ divergence/dette · 🔧 amélioration proposée.

---

## 1. Coquilles de modale & accessibilité

**État.** Tout converge in fine sur `Modal` (`useModalA11y`) :
- `RollFlowShell` — coquille de jet MONO (Lancer→Chance→Pacte→Résilience→Appliquer) ; sert aussi les
  étapes `jet`/`choix`/`affichage` de la cascade.
- `MultiRollShell` — N participants (ForceDoor, ShipManeuver, ShipBattery).
- Bespoke (rendent leur propre contenu mais via `<Modal>`) : Cast, Disengage, Grapple, AuContact, Medic, Rest, Loot, Reveal.
- `CascadeModal` — ORCHESTRATEUR : choisit quelle étape rendre (attack/defense/fumble/test/extended/disengage/forceDoor/cast + choix/affichage).
- Registre `modalArbiter` (24 entrées `pending*`) = quelle modale est active + politique d'auto-cadence.

⚠️ **La divergence (réglée cette session)** : le contrat clavier de `useModalA11y` ne connaissait que
« 1 bouton primaire `.modal-actions .btn-primary` ». Les **grilles d'options** (`.rm-loc-grid` :
Dévier/Subir) et **toggles segmentés** (`.seg` : Parade/Esquive) vivaient HORS de ce contrat → blocage
dur au clavier. Corrigé : focus géré + Entrée=contrôle focalisé + flèches.

🔧 **À garder comme INVARIANT** : ajouter un **test de garde** « toute modale a un focus-default
sensé + Entrée active quelque chose + Échap (si annulable) » — sinon « global » redeviendra « sur le
papier » au prochain bespoke. (cf. le garde-fou `i18n-narration-guard` comme modèle.)

---

## 2. Routeur de clic-carte & « modes de combat »

**État.** `battleClickEntity`/`battleClickTile` branchent sur un état diffus :
`battle.action` (`null` neutre / `cast` / `heal` / `battery` / `teleport`) **+** `pendingCast.pickingTargets`
(surincantation) **+** `placingZoneOf` **+** `pendingCleave`/`pendingDualStrike`. Chaque mode a SA branche.

⚠️ **Divergences** :
- **Le soin ne passe PAS par le routeur** : il se cible par un **panneau de portraits** dans l'ActionBar
  (`heal(id, mode)`), pas par le clic-carte. → ni souris ni curseur sur la carte ne soignent.
- `battle.action` est une **string ad hoc** (pas un type fermé partagé) ; les modes sont dispersés
  entre `action`, des `pending*` et des prédicats (`placingZoneOf`).

✅ **RÉGLÉ (2026-06-29)** : le **registre de MODES DE CIBLAGE** (`src/state/targetingModes.ts`) est
livré. Un objet par mode (`affordance`/`candidates`/`commitCombatant`/`tileValidAt`/`commitTile`) ;
l'aiguilleur unique `currentTargetingMode(get)` extrait les priorités exactes
(`pendingCleave > pendingDualStrike > pendingCast.pickingTargets > placingZoneOf > action ∈
{cast,heal,battery,teleport} > attack`). Les 5 consommateurs DÉRIVENT du registre : `hoverTargeting`/
`validTargets` (targeting.ts), `combatantClickActs` (combatOrParty.ts), `battleClickEntity`/`Tile` +
le curseur (combatSlice.ts), et la couche d'anneaux d'`IsoStage`. `battle.action` (string) reste l'état
sous-jacent — on n'en DÉRIVE que le mode. Effet voulu : **soin + surincantation** ciblables au
curseur/Tab/réticule comme le reste, et le réticule est uniforme (plus de branche dupliquée dans
`IsoStage.hoverAim`).

---

## 3. Ciblage au survol / réticule (`hoverTargeting` + curseur)

**État.** `hoverTargeting` (source unique réticule + `validTargets` du Tab + aperçu) couvre
**attack / cast / battery**. ✅ Le curseur clavier/manette (flèches + Tab + Entrée) s'y branche.

⚠️ **Divergences** : `hoverTargeting` **ne connaît pas** le **soin** (allié) ni la **surincantation**
(candidats `overcastTargetCandidates`) — ceux-ci sont gérés à part (panneau ActionBar ; branche spéciale
dans `IsoStage.hoverAim`). Donc Tab/réticule/curseur ne couvrent pas tous les modes → l'incohérence
ressentie « le soin n'est pas au clavier ».

✅ **RÉGLÉ (2026-06-29)** — conséquence directe de #2 : `hoverTargeting`/`validTargets` lisent le
registre, donc curseur+Tab+réticule sont désormais **uniformes** pour TOUT ce qui se cible sur la carte
(soin et surincantation compris). `IsoStage.hoverAim` ne contient plus de logique de cibles dupliquée.

---

## 4. Entrée clavier / manette

**État.** ✅ Bien unifié POUR LE COMBAT : registre `KEYBINDINGS` (remappable, `event.code`), `useGamepad`
qui dispatche les MÊMES ids (`runBindingById`), `useModalA11y` pour les modales, `hotbarBridge` pour les
capacités. Un seul vocabulaire.

⚠️ **Divergence** : ne couvre **que le combat**. **Exploration** (déplacement souris-only), **choix de
dialogue** (souris-only), **menu ☰** (Échap ne ferme pas) sont hors du registre → impossible de jouer
SANS souris hors combat.

🔧 (= « Lot 2 ») : étendre le registre + un curseur d'exploration (réutiliser `nextCursorTile`), une nav
clavier des choix de dialogue, et router `Échap` vers la fermeture du menu. Mécanique déjà en place
(le registre `when`/`run`), il « suffit » d'ajouter les contextes.

---

## 5. Résolution de jet (deux systèmes coexistants)

**État.** ✅ La FABRIQUE `makeRollFlow` (specs `rollFlows`) unifie un jet = 1 spec + 1 `xConfirm`.
**Mais** deux porteurs coexistent : les **`pending*` MONO** (attack/defense via cascade, heal, run, focus…)
et la **`pendingCascade` SÉQUENTIELLE** (jets de nuit/voyage + cascade de combat). Plus la **cadence/auto**
(`combatAuto`) qui auto-résout selon des politiques par modale (`modalArbiter.auto`).

⚠️ Frontière subtile (cf. soft-lock de la charge montée corrigé cette session) : un jet qui échoue/“null”
doit TOUJOURS faire avancer/fermer sa cascade — sinon orphelin. Le filet `advanceCombatJet` a été ajouté,
mais c'est le genre d'invariant facile à re-casser.

🔧 Pas de refonte nécessaire ; **documenter l'invariant** « toute ouverture de cascade a une sortie
garantie » + un test. (Bonne base déjà : `cascade.test.ts`, `combatAuto`.)

---

## 6. Barre d'action & sous-panneaux

**État.** ✅ barre data-driven : la console publie ses cases PAR ADRESSE au pont `hotbar`
(`hotbar.capacites[]`, un rang par position) — les touches 1-8 et la manette lisent ce pont.
⚠️ Mais les **sous-panneaux** (sorts, munitions, attaques ▾, **soin**, détermination) rendent chacun
leur propre markup de boutons, et le **soin** y vit comme panneau (cf. #2). Plusieurs micro-structures.

🔧 Mineur : harmoniser les sous-panneaux sur une primitive de liste-de-choix (proche d'`OptionChooser`),
pour qu'ils héritent gratuitement de la nav clavier/manette comme le reste.

---

## Synthèse — où est le vrai levier

| Thème | Effort | Impact |
|---|---|---|
| ~~**A. Registre de modes de ciblage** (#2+#3)~~ ✅ **LIVRÉ** — `targetingModes.ts` : UN modèle pour attaque/cast/soin/surincantation/zone/téléport | — | **Fait** (cohérence carte + curseur + réticule + souris) |
| **B. Entrée hors-combat** (#4) — exploration/dialogue/menu au clavier | Moyen | Fort (clôt « tout au clavier ») |
| **C. Invariants de garde** (#1 a11y modale, #5 cascade-sortie) — tests qui empêchent la régression | Faible | Fort (empêche que « global » redevienne « sur le papier ») |
| D. Harmonisation sous-panneaux (#6) | Faible | Moyen |

**Lecture** : la plupart des « sous-systèmes qui marchent différemment » que tu ressens viennent de **#2**
(le ciblage carte n'a pas de modèle unique : attaque/cast par `hoverTargeting`, soin par panneau,
surincantation par `pickingTargets`, zone par `placingZoneOf`). Un **registre de modes de ciblage** les
réconcilie — et le « Lot 1 » (soin/surincantation au curseur) en serait le premier client au lieu d'un
énième patch par-mode.
