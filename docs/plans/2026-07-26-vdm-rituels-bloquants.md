# 2026-07-26 — `2026-07-26-vdm-rituels-a-fusionner.json` n'est PAS fusionnable

Artefact daté. À supprimer une fois les deux blocages ci-dessous levés et le fragment fusionné
dans `src/data/spells.json`.

> Le nom du fragment (« …-a-fusionner ») promet un merge prêt. **Il ne l'est pas.** Mesure du
> 2026-07-26 : `schema.safeParse` (`src/data/schemas/defs/spells.ts`) rejette **17 entrées sur 17**.

## Mesure

| Instant | Rejets | Clé fautive |
|---|---|---|
| avant l'ajout de `isRitual` au schéma | 17/17 | `unrecognized_keys` : `isRitual`, `ritual` |
| après l'ajout de `isRitual` au schéma | 17/17 | `unrecognized_keys` : `ritual` |

Protocole : `schema.safeParse([entrée])` entrée par entrée, sur le fragment committé.

## Blocage A — l'anatomie de Rituel n'a pas de schéma

`spellEntrySchema` est un `z.strictObject`. Le fragment pose un sous-objet `ritual` qui n'y existe
pas, dont les clés observées sur les 17 entrées sont :

`type`, `typeOpen`, `domains`, `xp`, `xpReduced`, `niMods`, `components`, `conditions`,
`conditionTest`, `sacrifices`, `sacrificeTest`, `sacrificeOnFailure`, `sacrificeOps`,
`sacrificeMaison`, `consequences`, `consequenceOps`, `effects`, `cnFrom`, `manque`.

L'anatomie imprimée est `VDM 02 l.377-393` (NI, Type, PX d'apprentissage, Composants, Conditions,
Sacrifices, Conséquences, Description). Les clés `conditionTest` / `sacrificeTest` /
`sacrificeOnFailure` / `sacrificeOps` / `consequenceOps` / `effects` / `manque` / `sacrificeMaison`
n'y figurent pas : ce sont des extensions d'implémentation, à justifier une par une avant d'entrer
au schéma — la liste blanche `VARIANT_RESOLVED_FIELDS` n'admet un champ qu'une fois son
consommateur RÉEL nommé, et la même exigence vaut ici.

Manque aussi le CONSOMMATEUR : aucun code ne lit aujourd'hui un sous-objet `ritual`. Un schéma
posé sans consommateur reproduirait à l'envers le défaut que ce lot vient de corriger sur
`isRitual` (type qui promet, schéma qui refuse).

## Blocage B — `cn: null` est DÉJÀ pris : il signifie Prière

Trois rituels du fragment portent `cn: null` + `ritual.cnFrom` en prose :

| id | `ritual.cnFrom` |
|---|---|
| `les-faux-croisees` | « Force Mentale de l'entité » |
| `invocation-de-demon` | « Force Mentale du démon » |
| `lier-une-bete-monstrueuse` | « égal aux Points de Blessure de la Bête » |

`cn == null` est lu comme « Prière » par trois sites :

- `src/state/combatFlow.ts:843` — `previewCast` : libellé de la modale (« Test de Prière »)
- `src/ui/CastModal.tsx:89` — même bascule d'affichage
- `src/state/combatSlice.ts:2962` — **budget de Surincantation calculé avec `ni = 0`**

Ce dernier n'est pas cosmétique : un Rituel à `cn: null` verrait tout son DR converti en surplus de
Surincantation. (La branche de résolution elle-même reste sauve : `castInfo`
(`src/engine/magic.ts:94`) lit `isPrayer`, pas `cn`.)

Fusionner ces trois entrées telles quelles est donc exclu. Il faut d'abord une façon d'exprimer
« NI non chiffré, dérivé d'une autre entité » qui ne soit pas `null` — et le vocabulaire `Formula`
(`src/engine/ops.ts`) ne suffit pas en l'état : ses résolveurs prennent pour sujet le LANCEUR
(`OpsCtx.caster`), alors que les trois NI ci-dessus se lisent sur la CIBLE de l'invocation
(l'entité, le démon, la Bête), qui n'existe pas encore au moment du Test.

## Ce qui reste bon dans le fragment

L'extraction elle-même (verbatim `desc`, `source` au folio, `sacrificeMaison` portant son
arbitrage) et les 14 entrées à NI chiffré. Seul le contenant manque.
