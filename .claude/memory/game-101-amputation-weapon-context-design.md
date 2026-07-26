---
name: game-101-amputation-weapon-context-design
metadata: 
  node_type: memory
  type: project
  originSessionId: 748d9d74-6f65-4c5e-b1fd-ac5188f455e0
---

> **FAIT — `d0c7746a`** (suite 8218 verte, #101). Note conservée pour le RATIONALE : pourquoi la pénalité
> d'amputation est CONTEXTUELLE À L'ARME, et jamais le charMod naïf que proposait l'issue.

**Ce que la pénalité d'amputation ne doit JAMAIS être** : un `charMod` CC/CT porté par le Trauma, ni une
pénalité gatée sur la main dominante (`loc==='brasD'` seul → une amputation au bras GAUCHE ne coûterait rien).

**Design VERROUILLÉ avec l'user** (≠ le « fix proposé » NAÏF de l'issue) :
- L'issue propose un charMod CC/CT INCONDITIONNEL → **rejeté** : ça sur-pénalise une arme à 1 main tenue dans la
  main SAINE quand l'autre est blessée. Le RAW dit « −5 à tous les Tests qui **impliquent cette main** » (LDB 18
  l.251 doigts) / « −20 aux Tests qui **utilisent cette main** » (l.263 main).
- Modèle RAW-précis : pénalité = **modificateur contextuel au jet d'ARME**, appliqué ssi l'arme IMPLIQUE la main
  blessée. `weaponUsesHand(weapon, side)` : 2 mains → les DEUX ; 1 main → la main de tenue (`weapon.hand==='off'`
  = gauche, sinon droite/dominante). Côté blessé = `loc` de la Trauma (brasD=droite, brasG=gauche).
- Clause secondaire (l.263) : si la MAIN PRINCIPALE (brasD) est PERDUE (`main-bras-ampute`@brasD), −20 additionnel
  aux jets utilisant la main SECONDAIRE (on se bat de la main gauche maladroite). `maxWeaponHands:1` force déjà
  l'arme dans la main restante → pas de double-comptage.

**Câblage en place** : `permanentAmputations` (`critical.ts`) et `consolidateAmputations` (`trauma.ts`) ne
posent que `maxWeaponHands` — la donnée par-main vit dans les Traumas (`location` + `count`).
`weaponUsesHand` / `amputationCombatPenalty(c, weapon)` (`trauma.ts`) sont lues par `attackModifiers` et
`defenseModifiers` (`combat.ts`). `fingersLost` est la source UNIQUE du comptage de doigts perdus par
Localisation, réutilisée par `maxFingersLostForWeapon` pour l'escalade de Maladresse par doigt (LDB 18 l.251,
#144) — jamais un recomptage dupliqué. Couverture : `src/engine/amputation-combat.test.ts` (gauche doigts +
arme 2 mains = −5/doigt ; la même avec une arme à 1 main tenue à DROITE = **0** ; main principale perdue →
−20 sur l'arme de la main gauche).

Voir aussi [[game-trauma-ops-passive-collector]] (collecteur passif), [[feedback-effet-existant-general-parametrable]].
