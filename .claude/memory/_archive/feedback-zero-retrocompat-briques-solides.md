---
name: feedback-zero-retrocompat-briques-solides
description: "Aucune rétro-compat / union transitoire / deprecated / code mort / legacy / dette — migrations atomiques, briques solides"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e636cc63-4e05-4723-bc40-1452e878c0af
---

L'utilisateur a REJETÉ un plan parce qu'il s'appuyait sur des unions transitoires `(string | Ref)[]`, des
normaliseurs tolérant l'ancien format, des lookups dépréciés « gardés pour l'instant », et une « phase de
retrait plus tard ». Sa consigne : « Pas de rétro-compatibilité, de deprecated, de code mort, de legacy, de
dette technique, je veux des briques solides pour pouvoir construire dessus. »

**Why:** il construit par-dessus ; un format qui coexiste avec l'ancien = fondation molle. Il préfère un
blast radius plus large MAINTENANT à une dette qui traîne.

**How to apply:** migration = **atomique** (bascule type strict + script + TOUS les consommateurs + suppression
de l'ancien chemin, dans le MÊME commit vert) ; jamais deux formats en même temps ; nettoyer aussi la dette du
POC existant pendant qu'on y est (ex. `TraitList = (string|TraitInstance)[]` → `TraitInstance[]`) ; tests passent
aux fixtures du nouveau format (pas de tolérance string) ; pas de `@deprecated`/fallback « au cas où ». Distinguer
une vraie **frontière de couche** (instances résolues au runtime, label tapé par le MJ en authoring) d'un **shim**
de compat — la première est légitime, le second interdit. Prolonge [[game-flow-logic-authoring]] (No-debt strict)
et [[feedback-reutiliser-avant-reinventer]].
