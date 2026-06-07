# Psychologie P3 — Traits ciblés & Groupes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps en checkbox.

**Goal :** Rendre jouables les Traits Psychologiques **ciblés** (LDB 21 : Animosité, Haine, Préjugé, Amour, Camaraderie, Phobie), pilotés par un modèle de **Groupes** (mots-clés multiples par combattant, auto-dérivés du folder/espèce/carrière + extras manuels), avec Tests de Psychologie (héros modale / IA instantané), effets de combat (±1 DR, immunités) et de Sociabilité (−20/−10).

**Architecture :** Cœur pur étendu dans `engine/psychology.ts` (parsing ciblés, résolution générique) + nouveau `engine/groups.ts` (dérivation + matching). Drapeaux `Combatant.groups`/`psychTraits` (déjà déclarés). Déclenchement/résolution réutilisent l'infra P1 (`collectHeroPsych`/`resolvePsychAI`/`pendingPsych`). Effets ±1 DR via `attackModifiers` (comme Taille/Peur) ; Soc via `skills.ts testValue` ; contrainte d'action via `ai.ts`. Spec : `docs/superpowers/specs/2026-06-07-psychologie-design.md` (§3-7).

**Tech Stack :** TypeScript, Vitest (TDD), RNG seedable.

---

## File Structure

| Fichier | Modif | Responsabilité |
|---|---|---|
| `src/engine/groups.ts` | CREATE | `groupsFor({folder,species,career,extras})`, `groupMatch(cible,groups)`, table folder→catégorie, espèce→racial. Pur. |
| `src/engine/psychology.ts` | EDIT | `parsePsychTraits` retourne aussi `psychTraits[]` (Animosité/Haine/Préjugé/Amour/Camaraderie (X), Phobie(X)→Peur 1, « un au choix »→inerte) ; `targetedTrigger(self, visibles)` ; `resolveCalmeSimple(calme,rng)`. |
| `src/engine/types.ts` | EDIT ⚠️ | `PsychAffliction` déjà OK (réutilisé). Rien à ajouter (groups/psychTraits déjà là). |
| `src/state/scene.ts` | EDIT ⚠️ | `CustomStatblock.groups?: string[]` (extras manuels). |
| `src/state/spawn.ts` | EDIT ⚠️ | `groups` + `psychTraits` dérivés au spawn (créature folder ; statbloc species/career/extras). |
| `src/engine/character.ts` | EDIT ⚠️ | `groups` du héros (espèce + carrière). |
| `src/state/combatFlow.ts` | EDIT ⚠️ | `collectHeroPsych`/`resolvePsychAI` étendus aux ciblés (après Peur/Terreur). |
| `src/state/store.ts` | EDIT ⚠️ | `PendingPsych.kind` étendu ; `psychRoll`/`psychConfirm` gèrent les ciblés (affliction active / re-test). |
| `src/engine/combat.ts` | EDIT ⚠️ rig | `attackModifiers` : +1 DR Animosité/Haine/Amour/Camaraderie ; immunités Haine/Amour. |
| `src/engine/skills.ts` | EDIT | `testValue` : −20 Animosité / −10 Préjugé Soc vs le groupe. |
| `src/state/ai.ts` | EDIT ⚠️ | contrainte de cible (Animosité/Haine active → vise le groupe). |

---

## Task 1 : `engine/groups.ts` — dérivation & matching

**Files:** Create `src/engine/groups.ts`, `src/engine/groups.test.ts`.

- [ ] **Step 1 : tests**

