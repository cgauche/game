# Conception — Seam de jet unique (#275, programme #276)

> **Artefact DATÉ** (`docs/plans/`) — hors périmètre de `docs:check` (scan non récursif de `docs/*.md`, `check-doc-refs.mjs:50`). À supprimer une fois #275/#274 exécutés. Le code fait foi ; ce doc ORDONNE l'exécution.
> Date : 2026-07-10 · Architecte du seam. Cadre imposé : arbitrages user verbatim #275/#274, programme structurel Phase 0 (Lot 6, V18).

## Résumé de conception (≤ 10 lignes)
1. **Le seam n'est pas un nouveau système** : il est l'EXTENSION en exclusivité de `makeRollFlow`/`FLOWS` (`rollFlowFactory.ts:319`, `rollFlowSpecs.ts:343`) + `cascade.ts` + les prédicats de `netOwnership.ts`. Rien de parallèle.
2. **Porte déclarative unique** `openRoll(get, set, req, kind)` : le call-site DÉCRIT `{côté, test, difficulté, klass, aggregate}` + une continuation-par-`kind` (applier enregistré, coop-safe) ; il ne choisit JAMAIS le surfaçage.
3. **La porte résout la policy `klass × contrôleur × cadence`** via les prédicats EXISTANTS (`humanControlled`/`pilotedByHuman`/`aiDriven`/`cadenceAuto`/`seaAutoResolves`) → modale influençable / visible-lançable MJ / inline-PV.
4. **`TestOutcome` scellé** (classe `private constructor` + brand, `engine/testOutcome.ts`) : un littéral `{won, sl}` ne compile plus ; `.seal()` n'est importable que par la whitelist du seam (base de la garde #274).
5. **Le multi (porte/contresort/équipage) est UNE famille** (`spec.multi`) ; seule l'AGRÉGATION (`best`/`opposed`/`summed-dr`) est un paramètre de spec — jamais un cas spécial mer.
6. **La FSM `runSeaDays` est REMPLACÉE** par `CascadeStep[]` (extension `CascadeStep.participants?`) + appliers enregistrés par `kind` ; les 4 sites inline (#271/#272) passent par la porte.
7. **Ordre** : Ronde 0 (seam + `TestOutcome` scellé) → 1 (#271/#272 via la porte) → 2 (remplacement FSM, coordonné #280 applyOps) → 3 (#273 policy de classe) → 4 (#274 garde, EN DERNIER).
8. **Combat = déjà canonique** (specs `FLOWS` surfacées en étapes `jet` par l'arbitre + `JET_AUTO`) → hors périmètre du chantier.

---

## Décision 1 — L'API exacte de la porte + son point d'ancrage

**Décision.** Une seule fonction, `openRoll`, co-localisée avec la fabrique dans un nouveau `src/state/rollSeam.ts` (le seam est l'orchestrateur ; il n'invente pas de pending — il réutilise `FLOWS.test`/`FLOWS.crewTest` comme specs de résolution et `cascade` comme séquenceur). *Justification : point d'ancrage = la fabrique elle-même, pas un parallèle (`makeRollFlow` rollFlowFactory.ts:319, `FLOWS` rollFlowSpecs.ts:343).*

```ts
// src/state/rollSeam.ts  (le SEAM — extension de la fabrique, jamais un parallèle)
import type { TestOutcome } from '../engine/testOutcome';

/** Les 4 classes déclaratives (mandat #275). Elles pilotent la POLICY, jamais le call-site. */
export type RollClass = 'hero-test' | 'enemy' | 'subi' | 'batch';

/** Agrégation d'un jet multi (porte/contresort/équipage) — SEULE variation de la famille multi (F4). */
export type RollAggregate = 'best' | 'opposed' | 'summed-dr';

/** DESCRIPTION déclarative d'un jet. Le call-site remplit ceci et RIEN d'autre. */
export interface RollRequest {
  /** Le côté qui teste : un acteur (héros/PNJ), le siège MONDE (ennemi/subi), ou des participants (batch). */
  side:
    | { actorId: string }                                   // hero-test / enemy / subi porté par un acteur
    | { worldSide: 'enemy' | 'ship'; shipId?: string }      // subi de bord / ennemi sans combattant
    | { participants: import('./pendings').ShipManeuverParticipant[]; shipId: string }; // batch équipage
  /** Le TEST déclaré (réf structurée — passe telle quelle à `testValue`/`FLOWS.test`). */
  test: { skill?: string; char?: import('../engine/types').CharKey; spec?: string;
          sense?: import('../engine/ops').PairedSense; menace?: string; label: string };
  difficulty: import('../engine/types').Difficulty;
  klass: RollClass;
  /** Requis pour un `batch`/multi ; défaut `summed-dr` (Test d'équipage). */
  aggregate?: RollAggregate;
}

/**
 * LA PORTE UNIQUE. Résout policy(klass × contrôleur × cadence) → modale influençable /
 * visible-lançable MJ / inline-PV, puis :
 *  - surface (cascade step) : la CONTINUATION est l'applier `kind` (lu à l'« Appliquer ») ;
 *  - inline/PV : résout via la MÊME spec (`runCascadeImmediate`-mirror) et appelle l'applier `kind` d'office.
 * `meta` = paramètres SÉRIALISABLES de la conséquence (jamais de closure — coop, cf. `CascadeStepMeta`).
 * Ne renvoie rien : le call-site est un one-liner déclaratif + son applier enregistré (économie #275.3).
 */
export function openRoll(
  get: import('./flowTypes').Get, set: import('./flowTypes').Set,
  req: RollRequest, kind: string, meta?: import('./pendings').CascadeStepMeta,
): void;
```

**Continuation = applier par `kind`, pas une closure.** *Justification : le pending est snapshoté/transmis en coop (`cascade.ts:9`, `CascadeStepMeta` pendings.ts:1084) → la suite doit vivre dans le registre `cascadeAppliers`, keyée par `kind`, lue depuis `step.meta`.* Le call-site enregistre sa conséquence une fois (`registerCascadeApplier(kind, applier)`, cascade.ts:57) et la porte pose l'étape avec ce `kind`. La continuation reçoit le `TestOutcome` scellé (reconstruit depuis `step.result`) — même chemin `commitStep`→`cascadeAppliers[kind].apply` qu'aujourd'hui (cascade.ts:110).

**Ancrage concret des 4 classes.**
- `hero-test`/`enemy`/`subi` mono → la porte pose UNE étape `CascadeStep` (`jet:'test'` ou un `kind` métier) + `startCascade` (surface) ou `runCascadeImmediate` (inline), calque exact d'`openSkillTest` (combatEffects.ts:313-397).
- `batch`/multi → étape `CascadeStep` portant `participants?` (extension Décision 4), résolue par la spec crew EXISTANTE `crewRoleFlowSpec` (rollFlowSpecs.ts:165) ; l'agrégation (`summed-dr` = `maneuverCrewTotal`, `opposed`, `best`) est le paramètre `aggregate`.

*Économie prouvée (#275.3)* : l'appel canonique fait 1 ligne + 1 applier ; le hack (inline `rollTest` + `tell` + décision de surfaçage à la main, ex. seaVoyageFlow.ts:631-635, :784-789) fait ≥ 6 lignes ET ne compile plus une fois la garde #274 posée. Le canonique est strictement moins cher.

---

## Décision 2 — Le scellement de `TestOutcome`

**Décision.** Nouveau module `src/engine/testOutcome.ts` exportant une **classe `TestOutcome` à constructeur privé + brand nominal**, dont le SEUL point de scellement est `TestOutcome.seal(...)`. *Justification : un `private constructor` + un champ `private readonly [BRAND]` rendent un littéral `{won, sl}` NON assignable (échec structural) → « un contournement ne compile pas » (#275.2).*

```ts
// src/engine/testOutcome.ts — le SEUL module qui peut sceller un résultat de jet.
import type { TestResult } from './tests';
import type { RollBreakdown } from './combat';

declare const OUTCOME_BRAND: unique symbol;

export class TestOutcome {
  readonly won: boolean;
  readonly sl: number;
  readonly roll: number;
  readonly target: number;
  /** Marque NOMINALE (privée) : un objet littéral ne peut pas la fournir → pas de forgeage. */
  private readonly [OUTCOME_BRAND]!: true;
  private constructor(tr: TestResult, readonly detail: RollBreakdown) {
    this.won = tr.success; this.sl = tr.sl; this.roll = tr.roll; this.target = tr.target;
  }
  /** SCELLEMENT — appelé UNIQUEMENT par le noyau du seam (whitelist #274). */
  static seal(tr: TestResult, detail: RollBreakdown): TestOutcome { return new TestOutcome(tr, detail); }
}
```

**Où vit le module + qui importe quoi (whitelist du graphe #274).** *Justification : `RollOutcome` (rollFlowFactory.ts:107) est aujourd'hui un simple `interface {won, sl}`, forgeable partout — c'est exactement le trou que #274 doit fermer.*

| Symbole | Peut importer/appeler | Interdit à |
|---|---|---|
| `TestOutcome.seal` | `rollSeam.ts`, `rollFlowFactory.ts`, `cascade.ts` (résolveur générique), `rollFlowSpecs.ts` (les resolveurs de spec) | tout autre module (`seaVoyageFlow`, `combatFlow`-openers, écrans…) |
| **type** `TestOutcome` (lecture) | tout le monde (les appliers/continuations le CONSOMMENT) | — (le type est libre ; seule la CONSTRUCTION est scellée) |
| `rollTest`/`d100` inline (moteur RNG) | même whitelist que `.seal` (les seuls à ROULER) | tout call-site : il DÉCRIT via `openRoll`, il ne roule pas |

La garde #274 (Ronde 4) est un grep de quarantaine d'import : `TestOutcome\.seal\(` et `\brollTest\(`/`\bd100\(` hors whitelist → échec pre-commit. *Justification : « si on peut le greper, on peut l'écrire » → la quarantaine d'import est le verrou préféré (programme phase0 §1, patron #274).* `RollOutcome` (`{won, sl}` de la fabrique) est REMPLACÉ par `TestOutcome` : les `outcome:` de spec renvoient `TestOutcome.seal(...)`, gating de Chance/Résilience inchangé (`isFailed = !outcome(slot).won`, rollFlowFactory.ts:350).

---

## Décision 3 — Table de policy `klass × contrôleur × cadence` (COMPLÈTE)

**Décision.** La porte calcule le surfaçage par cet algorithme unique, adossé aux prédicats existants (`netOwnership.ts`), jamais au `kind` :

```
owner   = résolution EXISTANTE : actorId → seatOwns (héros→ownership ; ENNEMI→gmSeat, netOwnership.ts:19) ;
          worldSide → gmSeat ; participants → '*' (chacun ses PJ).
autoV   = seaAutoResolves(plan.orders, kind)   // COMMANDÉE + routine (voyageCadence.ts:41)
autoC   = cadenceAuto()                        // Rapide/Auto global
```

Trois surfaces : **M** = modale influençable (verbes Chance/Résilience/Pacte) · **V** = visible-lançable MJ (étape surfacée au `gmSeat`, « Lancer » sans influence pour un jet non-d100) · **I** = inline-PV (`runCascadeImmediate`-mirror + ligne `NightEntry`).

| klass \ contexte | héros piloté-humain, cadence MANUELLE | héros/global AUTO (`autoC`/`aiControlled`) | côté ennemi/monde + **siège MJ** (`gmSeat≠null`), manuel | côté ennemi/monde, **sans MJ** (IA) | voyage **COMMANDÉE** + routine (`autoV`) | voyage **jour-par-jour** (manuel) |
|---|---|---|---|---|---|---|
| **hero-test** (scorbut *si porté par un héros contrôlé*, Test de scène, activité…) | **M** (`humanControlled`, netOwnership.ts:79) | **I** | — | — | **I** (routine batch, cf. batch) | **M** |
| **enemy** (Test de PNJ : perception ennemie, jet d'IA remonté) | — (owner ennemi) | **I** | **V** (owner=gmSeat via `seatOwns` :19 ; MJ « voit/peut lancer TOUT ») | **I** | — | — |
| **subi** (désertion d100, Moral d10/±2d10, scorbut, épuisement, Salissures, périls subis) | **I** si porté par un héros non-MJ ; **V** si le côté est piloté MJ | **I** | **V** (MJ « voit/peut lancer … y compris désertion et Tests de PNJ » — read-only, jet non influençable) | **I** (ligne PV) | **I** (ligne PV) | **I**/**M** selon si c'est un vrai Test de héros |
| **batch** (Test d'équipage : Progression, Affaler, Orientation, Phare, Entretien, Poursuite, Tourbillon, Extermination, Forcer-le-rythme) | **M** multi (jour-par-jour) | **I** (`autoC`) | **V** multi | **I** | **I** (`runCascadeImmediate`) | **M** multi (une rangée/PJ, influençable) |

*Justifications ligne à ligne :*
- **hero-test → M** quand `humanControlled` (humain + cadence manuelle) : plancher behavioral déjà gardé (`roll-modal-invariant.test.ts:8-15`).
- **enemy/subi → V sous MJ** : `seatOwns` route l'ennemi vers `gmSeat` GRATUITEMENT (netOwnership.ts:19) et `pilotedByHuman(enemy)=gmSeat≠null` (:38-42) → une étape avec `actorId=enemyId` remonte au MJ sans code neuf. La désertion (shipCrew.ts:469, d100 :477) et le Moral (`applyShipMoraleDelta` :265, `factorLedger` read-only :405) deviennent des étapes `subi`/`kind:'desertion'`/`'morale'` surfacées au MJ au lieu de `log` de fond.
- **subi read-only** : un jet non-d100 (d10/±2d10) n'est pas influençable (`factorLedger` :405 « ligne de PV LECTURE SEULE ») → **V** = le MJ VOIT et peut LANCER, pas influencer.
- **batch → I sous COMMANDÉE routine** : `seaAutoResolves` (voyageCadence.ts:41, `SEA_ROUTINE_KINDS` :36) ; « aucun jet silencieux » → ligne PV (`voyageDayEntry`, voyageCadence.ts:54).
- **batch → M multi jour-par-jour** : la modale multi canonique (`FLOWS.crewTest`, une rangée/participant), influençable par PJ (`intentAllowedFor` filtre déjà `crewTest*` par `args[0]`, netOwnership.ts:141).
- **auto (`autoC`) → I partout** : en Rapide/Auto les jets se lancent seuls, sans influence (`humanControlled` = `!cadenceAuto() && …`, netOwnership.ts:79-81).

Cas particuliers couverts (mandat) : **désertion** = subi (V sous MJ, I sinon) ; **Moral** = subi read-only ; **périls/embuscade** = le Test de vigie est un `batch` (Perception d'équipage), la conséquence (Surprise) est l'applier ; **activités/commerce** (#273) = `hero-test` (jour-par-jour M, COMMANDÉE I) ; **ennemis EN COMBAT** = HORS seam (Décision 6 : déjà l'arbitre + `JET_AUTO`).

---

## Décision 4 — Remplacement de la FSM seaVoyageFlow par la séquence générique

**Décision.** Remplacement INTÉGRAL (pas adaptation) de `SeaStep`+`sea.step`+`runSeaDays` (seaVoyageFlow.ts:96, :543-729) par un `CascadeStep[]` piloté par `startCascade`/`advanceCascade` (surface) et `runCascadeImmediate` (COMMANDÉE/auto). *Justification : F4 — seaVoyageFlow a 0 occurrence de `CascadeStep`, sa FSM 12 branches est le seul séquenceur maison non rebranché (phase0 §2 F4, V18).*

**Extension sanctionnée (la seule).** `CascadeStep.participants?: ShipManeuverParticipant[]` + `aggregate?: RollAggregate` dans pendings.ts (l'étape est déjà `extends RollParticipant`, le pending `extends MultiPending<CascadeStep>`). *Justification : le trou est uniquement dans `CascadeStep` mono-acteur ; une étape À participants ouvre la MÊME modale multi canonique, résolution routée par la spec crew, agrégation portée par la spec — arbitrage user F4.*

**Le registre d'appliers = `cascadeAppliers` (pas un `crewCascadeAppliers` parallèle).** Les 10 branches du `switch(kind)` de `resolveVoyageCrewTest` (:906-1045) deviennent des `registerCascadeApplier('progression'|'affaler'|'orientation'|'phare'|'entretien'|'poursuite'|'tourbillon'|'extermination'|'embuscade'|'voyage-rapide', apply)`. *Justification : V18 — « registre-compilé, plus aucun `switch(kind)` local », le registre partagé (cascade.ts:54), fail-fast sur kind non enregistré.* Une crise (Poursuite/Tourbillon) qui se reconduit = l'applier renvoie `insert: CascadeStep[]` (mécanisme d'insertion existant, cascade.ts:125). L'ordre des 12 étapes (météo→périls→affaler→progression→crise→embuscade→perception→orientation→extermination→events→entretien→nuit) devient l'ordre du tableau ; les étapes sans jet (météo/périls/events/nuit) sont `kind` d'affichage/conséquence (applier muet ou pur, comme `buildConsequenceSteps` cascade.ts:225).

**Étapes de migration SÛRES (ordre, parité prouvable à chaque cran) :**
1. **Étendre le primitif** : `CascadeStep.participants?`/`aggregate?` (pendings.ts) ; `stepInteraction`/`stepReady`/`commitStep` (cascade.ts:63/71/107) gèrent l'étape-participants (prête quand tous les participants interactifs ont `result` ; résolue via `crewRoleFlowSpec`). *Aucun changement des étapes mono existantes (nuit/voyage/combat/river).* Tests : `cascade.test.ts` étendu d'un cas participants.
2. **Construire `buildSeaDayCascade(get): CascadeStep[]`** + enregistrer les 10 appliers (le contenu des branches actuelles, byte-identique). Pas encore branché.
3. **Basculer la boucle** : `runSeaDays` → `runSeaDay(get,set)` qui bâtit la cascade du jour et appelle `startCascade` (surface) OU `runCascadeImmediate` (`seaAutoResolves`/`cadenceAuto`) — la porte (`openRoll`) décide par étape via `klass`. `finalizeCascade`/`advanceCascade` (cascade.ts:135/182) remplacent la reprise `crewTestContinue`.
4. **Migrer les 4 sites inline VIA la porte** : forcer-le-rythme (seaVoyageFlow.ts:631-635, `klass:'batch'` Voile/Ramer) ; prière (:1276, `klass:'subi'`/hero-test Prière) ; scorbut (:784, `klass:'subi'` Résistance) ; épuisement (:844, `klass:'subi'` Résistance) — chacun devient une étape `openRoll` au lieu d'un `rollTest`+`tell`.
5. **Supprimer** `SeaStep`, `sea.step`, `autoResolveVoyageCrewTest` (:345), `resolveVoyageCrewTest` (:898), la boucle `runSeaDays` (:543).
6. **Réécrire les tests** qui verrouillent `sea.step`/`SeaStep`/le switch → contre la forme cascade (jamais travesti). DoD F4 : 0 occurrence de ces 4 symboles ; les 12 étapes sont des `CascadeStep` enregistrés ; parité (routine vs modale, suspension/reprise) prouvée en recette navigateur.

**Coordination #280 (applyOps).** Les mutations `wounds` de seaVoyageFlow (:476/:1226 équiv./:1320/:1441 — phase0 F3) et la Décision 4 touchent le MÊME fichier. *Ordonnancement : #280 (applyOps→`damageHull`) et le remplacement FSM sont sérialisés (même agent ou rebase strict), le remplacement APRÈS #280 pour bâtir la cascade sur des conséquences déjà routées.*

---

## Décision 5 — Séquencement d'exécution (rondes)

Doctrine : agents CODENT ; modèle/effort explicites (jamais « Sonnet gros effort général »).

- **Ronde 0 — Le seam + `TestOutcome` scellé · L · codeur (Sonnet, effort élevé) + passe `juge`.** Créer `engine/testOutcome.ts` (Décision 2) ; créer `state/rollSeam.ts` `openRoll` (Décision 1) ; brancher la table de policy (Décision 3) sur les prédicats existants ; `outcome:` de spec renvoient `TestOutcome.seal`. AUCUN call-site migré (substrat seulement). DoD : `openRoll` couvre les 4 classes + 3 surfaces, suite verte, 0 régression de `roll-modal-invariant.test.ts`.
- **Ronde 1 — #271/#272 via la porte · M · codeur (Sonnet, effort moyen).** Migrer les 4 sites inline (forcer-le-rythme :631, prière :1276, scorbut :784, épuisement :844) sur `openRoll` — sans encore toucher la FSM (les étapes coexistent avec `runSeaDays`). Prouve la porte en conditions réelles avant le gros remplacement. DoD : 0 `rollTest(` sur ces 4 sites ; désertion/scorbut visibles au siège MJ en recette.
- **Ronde 2 — Remplacement FSM (Lot 6) · L · codeur (Sonnet, effort élevé) + passe `juge` · COORDONNÉ #280.** Décision 4 (étapes 1-6). Sérialisé APRÈS #280 (applyOps sur seaVoyageFlow). DoD : 0 `SeaStep`/`sea.step`/`autoResolveVoyageCrewTest`/`resolveVoyageCrewTest` ; parité recette navigateur (routine PV vs modale, suspension/reprise, abordage/Fuite de vapeur).
- **Ronde 3 — #273 policy de classe (activités/commerce) · S · codeur (Sonnet, effort moyen).** Câbler la classe `hero-test` (jour-par-jour M / COMMANDÉE I) pour `FLOWS.activity` et le commerce via la porte. DoD : les Activités de mer (`pendingSeaActivities`) passent par `openRoll`.
- **Ronde 4 — #274 garde de quarantaine · S · codeur (Sonnet, effort moyen). EN DERNIER.** Grep bloquant `TestOutcome\.seal\(`/`\brollTest\(`/`\bd100\(` hors whitelist (Décision 2), branché pre-commit (pas Vitest seul — trou transversal 2). DoD : la garde échoue sur un `rollTest` inline réintroduit ; whitelist commentée.

*Justification de l'ordre* : le substrat (0) doit exister avant toute migration ; les sites simples (1) valident la porte avant le remplacement lourd (2) ; #280 précède (2) car même fichier ; #273 (3) n'est que du câblage de classe ; #274 (4) EN DERNIER car un garde posé avant la migration bloquerait les rondes 1-3 elles-mêmes (mandat).

---

## Décision 6 — Hors périmètre

- **Combat déjà canonique** : attaque/défense/incantation/désengagement/manœuvre/… sont des specs `FLOWS` surfacées en étapes `jet` de la cascade `combat` par `MODAL_DEFS` + `JET_AUTO` (modalArbiter.ts:47, combatAuto.ts:33). Leur policy de surfaçage est DÉJÀ résolue par l'arbitre. Le seam NE re-plombe PAS le combat — il couvre le hors-combat/voyage/entretien/subi qui le contournent. *Justification : #269-#275 §7 phase0 « famille JETS déjà traitée ».*
- **Décisions non-jet** : le Conseil de bord (`pendingCouncil`, shipCrew.ts:279 — paie), les choix de route, l'attribution de butin = des DÉCISIONS, pas des Tests → hors seam (restent au registre `MODAL_DEFS`/`STATE_FIELDS`).
- **Le RNG primitif** (`battleRng`/`defaultRNG`) reste inchangé : le seam ne normalise pas le rng (contextuel par flux, rollFlowSpecs.ts:296-301) — il décide seulement du SURFAÇAGE.
- **`massBattleFlow`/`interludeFlow` comme séquenceurs** : NON tranchés (survolés, phase0 §7) — à auditer avant d'y imposer V18 ; s'ils dévient, ils rejoignent le patron cascade+specs, jamais une FSM locale.

---

### Fichiers critiques pour l'implémentation
- `src/state/rollFlowFactory.ts`
- `src/state/cascade.ts`
- `src/state/netOwnership.ts`
- `src/state/seaVoyageFlow.ts`
- `src/engine/tests.ts`
