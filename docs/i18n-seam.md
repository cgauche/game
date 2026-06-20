# Seam i18n — conception (fondation multi-langue)

> Spec de conception (2026-06-20). **But** : rendre l'app traduisible SANS livrer une 2ᵉ langue
> maintenant (« pouvoir gérer un jour le multi-langue »), et SANS marcher sur la lane Flow/narration
> de la session parallèle (qui unifie `flowOutcomes`/`result.log`). À brancher **par phases**.
> Ancré sur l'audit multi-agents du 2026-06-20 (symboles réels du dépôt).

**État (2026-06-20)** : **Phase A ✅** (primitive `src/i18n/` livrée) + **Phase B ✅** pour les **7 maps de
labels du moteur** (`CHAR_LABELS`/`DIFFICULTY_LABELS`/`HIT_LOCATION_LABELS`/`DEFENSE_LABEL`/`FREE_ATTACK_LABEL`/
`BODY_SHAPE_LOC_LABELS`/`CIBLE_LABEL` → catalogue, parité verbatim, suite verte). Restent : `refLabel`
locale-aware · **Phase D** (UI) · **Phase C** (narration de combat, *gated* sur la session //).

## But & contraintes

- Multi-langue à terme → **aucun label/clé en dur** ; chaque texte utilisateur passe par une **clé stable**.
- FR = première (et seule livrée) locale ; ajouter une langue ne doit **rien changer à la logique**.
- **Moteur pur** : le moteur émet des CLÉS stables (+ params), **jamais** du texte de présentation final.
- **Ne pas doubler la session parallèle** : la narration de combat (`result.log`, `flowOutcomes`) est SON
  chantier ; le seam i18n s'y **branche** (chaque ligne de narration devient un `t(key, params)`), il ne
  la réécrit pas. C'est la **synergie** : narration unifiée + i18n = un seul geste.

## État des lieux (audit 2026-06-20)

- **Zéro infra i18n** : pas de `t()`, pas de catalogue, pas de locale (confirmé par balayage).
- **Données DÉJÀ prêtes** : entités à `id` stable + `label` ; points de résolution **UNIQUES**
  `refLabel(cat, ref)` (`src/data/index.ts`), `conditionLabel`, `skillRefLabel`, `skillInstanceLabel`.
  → swapper la source de label par locale est **localisé** (la couche données est i18n-ready par construction).
- **Blocage = texte FR PRÉ-RENDU produit par le moteur / le state** :
  - **maps de labels** : `CHAR_LABELS` / `HIT_LOCATION_LABELS` / `DIFFICULTY_LABELS` (`engine/types.ts`),
    `DEFENSE_LABEL` / `FREE_ATTACK_LABEL` (`engine/combat.ts`), `CIBLE_LABEL` (`engine/psychology.ts`) ;
  - **narration** : `describeTestRoll` (`engine/ops.ts`, code en dur « réussite »/« échec »), ~40 littéraux
    dans `applyOps` (`ops.ts`), `CombatEvent.text` (`state/combatLog.ts` stocke du FR **déjà composé**),
    `flowOutcomes.describe*` + labels de cascade (`combatFlow` / `combat/roundHooks` / `rollFlows`).

## Architecture cible

### 1. Primitive — `src/i18n/` (pur)
- `messages/fr.ts` : catalogue **plat** `Record<string, string>` à patrons : `'test.success': '{actor} réussit (DR {sl}).'`.
- `index.ts` : `type Locale = 'fr'` ; `let locale: Locale = 'fr'` ; `setLocale(l)` ; `t(key: MsgKey, params?: Record<string, string|number>): string` (interpole `{param}`) ; `type MsgKey = keyof typeof fr` → **clé absente = erreur de compilation**.
- **Pur** (aucun React/DOM) → importable par le moteur **sans casser sa pureté** (peer module, comme `src/data`).

### 2. Deux modes de résolution
- **Labels éphémères (UI + maps carac/localisation/difficulté)** : `t(key, params)` résolu **au rendu**.
  Les maps deviennent **dérivées du catalogue** (`CHAR_LABELS[k] = t('char.' + k)`) → **consommateurs inchangés**.
- **Narration PERSISTANTE (journal de combat)** : **événement structuré** — stocker `{ key, params }`
  (pas une string), résolu à l'affichage. Avantages : le journal se **re-rend dans la locale courante** ;
  le moteur **émet des clés**, l'UI **résout**. C'est l'extension naturelle du `result.log` unifié par la
  session // : `result.log: string` → `result.log: MsgRef` (`{ key, params }`), `JournalLine` résout via `t()`.

### 3. Données (label / desc)
- `refLabel` / `conditionLabel` / `skillRefLabel` → lookups **par locale** (FR par défaut). Les `label` des JSON
  restent la locale FR ; une 2ᵉ langue = un **fichier de surcharges `id → label`** par catégorie (zéro duplication
  des données). Les `desc` (prose) : plus basse priorité → fichier de locale séparé quand une 2ᵉ langue arrive.

## Plan par phases (coordonné)

| Phase | Contenu | Timing |
|---|---|---|
| **A — primitive** | `src/i18n/` (t / catalogue / MsgKey / locale) + garde-fou + test | **SÛRE maintenant** (additif, zéro consommateur imposé) |
| **B — maps de labels stables** | router `CHAR_LABELS`/`HIT_LOCATION_LABELS`/`DIFFICULTY_LABELS`/`DEFENSE_LABEL`/`FREE_ATTACK_LABEL`/`CIBLE_LABEL` sur le catalogue (définitions stables) + `refLabel` locale-aware | **SÛRE** — ⚠️ NE PAS toucher les BUILDERS qui les consomment (`describeTestRoll`/`applyOps` = lane //) |
| **C — narration** | chaque ligne `flowOutcomes`/`result.log` → `t(key, params)` (ou `result.log: MsgRef`) | **APRÈS** l'unification de la session // (RIDE dessus = 1 refacto au lieu de 2) |
| **D — UI** | libellés menus/boutons (`src/ui`) → `t()` | hors lane // — à tout moment |
| **E — données desc** | fichiers de locale | quand 2ᵉ langue concrète |

## Coordination avec la session // (la synergie)

La session // pose `result.log: string` (FR composé) comme **source unique** de narration de combat.
**Proposition** : que ce `result.log` soit construit via `t(key, params)` (ou typé `MsgRef`), de sorte que :
- leur **unification de narration** ET le **seam i18n** soient **le même geste** (chaque `describe*` / ligne = un `t()`) ;
- le moteur **émette des clés**, l'UI **résolve** → pureté + traduisibilité **d'un coup**, zéro duplication.

Si elles préfèrent garder `string` pour l'instant : la Phase C se fait **après**, en remplaçant les littéraux
par `t()` **au point unique** `flowOutcomes` (déjà centralisé par elles → aucune dispersion).

## Garde-fou (anti-régression)

- Test statique `no-new-hardcoded-labels` : interdit les **littéraux de texte utilisateur NEUFS** dans
  `engine/` + `state/` hors catalogue (**baseline** = l'existant, on n'en AJOUTE pas) + règle ESLint ciblée.
  Incrémental : la dette existante est tolérée (liste de référence), seules les **nouveautés** sont bloquées.

## Non-objectifs (maintenant)

- Livrer une 2ᵉ langue (contenu de traduction).
- Extraire les ~40 littéraux `applyOps` **avant** que la narration soit unifiée (on attend la session //).
- Re-rendu live au **changement** de locale en cours de partie (locale figée au lancement suffit en v1).

## Fichiers

- **Nouveaux** : `src/i18n/index.ts`, `src/i18n/messages/fr.ts`, `src/i18n/i18n.test.ts`.
- **Touchés par phase** : `engine/types.ts` / `engine/combat.ts` / `engine/psychology.ts` (maps, **Phase B**) ;
  `src/data/index.ts` (`refLabel` locale-aware, **Phase B**) ; `state/combatLog.ts` + `JournalLine` +
  `state/flowOutcomes.ts` (**Phase C**, coordonné avec la session //).

## Esquisse de la primitive (Phase A)

```ts
// src/i18n/messages/fr.ts
export const fr = {
  'test.success': '{actor} réussit (DR {sl}).',
  'test.failure': '{actor} échoue.',
  'char.CC': 'Capacité de Combat', /* … toutes les CharKey, localisations, difficultés … */
} as const;

// src/i18n/index.ts
import { fr } from './messages/fr';
export type MsgKey = keyof typeof fr;
type Params = Record<string, string | number>;
const CATALOGS = { fr } as const;
let locale: keyof typeof CATALOGS = 'fr';
export const setLocale = (l: keyof typeof CATALOGS) => { locale = l; };
export function t(key: MsgKey, params?: Params): string {
  const pat = CATALOGS[locale][key] ?? CATALOGS.fr[key] ?? key;
  return params ? pat.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : pat;
}
```
