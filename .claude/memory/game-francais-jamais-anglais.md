---
name: game-francais-jamais-anglais
description: "Règles et stats viennent des sources FR ; la VO désambiguïse, et ne fournit que la donnée MÉCANIQUE absente de la VF"
metadata:
  node_type: memory
  type: feedback
---

**Why:** la donnée du jeu est FR (CC/CT/F/E/I/Ag/Dex/Int/FM/Soc/B, pas WS/BS/S/T/W) ; parser l'anglais introduit du vocabulaire et des valeurs qui ne correspondent à rien dans la base.

**How to apply:** toute stat ou règle se lit dans `Source/` FR et doit pouvoir s'y recoller verbatim. Deux usages VO, et deux seulement : COMPRENDRE une VF ambiguë ou dérivée (utilisateur, 2026-06-23 : « en cas de question, regarde la VO ») ; FOURNIR une donnée mécanique (caractéristiques, traits, Taille, armure) absente du RAW FR après balayage du bon livre (utilisateur, 2026-07-20 : « pense aussi a regarder la VO pour les stats de ce que tu ne trouve pas dans la VF (regarde même les scénarios) ») — nombres, ids FR du catalogue et nom FR seulement, `source:` citant le livre VO réel. Aucune prose VO recopiée ni traduite, aucune citation VO.