```ts
import { groupsFor, groupMatch } from './groups';
it('folder créature → catégorie', () => {
  expect(groupsFor({ folder: 'Les hordes de peaux-vertes' })).toContain('Peau-Verte');
  expect(groupsFor({ folder: 'Les morts sans repos' })).toContain('Mort-vivant');
  expect(groupsFor({ folder: 'Hommes-bêtes, les enfants du Chaos' })).toContain('Homme-bête');
  expect(groupsFor({ folder: 'Les bêtes du Reikland' })).toContain('Bête');
  expect(groupsFor({ folder: 'Hommes-bêtes, les enfants du Chaos' })).not.toContain('Bête'); // spécificité
  expect(groupsFor({ folder: 'Princes démons' })).toContain('Démon');
  expect(groupsFor({ folder: 'Les ignobles hommes-rats' })).toContain('Skaven');
});
it('espèce → racial + carrière + extras (dédup, normalisé)', () => {
  const g = groupsFor({ species: 'Humains (Reiklander)', career: 'Soldat', extras: ['Sigmarite'] });
  expect(g).toEqual(expect.arrayContaining(['Humain', 'Soldat', 'Sigmarite']));
});
it('groupMatch : insensible casse/accents', () => {
  expect(groupMatch('Elfes', ['Elfe'])).toBe(true);      // Cible pluriel vs groupe singulier
  expect(groupMatch('mort-vivant', ['Mort-vivant'])).toBe(true);
  expect(groupMatch('Nains', ['Humain'])).toBe(false);
});
```

- [ ] **Step 2 : échec** (`groupsFor`/`groupMatch` non définis).

- [ ] **Step 3 : implémenter** (`engine/groups.ts`)

```ts
import { norm } from '../lib/normalize';

/** Folder bestiaire (`creatures.json`) → catégorie de Groupe. Règles ORDONNÉES (la plus spécifique
 *  d'abord : « hommes-bêtes » avant « bêtes »). Mot-clé normalisé cherché dans le folder normalisé. */
const FOLDER_RULES: { kw: string; group: string }[] = [
  { kw: 'peaux-vertes', group: 'Peau-Verte' },
  { kw: 'morts sans repos', group: 'Mort-vivant' },
  { kw: 'hommes-betes', group: 'Homme-bête' },
  { kw: 'hommes-rats', group: 'Skaven' },
  { kw: 'demon', group: 'Démon' },          // « Démons » et « Princes démons »
  { kw: 'cultistes', group: 'Cultiste' },
  { kw: 'betes', group: 'Bête' },           // après hommes-bêtes
];

/** Espèce (label data) → racial. Strip de la sous-espèce entre parenthèses ; pluriel→singulier connu. */
const SPECIES_RACIAL: { kw: string; group: string }[] = [
  { kw: 'humain', group: 'Humain' },
  { kw: 'halfling', group: 'Halfling' },
  { kw: 'nain', group: 'Nain' },
  { kw: 'elfe', group: 'Elfe' },
  { kw: 'gnome', group: 'Gnome' },
  { kw: 'ogre', group: 'Ogre' },
];

function categoryFromFolder(folder: string): string | null {
  const n = norm(folder);
  for (const r of FOLDER_RULES) if (n.includes(r.kw)) return r.group;
  return null;
}
function racialFromSpecies(species: string): string | null {
  const n = norm(species);
  for (const r of SPECIES_RACIAL) if (n.includes(r.kw)) return r.group;
  return null;
}

/** Groupes d'appartenance d'un combattant (mots-clés multiples) : catégorie(folder) ∪ racial(espèce)
 *  ∪ carrière ∪ extras manuels. Dédupliqué (clé normalisée), ordre stable. */
export function groupsFor(src: { folder?: string | null; species?: string; career?: string; extras?: string[] }): string[] {
  const out: string[] = [];
  const push = (g?: string | null) => { if (g && !out.some((x) => norm(x) === norm(g))) out.push(g); };
  if (src.folder) push(categoryFromFolder(src.folder));
  if (src.species) push(racialFromSpecies(src.species));
  if (src.career) push(src.career);
  (src.extras ?? []).forEach(push);
  return out;
}

/** La Cible d'un trait psy (« Elfes », « Mort-vivant »…) correspond-elle à l'un des `groups` ? Comparaison
 *  normalisée + tolérance pluriel (« Elfes » ⟺ « Elfe ») : on teste l'inclusion de radical dans les deux sens. */
export function groupMatch(cible: string, groups: string[]): boolean {
  const c = norm(cible).replace(/s$/, '');
  return groups.some((g) => { const n = norm(g).replace(/s$/, ''); return n === c || n.includes(c) || c.includes(n); });
}
```

