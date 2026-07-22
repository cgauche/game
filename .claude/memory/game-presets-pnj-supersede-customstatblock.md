---
name: game-presets-pnj-supersede-customstatblock
description: "Un PNJ de campagne (surtout nommé/récurrent) s'authore en PRESET (base créature globale par id + surcharges embarquées dans narratif.presetsPnj du paquet), PAS en CustomStatblock inline par scène. Supersède game-source-fr-campagne-custom pour les PNJ de campagne ; le one-shot inline reste libre."
metadata:
  type: project
---
**Livré #671 (2026-07-22).** La doctrine « créature d'aventure = `CustomStatblock` inline par scène »
([[game-source-fr-campagne-custom]]) ne passe pas à l'échelle d'EDO+EDOC (~90 PNJ nommés dont des
RÉCURRENTS multi-scènes : Josef Quartjin, Teugen, Magirius…) : duplication du statbloc à chaque scène,
aucune identité stable pour dialogue/portrait/art.

**Doctrine actée** : un PNJ de campagne s'authore en **PRESET** = `PresetPnj {id, base?: creatureIdGlobal,
profil?: Partial<CreatureData>, apparence?, portrait?, source?}` PORTÉ PAR LE PAQUET (`narratif.presetsPnj`,
JAMAIS `src/data` global — anti-spoiler, cf. [[game-campagne-json-portable-frontiere-reference-narratif]]).
Une scène le référence par **`presetId`** (`SceneEntity`/`AuthoredEnemy`) ; instancié = base globale
(`findCreatureById(base)`) + surcharges au spawn (`resolvePresetCreature`/`mergeCreatureProfile`,
`src/state/campaignData.ts` ; le tableau `traits`/`skills`/… du profil REMPLACE en bloc celui de la base).
Résolveur couche-seulement `presetPnjById` (#767). Édité à l'onglet Narratif de l'éditeur (#671 lot B).

**Portée** : SUPERSÈDE [[game-source-fr-campagne-custom]] pour les PNJ DE CAMPAGNE (récurrents/nommés). Le
`CustomStatblock` inline reste légitime pour un one-shot vraiment unique. Curation de masse (~90 PNJ EDO/EDOC)
= #680. Mode profil « carrière+niveau » (EDO App.2) déféré #773 ; illustration `portrait` = #696.
