# Unification de la narration des popins de jet — source unique `result.log`

> **Pour exécutants :** incréments testés, un flux à la fois. Cases `- [ ]`.

**Goal :** toutes les popins de jet dérivent leur issue de LA MÊME façon — le résultat du jet porte sa
ligne de narration, la popin l'affiche, le fil de combat la journalise. Fini les `outcomeText`
recalculés par modale (puis re-recalculés à la validation).

**Problème (vérifié).** Le combat calcule la narration au moment du jet et la pose sur le résultat
(`AttackResult.log`) → la popin et le fil la partagent (corrigé ce jour). Les ~15 flux non-combat,
eux, recalculent une `outcomeText` DANS la modale (aperçu), et la validation re-journalise une ligne
en parallèle → narration dupliquée et incohérente d'un flux à l'autre.

**Architecture (réutiliser le motif combat, pas en inventer un).** Chaque flux pose sa narration sur
le **résultat** au `resolve` (`result.log: string`), exactement comme `AttackResult.log`. La modale
rend `result.log` via `<JournalLine event={ev(kind, result.log, …)}>` (motif déjà en place pour
attaque/défense/magie/piétinement). La validation journalise `result.log` (plus de recalcul).

**Tech :** Vite + TS + React, Zustand, Vitest. `makeRollFlow` (rollFlow.ts) = fabrique partagée ;
`FLOWS.*` (rollFlows.ts) = `resolve` par flux ; modales = `RollFlowShell` paramétré.

---

## Convention cible (le « une seule façon »)

```ts
// resolve d'un flux (rollFlows / engine) — calcule la narration UNE fois, la pose sur le résultat :
return { result: { …, log: `${actor.name} réussit (DR ${sl}).` } };
// modale — affiche la ligne du résultat, jamais une ligne recalculée :
outcome={res && <JournalLine className="rm-journal" event={ev(kind, res.log, actorId, subjectId)} combatants={pool} />}
// validation (store) — journalise la MÊME ligne :
get().log(res.log);
```

`kind` (heal/fear/info/crit/…) reste choisi par la modale (couleur), seul le TEXTE devient `res.log`.

## Flux à migrer (audit)

Déjà conformes : `attack` (useAttackJetProps), `defense`, `cast` (projectile), `trample`.

À migrer (chacun : ajouter `log` au type de résultat + le calculer au `resolve` + modale lit `res.log`
+ validation journalise `res.log`, en supprimant l'`outcomeText`/issue inline dupliquée) :

- [ ] **Test** (`TestModal` + `FLOWS.test` + `resolveTest`) — PILOTE.
- [ ] **Psych** (`PsychModal` + `psychResolve` + `psychConfirm`).
- [ ] **EncounterPsych** (`EncounterPsychModal` + flux).
- [ ] **Heal** (`HealModal` + `healRoll`/`healConfirm`).
- [ ] **Corruption** (`CorruptionModal` + flux).
- [ ] **Activity** (`ActivityModal` + flux interlude).
- [ ] **Bargain** (`BargainModal` + `merchantFlow`).
- [ ] **Appraise** (`AppraiseModal` + flux).
- [ ] **Approach** (`ApproachModal`).
- [ ] **Run** (`RunModal` + `resolveRun`).
- [ ] **StateRecovery** (`StateRecoveryModal`).
- [ ] **Reload** (`ReloadModal`).
- [ ] **Focus** (`FocusModal` + `resolveFocus`).
- [ ] **Frenzy** (`FrenzyModal`).
- [ ] **Disengage** (`DisengageModal`) — issue inline, déjà binaire ; vérifier la pertinence.

> Par flux, VÉRIFIER d'abord si la validation journalise déjà une ligne : si oui, c'est elle qui
> devient `res.log` (source unique) ; si la narration de la modale et celle du fil DIFFÈRENT
> (modale = jet, fil = conséquence), garder les deux mais router la modale sur la ligne du JET.

## Pilote — Test (Task 1)

**Files :** `src/engine/tests.ts` ou `src/state/rollFlows.ts` (resolve), `src/ui/TestModal.tsx`,
`src/state/store.ts` (`resolveTest`), test `src/state/store.test.ts`.

- [ ] **Step 1 (test)** — `resolveTest`/`FLOWS.test` pose `result.log` (« X réussit (DR n) » / « X
  échoue » / « X ne faillit pas (Résilience) »). Assert : après un jet, `pendingTest.result?.log`
  (ou champ équivalent) contient la narration.
- [ ] **Step 2** — `TestModal` : `outcome` = `<JournalLine event={ev('info', res.log, …)}>` ;
  supprimer `const outcomeText`.
- [ ] **Step 3** — `resolveTest` (validation) : journalise `res.log` au lieu de recalculer.
- [ ] **Step 4** — `npm run typecheck` propre (hors bruit session //) ; `npm test` Test/store verts.
- [ ] **Step 5** — recette navigateur (si dispo) : la popin de Test montre la ligne, identique au fil.
- [ ] **Step 6** — commit `refactor(test): narration de Test en source unique (result.log)`.

## Réplication (Tasks 2-15)

Même 6 étapes par flux, dans l'ordre de la liste. Commit par flux (ou petit lot cohérent). Suite
verte à chaque palier ; recette navigateur par lot quand l'instance est libre.

## Vérification

`npm run typecheck` ; `npm test` (combat + flux migrés) ; recette `window.__wfrp` (popin = fil).

## Hors périmètre

- Le combat (déjà en source unique).
- La couleur (`ev` kind) reste un choix de modale.
- Reds de la session parallèle (Trigger/ItemInstance) — pas de ce lot.