- [ ] **Step 4 : vert + typecheck.** Commit : `feat(psy): Groupes -- derivation (folder/espece/carriere/extras) + matching (P3)`

---

## Task 2 : `psychology.ts` — parsing des traits ciblés

**Files:** Modify `src/engine/psychology.ts`, `src/engine/psychology.test.ts`.

- [ ] **Step 1 : tests**

```ts
it('parsePsychTraits : traits ciblés → psychTraits', () => {
  const r = parsePsychTraits(['Animosité (Elfes)', 'Haine (Skavens)', 'Préjugé (Nains)', 'Amour (Famille)', 'Camaraderie (Soldats)', 'Phobie (Araignées)']);
  expect(r.psychTraits).toEqual(expect.arrayContaining([
    { type: 'animosite', cible: 'Elfes' },
    { type: 'haine', cible: 'Skavens' },
    { type: 'prejuge', cible: 'Nains' },
    { type: 'amour', cible: 'Famille' },
    { type: 'camaraderie', cible: 'Soldats' },
    { type: 'phobie', cible: 'Araignées', indice: 1 }, // Phobie = Peur 1 sur la source
  ]));
});
it('parsePsychTraits : « un au choix » → cible indéfinie (inerte)', () => {
  const r = parsePsychTraits(['Animosité (un au choix)']);
  expect(r.psychTraits).toEqual([{ type: 'animosite', cible: undefined }]);
});
```

- [ ] **Step 2 : échec** (`psychTraits` absent du retour).

- [ ] **Step 3 : implémenter** — étendre `parsePsychTraits` :

```ts
const TARGETED: { re: RegExp; type: PsychType }[] = [
  { re: /^Animosit[ée]\s*\(([^)]*)\)/i, type: 'animosite' },
  { re: /^Haine\s*\(([^)]*)\)/i, type: 'haine' },
  { re: /^Pr[ée]jug[ée]\s*\(([^)]*)\)/i, type: 'prejuge' },
  { re: /^Amour\s*\(([^)]*)\)/i, type: 'amour' },
  { re: /^Camaraderie\s*\(([^)]*)\)/i, type: 'camaraderie' },
  { re: /^Phobie\s*\(([^)]*)\)/i, type: 'phobie' },
];
// dans la boucle, après les Peur/Terreur/Immunité :
for (const { re, type } of TARGETED) {
  const m = t.match(re);
  if (!m) continue;
  const raw = m[1].trim();
  const cible = /au choix/i.test(raw) || raw === '' ? undefined : raw; // « un au choix » → inerte
  const trait: PsychTrait = { type, cible };
  if (type === 'phobie') trait.indice = 1; // Phobie = Peur 1 (LDB 21 l.84-87)
  (out.psychTraits ??= []).push(trait);
}
```

Et la signature de retour : `{ causesPeur?; causesTerreur?; psychImmune?; psychTraits?: PsychTrait[] }`.

- [ ] **Step 4 : vert + typecheck.** Commit : `feat(psy): parsePsychTraits -- traits cibles (Animosite/Haine/Prejuge/Amour/Camaraderie/Phobie) (P3)`

---

## Task 3 : dérivation au spawn + héros + statbloc

**Files:** Modify `src/state/spawn.ts`, `src/engine/character.ts`, `src/state/scene.ts` ; Test `src/state/spawn-psych.test.ts`.

- [ ] **Step 1 : tests** (`spawn-psych.test.ts`)

