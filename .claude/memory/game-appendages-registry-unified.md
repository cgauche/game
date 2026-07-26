---
name: game-appendages-registry-unified
description: "cornes/queue = UN registre data-driven multi-vues (paquet parts/appendages/, 1 appendice = 1 def), référencé par id partout"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d554361-2e93-48b6-aa3d-8aeb9375d029
---

Cornes & queue du rig = **un seul registre**, le paquet `src/gameIso/rig/parts/appendages/`
(`index.ts` + `types.ts` + `_registry.generated.ts` + `defs/`) : `APPENDAGES` (id → `PartArt` 3 vues,
DÉRIVÉ des defs, `back = front` par défaut), `appendageArt(id)` (repli `cornes-generique`), helper
`appendageFeature(id, bone?, layer?)`. **1 appendice = 1 fichier `defs/<id>.ts` qui porte SON art** :
aucune string SVG inline hors des defs. 9 ids : `cornes-generique/taureau/demon/caprin/gor/
vestigiales`, `queue-generique/rat/fouet`. Ajouter un type = 1 def + `npm run gen`.

Référencé PAR ID depuis TOUS les chemins, résolu par la primitive UNIQUE `pickView` :
- têtes monstrueuses (`monster/defs` : `cornes:'cornes-taureau'`) → `monsterInjection`.
- `features` de créature (`appendageFeature('cornes-gor')`) → `featureToPart(f, scale, VIEW)`.
- overlays d'élément/état + `traitVisuals` → boucle d'overlays de `composeRig` (résout `RigOverlay.appendage`).
- `RaceFeature.appendage` ⊥ `svg` (svg:'' si appendage). `RigOverlay.appendage` idem.

**Pourquoi** (feedback user « garder de la cohérence, que chacun ne fasse pas sa propre tambouille » +
« data-driven, rien de hardcodé, pas de duplication ») : avant, 3 chemins incohérents — monster.cornes,
~13 creatures/defs + 4 elements/defs hardcodant `svg: OV_CORNES_X` MONO-VUE (cornes de face en profil),
Furie/démon bricolant un art par-vue inline. Le réflexe « ajouter un champ `appendage` = un 4e
mécanisme » était FAUX : la bonne réponse = tout replier sur la MÊME primitive `pickView` + une source.

**How to apply** : jamais d'art de corne/queue inline dans un def ou un overlay → référencer un id du
registre. La queue de TRAIT (`attaque-caudale`) est le def `queue-fouet` DU registre, rendue en DORSAL
par `traitVisuals` (`dorsalOverlays`, profondeur) : le registre porte l'ART, le mécanisme dorsal porte
la PROFONDEUR — pas un behind-on-bone. Vérif d'un tel refactor : rendu resvg
à l'œil PAR type + goldens (front/back doivent rester byte-identiques ; seul le profil bouge). Voir
[[game-tenues-defs-source-unique]],
[[credo-exemples-calibrants]], [[game-rig-datadriven-sweep]].
