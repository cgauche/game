# Loadouts — Plan #3 : commutateur de loadout en combat + verrou d'équipement

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps en checkbox (`- [ ]`).

**Goal:** Rendre les loadouts utilisables EN combat : un commutateur dans l'ActionBar bascule le set actif
(Action gratuite, 1/tour, autorisé même Engagé) ; l'équipement (armure/inventaire) est verrouillé pendant le combat.

**Architecture:** `battle.loadoutSwapped` (réinitialisé au changement de tour) ; action `battleSwitchLoadout`
mute le combattant ACTIF (`activeCombatant(battle)`, pattern de `battleDefendTotal`) via `loadoutSetActive` +
`recomputeLoadout`, puis `set({battle})`. UI : boutons de set dans l'ActionBar. Verrou : la fiche désactive
(dé)équiper en combat (LoadoutSection est déjà gaté `!inBattle`).

**Tech Stack:** TS, React, Zustand, Vitest. Réf : spec §3 (switch 1/tour même Engagé, verrou équipement), plan #1/#2 livrés.
**Hors scope (→ plan #4) :** choix d'arme d'attaque/parade (threading `firedWeapon` 10 sites), réconciliation marchand.

**Commande de test :** `npx vitest run <fichier>` ; `npm test` ; `npm run typecheck`.

---

## Task 1 : `battle.loadoutSwapped` + action `battleSwitchLoadout` + reset au tour

**Files:**
- Modify: type de `BattleState` (champ `loadoutSwapped?`) — fichier à confirmer (`state/scene.ts` ou `store.ts`)
- Modify: `src/state/store.ts` (type d'action + impl `battleSwitchLoadout`) ; import `loadoutSetActive` depuis items
- Modify: `src/state/combatFlow.ts` (reset `loadoutSwapped` là où `movementUsed`/`acted` sont remis à 0 au changement de tour)
- Test: `src/state/store.test.ts` (ou un test dédié) — switch bascule le set actif du combattant ACTIF ; 1/tour

- [ ] **Step 1 : Localiser le type BattleState + le reset de tour**

Run (lecture) : chercher `movementUsed` dans la déf de l'état de combat et dans `advanceTurn` :
`grep -n "movementUsed" src/state/*.ts` → noter (a) l'interface qui le déclare (y ajouter `loadoutSwapped?: boolean;`)
et (b) l'endroit du reset au changement de tour (y ajouter `loadoutSwapped: false`).

- [ ] **Step 2 : Écrire le test qui échoue**

Dans `src/state/store.test.ts` (adapter au harnais existant : créer une partie en combat avec un héros à ≥2 loadouts) :
```ts
it('battleSwitchLoadout bascule le set actif du combattant ACTIF (1/tour, même Engagé)', () => {
  // Setup : un héros avec 2 loadouts (Épée / Hache), en combat, son tour.
  // (réutiliser le helper de mise en combat du fichier ; sinon construire un battle minimal)
  const { store, heroId } = setupBattleWithLoadouts(); // helper local (voir note)
  store.getState().battleSwitchLoadout('lo-hache');
  const active = store.getState().battle!.combatants.find((c) => c.id === heroId)!;
  expect(active.activeLoadoutId).toBe('lo-hache');
  expect(active.weapons.some((w) => w.name === 'Hache')).toBe(true);
  expect(store.getState().battle!.loadoutSwapped).toBe(true);
  // 2e switch refusé ce tour
  store.getState().battleSwitchLoadout('lo-epee');
  expect(store.getState().battle!.combatants.find((c) => c.id === heroId)!.activeLoadoutId).toBe('lo-hache');
});
```
NOTE : si `store.test.ts` n'a pas de helper de combat réutilisable, tester plutôt l'unité au niveau combatFlow
(exposer `switchLoadout(get,set,loadoutId)` et le tester avec un `get/set` mock minimal), OU couvrir par un test
de combatFlow existant. Choisir l'approche la moins lourde déjà présente dans le repo.

- [ ] **Step 3 : Implémenter `battleSwitchLoadout`**

Type (près des autres actions de combat, ex. `battleDefendTotal`) :
```ts
  /** Bascule le set d'armes actif du combattant actif (Action gratuite, 1/tour, même Engagé — LDB 13 l.116). */
  battleSwitchLoadout: (loadoutId: string) => void;
```
Impl (pattern `battleDefendTotal`) :
```ts
  battleSwitchLoadout: (loadoutId) => {
    const battle = get().battle;
    if (!battle || battle.over || battle.loadoutSwapped) return; // 1 switch gratuit / tour
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    if (active.activeLoadoutId === loadoutId) return;
    loadoutSetActive(active, loadoutId);
    recomputeLoadout(active);
    const name = active.loadouts?.find((l) => l.id === loadoutId)?.name ?? 'set';
    set({ battle: { ...battle, loadoutSwapped: true, log: [...battle.log, ev('info', `${active.name} dégaine : ${name}.`, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
```
Importer `loadoutSetActive` (et vérifier que `recomputeLoadout`, `activeCombatant`, `ev`, `bus`, `EVT` sont déjà importés dans store.ts). Câbler aussi le reset `loadoutSwapped: false` au changement de tour (Step 1b). Vérifier le `kind` du `ev(...)` (utiliser une catégorie existante de `combatLog`, ex. `'info'`/`'move'`).

- [ ] **Step 4 : Lancer le test + suite + typecheck**

Run: `npx vitest run src/state/store.test.ts` → PASS ; `npm run typecheck` → 0 erreur ; `npm test` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/state/store.ts src/state/combatFlow.ts src/state/scene.ts src/state/store.test.ts
git commit -m "feat(combat): battleSwitchLoadout (set d'armes basculable en combat, 1/tour meme Engage)"
```

---

## Task 2 : Commutateur de loadout dans l'ActionBar

**Files:**
- Modify: `src/ui/ActionBar.tsx`

- [ ] **Step 1 : Ajouter le commutateur**

Lire `battleSwitchLoadout` du store dans `ActionBar` :
```tsx
  const switchLoadout = useGame((s) => s.battleSwitchLoadout);
```
Dans le rendu du combattant actif héros, ajouter (près des pastilles de budget `ab-budget`, AVANT les slots ou
dans une rangée dédiée) — n'afficher que si le héros a ≥2 loadouts ET qu'il n'a pas déjà switché ce tour :
```tsx
  const loadouts = active.loadouts ?? [];
  ...
      {isHero && loadouts.length >= 2 && (
        <div className="ab-loadouts" title={battle.loadoutSwapped ? 'Set déjà changé ce tour' : 'Changer de set d’armes (gratuit, 1/tour)'}>
          {loadouts.map((lo) => (
            <button
              key={lo.id}
              className={`btn btn-sm ${active.activeLoadoutId === lo.id ? 'btn-primary' : ''}`}
              disabled={battle.loadoutSwapped && active.activeLoadoutId !== lo.id}
              onClick={() => switchLoadout(lo.id)}
            >
              {lo.name}
            </button>
          ))}
        </div>
      )}
```
(Noms COURTS — cf. mémoire « pas haiku ». Le commutateur reste ACTIF même Engagé : pas de garde `engaged`.)

- [ ] **Step 2 : typecheck + suite + recette**

Run: `npm run typecheck` → 0 erreur ; `npm test` → PASS.
Recette navigateur (si dispo) : en combat, basculer un set change l'arme active ; 2ᵉ switch grisé le même tour ;
re-dispo au tour suivant. (Sinon, validé par le test de Task 1.)

- [ ] **Step 3 : Commit**

```bash
git add src/ui/ActionBar.tsx
git commit -m "feat(ui): commutateur de set d'armes dans l'ActionBar (combat)"
```

---

## Task 3 : Verrou d'équipement en combat (fiche perso)

**Files:**
- Modify: `src/ui/CharacterSheet.tsx`

- [ ] **Step 1 : Désactiver (dé)équiper armure/prothèse en combat**

`LoadoutSection` est déjà gaté `!inBattle` (plan #2) → la construction de sets est hors combat. Reste le bouton
« Équiper » des armures/prothèses : le désactiver en combat. Sur le `<button … onClick={() => toggleEquip(...)}>`
(armure/prothèse), ajouter `disabled={inBattleNow}` et un title explicatif :
```tsx
                    <button className={`btn small ${it.equipped ? 'btn-primary' : ''}`}
                      disabled={inBattleNow}
                      title={inBattleNow ? 'Équipement verrouillé en combat (changez de set d’armes via la barre d’action)' : (isProsthesis ? 'Porter la prothèse…' : undefined)}
                      onClick={() => toggleEquip(hero.id, it.uid)}>
```
(Le transfert d'objet `transferItem` : également à désactiver en combat — ajouter `disabled={inBattleNow}` au `<select give-sel>`.)

- [ ] **Step 2 : typecheck + suite**

Run: `npm run typecheck` → 0 erreur ; `npx vitest run src/ui/CharacterSheet.test.tsx` → PASS ; `npm test` → PASS.

- [ ] **Step 3 : Commit**

```bash
git add src/ui/CharacterSheet.tsx
git commit -m "feat(ui): equipement verrouille en combat (armure/transfert) -- seul le switch de set est permis"
```

---

## Auto-revue (couverture)

- `battle.loadoutSwapped` + `battleSwitchLoadout` (1/tour, même Engagé) → Task 1.
- Commutateur ActionBar → Task 2.
- Verrou d'équipement en combat (armure/transfert ; sets hors combat déjà gaté) → Task 3.
- HORS scope (plan #4) : choix d'arme d'attaque (PendingAttack.weaponUid + `firedWeapon` à 10 sites, parité) ;
  choix d'arme de parade (PendingDefense.parryWeaponUid + DefenseModal) ; réconciliation marchand.