```ts
import { creatureToCombatant } from './spawn';
import { findCreature } from '../data';
it('creatureToCombatant : groups dérivés du folder + psychTraits des traits', () => {
  const orc = findCreature('Orque')!; // folder « Les hordes de peaux-vertes »
  const c = creatureToCombatant(orc, 'e1', { x: 0, y: 0 });
  expect(c.groups).toContain('Peau-Verte');
});
```
*(Choisir une créature réelle ; vérifier son label/folder avant.)*

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
  - `scene.ts` `CustomStatblock` : ajouter `/** Groupes manuels supplémentaires (Sigmarite…). */ groups?: string[];`.
  - `spawn.ts` import `groupsFor` ; `creatureToCombatant` ajoute après `size,` : `groups: groupsFor({ folder: creature.folder }),`. `statblockToCombatant` : `groups: groupsFor({ species: undefined, career: undefined, extras: sb.groups }),`. (`parsePsychTraits` fournit déjà `psychTraits` via le spread.)
  - `character.ts` `createHero` : `groups: groupsFor({ species: sp.label, career: opts.careerLabel }),` dans l'objet `hero`.

- [ ] **Step 4 : vert + typecheck.** Commit : `feat(psy): derivation groups au spawn (creature/statbloc) + heros (P3)`

---

## Task 4 : déclenchement + résolution des traits ciblés (héros modale / IA)

**Files:** Modify `src/engine/psychology.ts`, `src/state/combatFlow.ts`, `src/state/store.ts` ; Test `src/state/psych-cible.test.ts`.

**Modèle :** un trait ciblé `self` se déclenche quand un **membre du groupe** `cible` est en **Ligne de Vue** (ennemi : animosite/haine/prejuge/phobie ; allié : amour/camaraderie). Test de Calme (Intermédiaire +0) ; échec → affliction active (`psychState`), re-testable à la fin de chaque Round pour y mettre fin. La Phobie passe par le canal Peur existant (Peur 1, source = le combattant). Amour/Camaraderie/Haine n'imposent pas de Brisé : un échec pose l'affliction (effets de combat/Soc/contrainte).

- [ ] **Step 1 : tests** — `collectHeroPsych` renvoie un trigger ciblé quand un membre du groupe est en LdV ; `psychConfirm` pose l'affliction sur échec ; l'affliction est re-testée le Round suivant.

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
  - `psychology.ts` : `export function targetedTrigger(self, visible: Combatant[]): { type: PsychType; cible: string; sourceId: string } | null` — pour chaque `self.psychTraits` à `cible` définie non déjà en `psychState`, trouver un `visible` dont `kind` correspond (ennemi/allié selon type) ET `groupMatch(cible, v.groups)` ; renvoyer le 1er. `resolveCalmeSimple(calme, rng) → { success, roll, sl }`.
  - `combatFlow.ts` `collectHeroPsych` : après la Peur/Terreur, si rien, évaluer `targetedTrigger(c, visibleFoesAndAllies)` → renvoyer `{ kind, sourceId, indice: 0, prevDR: 0, cible }`. (Étendre le type de retour avec `cible?`.) Idem `resolvePsychAI` (instantané).
  - `store.ts` `PendingPsych.kind` : `'peur'|'terreur'|'animosite'|'haine'|'prejuge'|'amour'|'camaraderie'` (+`cible?`). `psychRoll` : pour un ciblé, `resolveCalmeSimple`. `psychConfirm` : ciblé raté → `psychState.push({ type, cible, sourceId, lastTestRound })` + journal ; réussi → rien (résisté). Re-test : `collectHeroPsych`/`resolvePsychAI` re-proposent une affliction ciblée active non testée ce Round → succès retire l'affliction.
  - Garde-fou « un jet = une modale » : `pendingPsych` déjà whitelisté (suffixe résolveur) — vérifier que la suite reste verte.

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `feat(psy): Tests de Psychologie cibles -- declenchement (LdV/groupe) + resolution (heros modale / IA) (P3)`

---

## Task 5 : effets de combat (±1 DR + immunités) dans `attackModifiers`

**Files:** Modify `src/engine/combat.ts` ; Test `src/engine/combat-psych.test.ts`.

