# Cycle jour/nuit — exposition éditeur (#T1c, plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (INLINE — fichiers chauds éditeur édités par d'autres sessions //). Étapes en `- [ ]`.
> ⚠️ Fichiers chauds (`EffectList.tsx`, `Editor.tsx`) → relire l'ancre avant chaque edit ; committer **uniquement mes hunks** (marqueurs : `setTime`/`exterieur`/`DAY_PHASES`). Terminer les commits par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

**Goal:** Rendre éditables dans l'éditeur les deux nouveautés #T1c : le contrôle `ambiance` (Intérieur/Extérieur) et l'Effet `setTime` (constructeur d'Effets).

**Architecture:** `EffectList.tsx` (constructeur d'Effets partagé triggers/dialogues) gagne `setTime` dans `EFFECT_TYPES` + `newEffect` + un formulaire (sélecteur de phase). `Editor.tsx` réduit le menu `ambiance` de 4 à 2 options et n'a plus d'aperçu « nuit » authored (le jour/nuit est runtime via l'horloge).

**Spec:** `docs/superpowers/specs/2026-06-07-cycle-jour-nuit-design.md` §7.

---

## Task 1 : `EffectList.tsx` — Effet `setTime` éditable

**Files:** Modify `src/ui/editor/EffectList.tsx` (**CHAUD**) ; Modify `src/ui/editor/EffectList.test.tsx` (si existant).

- [ ] **Step 1 : Test qui échoue** — dans `EffectList.test.tsx` (vérifier l'import de `newEffect`), ajouter :
```ts
it('newEffect("setTime") crée un défaut phase nuit (#T1c)', () => {
  expect(newEffect('setTime')).toEqual({ type: 'setTime', phase: 'nuit' });
});
```
(Si `EffectList.test.tsx` n'existe pas, le créer avec l'import `import { newEffect } from './EffectList';` + ce test.)

- [ ] **Step 2 : Lancer → échoue** : `npx vitest run src/ui/editor/EffectList.test.tsx` (newEffect tombe dans `default` → `journal`, ≠ setTime).

- [ ] **Step 3 : Implémenter** (relire les ancres) :

3a. Import en haut (à côté des imports existants) :
```ts
import { DAY_PHASES, DayPhaseKey } from '../../engine/clock';
```
3b. Ajouter `'setTime'` à `EFFECT_TYPES` (avant `'endDialogue'`) :
```ts
  'setTime',
  'endDialogue',
```
3c. Ajouter le `case` dans `newEffect`, avant `default:` :
```ts
    case 'setTime':
      return { type: 'setTime', phase: 'nuit' };
```
3d. Ajouter le formulaire dans `EffectEditor` (parmi les blocs `{effect.type === 'X' && ...}`, p.ex. juste avant le bloc `endDialogue` ou à la fin) :
```tsx
        {effect.type === 'setTime' && (
          <label className="dr">
            Régler l’heure sur
            <select value={e.phase ?? 'nuit'} onChange={(ev) => onChange({ type: 'setTime', phase: ev.target.value as DayPhaseKey })}>
              {DAY_PHASES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.icon} {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
```
(L'éditeur expose la variante **phase** — friendly « passe à la nuit » ; la variante `hour` reste authored en data/JSON.)

- [ ] **Step 4 : Lancer → passe** : `npx vitest run src/ui/editor/EffectList.test.tsx` ; `npm run typecheck` (0 erreur).

- [ ] **Step 5 : Commit** — fichier **chaud** → commit isolé de mes hunks (marqueur `setTime`/`DAY_PHASES`).
```bash
# EffectList.tsx (+ .test.tsx si à moi) : -m "feat(temps): Effet setTime editable (selecteur de phase) (#T1c)"
```

---

## Task 2 : `Editor.tsx` — contrôle ambiance Intérieur/Extérieur

**Files:** Modify `src/ui/editor/Editor.tsx` (**CHAUD**).

- [ ] **Step 1 : Implémenter** (relire les ancres — lignes ~784 et ~913, susceptibles d'avoir bougé) :

1a. Remplacer le `<select>` ambiance (4 options) par 2 :
```tsx
                <select value={scene.ambiance === 'interieur' ? 'interieur' : 'exterieur'} onChange={(e) => setScene({ ...scene, ambiance: e.target.value as Scene['ambiance'] })}>
                  <option value="exterieur">Extérieur (jour/nuit = horloge)</option>
                  <option value="interieur">Intérieur (éclairé)</option>
                </select>
```
(Une scène legacy `'jour'/'nuit'/'foret'` s'affiche « Extérieur » via le ternaire `=== 'interieur' ? … : 'exterieur'`.)

1b. Aperçu bâtiments : le jour/nuit n'est plus authored → aperçu de jour. Remplacer `scene.ambiance === 'nuit'` (dans l'appel `buildingObj(..., scene.ambiance === 'nuit')`) par `false` :
```tsx
                if (layers.buildings) for (const b of scene.buildings ?? []) objs.push(buildingObj(b, dims, false, false)); // aperçu de jour ; le jour/nuit est runtime (#T1c)
```

- [ ] **Step 2 : Typecheck** : `npm run typecheck` (0 erreur).

- [ ] **Step 3 : Commit** — fichier **chaud** → commit isolé (marqueur `exterieur`/`#T1c`).
```bash
# Editor.tsx : -m "feat(temps): controle ambiance Interieur/Exterieur dans l'editeur (#T1c)"
```

---

## Task 3 : Vérification

- [ ] `npm test` + `npm run typecheck` verts ; golden-combat intact.
- [ ] Recette éditeur (si browser dispo) : l'éditeur propose Intérieur/Extérieur ; ajouter un Effet « Régler l’heure (jour/nuit) » sur un trigger, choisir une phase ; lancer la scène → l'horloge saute, la scène extérieure s'assombrit si « nuit ».

## Self-review
- **Couverture spec §7** : ambiance 2 options (T2) ; setTime dans le constructeur d'Effets (T1). ✓
- **Pas de placeholder** : code complet (EFFECT_TYPES, newEffect case, form select, ambiance select, buildingObj false). ✓
- **Cohérence** : `DayPhaseKey`/`DAY_PHASES` (clock) réutilisés ; le label `setTime` existe déjà dans `EFFECT_LABEL` (ajouté plan 1). ✓
- **Pièges** : fichiers chauds (commits isolés) ; l'éditeur n'expose que la variante `phase` de `setTime` (hour reste data) ; aperçu éditeur = jour (le jour/nuit est runtime).
