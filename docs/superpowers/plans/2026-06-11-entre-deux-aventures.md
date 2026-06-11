# Entre deux aventures — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, tâche par tâche.
> Spec : `docs/superpowers/specs/2026-06-11-entre-deux-aventures-design.md` (sources RAW ch.22/23).

**Goal:** Système « Entre deux aventures » (Jalon 5) : Événement d100 → Activités (min(3, semaines))
→ Argent à gaspiller ; Activités V1 : Revenus, Artisanat (Test étendu de Métier), Apprentissage
particulier, Entraînement, Opérations bancaires, Changement de carrière, Passer commande,
Entraînement au combat. Déclenché par l'Effet d'éditeur `interlude { weeks }`.

**Pièges connus :** bourse PARTY-LEVEL vs gaspillage (arbitrage spec §7.1) ; audit RAW de
l'achat hors-carrière (`advancement.ts` ×2 sans Activité — LDB 07 « Progrès » à relire avant
de toucher) ; fichiers partagés (`store.ts`) → pathspec ; « un jet = une modale » (garde-fou
statique scanne les actions du store — passer par la fabrique rollFlow).

---

## P0 — Moteur pur + données

### Task 0.1 : `engine/activities.ts` (TDD)
- [ ] Tests `engine/activities.test.ts` : `craftTarget(price, avail, atouts, defauts)` →
  {dr, difficulty} (gammes Bronze 5/Argent 10/Or 15 ; Défauts ÷2 PUIS Atouts +5 ; difficulté
  par Disponibilité) ; `apprenticeshipCost(talentXp, rng)` (2d10 pa / 100 PX) ;
  `bankWithdraw(kind, rate, roll)` → 'ok'|'lost' (invest : roll ≤ rate perd ; stash : ≤ 10 perd) ;
  `statusIncome(status, rng)` (LDB 08 « Gagner de l'argent grâce au Statut » — RELIRE la table
  exacte avant d'écrire le test, citer les lignes).
- [ ] Implémenter, citations RAW en tête de chaque fonction. Suite verte.
- [ ] Commit `feat(meta): moteur pur des Activités (artisanat/banque/apprentissage/revenus)`.

### Task 0.2 : table des Événements
- [ ] RELIRE `22 - Événements.md` EN ENTIER (la spec n'en liste que la moitié).
- [ ] `src/data/interludeEvents.ts` (manuscrit verbatim, statut criticals.ts) :
  `{ min, max, label, text, fx?: { moneyPct?; revenuePct?; bankPct?; fortuneMax?; loseActivity? } }[]`
  — fx UNIQUEMENT quand le texte est mécanique sans ambiguïté ; sinon narratif pur.
- [ ] Test : couverture 01-100 sans trou ni chevauchement ; entrées mécaniques connues (22-25 →
  moneyPct −30…).
- [ ] Commit.

## P1 — État + déclencheur

### Task 1.1 : état `interlude` + Effet d'éditeur
- [ ] `GameState.interlude` + `bank` + `pendingOrders` (spec §5), init null/[] dans l'état de
  création (sauvegarde gratis).
- [ ] `Effect` union (state/scene.ts) : `{ type: 'interlude', weeks: number }` ; `applyEffects`
  → `startInterlude(weeks)` (screen 'interlude', tirage des événements par héros via battleRng,
  application des fx mécaniques, livraison des `pendingOrders` du cycle précédent).
- [ ] EffectList (éditeur) : entrée « Entre deux aventures (semaines) ».
- [ ] Tests state : startInterlude pose l'état (événements tirés, left = min(3, weeks),
  −1 Activité si Festivités/elfe ≥ 3 sem) ; ordres livrés.
- [ ] Commit.

### Task 1.2 : actions d'Activités (store, via fabrique rollFlow où il y a JET)
- [ ] `interludeRevenus(heroId)` (jet via FLOWS — spec rollFlows : pendingInterludeTest générique ?
  UN flux générique `pendingActivity` {heroId, kind, …} avec resolve par kind) ; décrément `left`.
- [ ] `interludeCraftStart(heroId, trappingLabel, atouts, defauts)` (paie ¼, pose craft) +
  `interludeCraftRoll` (jet étendu, cumul DR, achèvement → itemFromTrapping+qualités).
- [ ] `interludeLearn(heroId, talent)` / `interludeTrain(heroId, …)` (audit RAW hors-carrière
  AVANT : LDB 07 « Progrès » — si l'Activité est requise, gater `buySkillAdvance`/`buyCharAdvance`
  hors-carrière sur l'interlude et le SIGNALER en ROADMAP).
- [ ] `interludeBank(heroId, kind, amount[, rate])` + `interludeWithdraw(index)` ;
  `interludeOrder(heroId, trapping)` ; `interludeCareer(heroId, …)` (delegate changeCareer) ;
  `interludeCombatTraining(heroId, skill)` (drapeau inversion — ActiveFlag `invertTest` consommé
  au point de relance, pattern freeReroll).
- [ ] `interludeEnd()` : « Avec le pouvoir » (niveaux 3-4 sans Revenus → −1 niveau), gaspillage
  (bourse → 0 sauf banques ; revenus crédités), avance l'horloge de `weeks`, retour campagne.
- [ ] Tests state pour CHAQUE action (succès/échec/garde-fou modale).
- [ ] Commit.

## P2 — UI

### Task 2.1 : `InterludeScreen`
- [ ] screen 'interlude' (App routing) ; 3 phases ; onglet/sélecteur par héros (UI scale :
  panneau > 2 sections → onglets) ; cartes Activités (V1 actives, V2 grisées « non modélisée ») ;
  cartes Événement par héros (texte verbatim + fx appliqués listés) ; clôture avec récap
  gaspillage AVANT confirmation (arbitrage spec §7.1 affiché).
- [ ] Modales de jet : réutiliser RollFlowShell (flux pendingActivity).
- [ ] Smoke test rendu + responsive 360px (primitives globales).
- [ ] Commit.

### Task 2.2 : scénario de test + recette
- [ ] `src/scenes/test-scenarios/16-interlude.ts` (groupe fixé, Effet interlude 3 semaines).
- [ ] Recette navigateur (si Playwright libre) : événement → artisanat 2 jets → banque →
  clôture → l'horloge a avancé de 3 semaines, l'or a disparu sauf dépôt. 0 erreur console.
- [ ] Commit + ROADMAP (cocher fabrication + activités, Jalon 5).

## Hors périmètre (documenté)
Activités V2 (spec §3), Faveurs, Événements narratifs à effet MJ, Invention.