LDB 21 : Animosité +1 DR vs groupe (l.22) ; Haine +1 DR vs groupe + immunité Peur/Intimidation de ce groupe (l.41) ; Amour +1 DR en défense des aimés + immunité Peur (l.74-77) ; Camaraderie +1 DR (l.79-82). « +1 DR » = `+10` ModLine (convention existante).

- [ ] **Step 1 : tests** — `attackModifiers(att, cibleDuGroupe, weapon)` inclut `+10` si `att` a Animosité/Haine active dont la Cible matche `cible.groups`.

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter** — dans `attackModifiers`, après la clause Peur :

```ts
// Animosité/Haine/Camaraderie ACTIVES : +1 DR contre un membre du groupe ciblé (LDB 21 l.22/41/82).
if (target) {
  const hostile = (attacker.psychState ?? []).some(
    (p) => (p.type === 'animosite' || p.type === 'haine' || p.type === 'camaraderie') && p.cible && groupMatch(p.cible, target.groups ?? []),
  );
  if (hostile) out.push({ label: 'Haine/Animosité', value: +10 });
}
```
(Import `groupMatch`. L'immunité Peur de Haine/Amour est gérée au déclenchement — Task 4/clause Peur : ne pas pousser le −10 Peur si l'attaquant a Haine/Amour active vs le groupe de la source.)

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `feat(psy): +1 DR Animosite/Haine/Camaraderie vs groupe + immunites (attackModifiers, P3)`

---

## Task 6 : Soc (−20/−10) + contrainte d'action (IA)

**Files:** Modify `src/engine/skills.ts`, `src/state/ai.ts` ; Tests `src/engine/skills-psych.test.ts`, `src/state/ai.test.ts`.

- [ ] **Step 1 : tests** — `testValue` d'un Test de Sociabilité visant un membre du groupe : −20 (Animosité) / −10 (Préjugé). `chooseEnemyAction` : ennemi avec Animosité/Haine active → vise un membre du groupe (le plus proche) plutôt que le plus faible.

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
  - `skills.ts` `testValue(...)` : paramètre/contexte cible — si le test est une Sociabilité et la cible est dans un groupe sous Animosité (−20) / Préjugé (−10) du testeur → appliquer le malus. *(Si `testValue` n'a pas la cible en contexte, ajouter un helper `socialPsychMod(tester, target)` consommé là où le test social est monté.)*
  - `ai.ts` `chooseEnemyAction` : si l'ennemi a une affliction `animosite`/`haine` active, restreindre les cibles aux membres du groupe haï visibles (s'il y en a) avant le tri (le plus proche). Réutilise `groupMatch`.

- [ ] **Step 4 : vert + typecheck + suite + recette (différée).** Commit : `feat(psy): Soc -20/-10 (Animosite/Prejuge) + contrainte de cible IA (Haine/Animosite) (P3)`

---

## Self-Review
- **Couverture spec §3-7** : Groupes (T1/T3) ✓ ; parsing ciblés + « un au choix » inerte (T2) ✓ ; déclenchement LdV/groupe + résolution héros/IA (T4) ✓ ; +1 DR & immunités (T5) ✓ ; Soc −20/−10 (T6) ✓ ; contrainte d'action IA (T6) ✓. *Contrainte d'action héros = journal + (UI grise les cibles : déféré P4/UI, documenté).* « doit insulter » (Préjugé) = journal (T4).
- **Types** : `psychTraits`/`groups` (déjà déclarés P1) consommés ; `PsychAffliction` réutilisé (ajout `cible` déjà présent). `PendingPsych.kind` étendu (T4) lu par `attackModifiers` via `psychState` (T5) — cohérent.
- **Placeholders** : aucun ; défaut MJ +0 ; immunités documentées.
- **Isolation rig** : `combat.ts` rig-hot (T5 : 1 clause ciblée) ; `types.ts` inchangé ; modales réutilisées (pas de fichier neuf) ; staging sélectif des partagés.
