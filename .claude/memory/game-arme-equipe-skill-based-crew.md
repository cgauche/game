---
name: game-arme-equipe-skill-based-crew
description: "Arme d'équipe N — l'effectif d'une pièce ne compte QUE les servants ayant la Projectiles du bon groupe (RAW AA 10 l.230)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 03105508-1981-4187-b39c-23c39463ada6
---

RAW « Arme d'équipe N » (Aux Armes ch.10, `Source/WH - V4 - Aux Armes/10 - L'ARTILLERIE ET LES DÉGÂTS INFLIGÉS AUX STRUCTURES.md` l.228-259) :
- **Tous les membres de l'équipe doivent posséder la Projectiles APPROPRIÉE au groupe de la pièce pour COMPTER** (l.230). Un membre au mauvais groupe NE compte PAS (Exemple 1 l.253 : Projectiles **Arc** ≠ baliste qui est groupe **Arbalète** → la pièce reste en sous-effectif).
- L'équipe **nomme l'un d'entre eux** (= le CHEF, `crewIds[0]`) pour faire le Test de Projectiles (le tir) (l.230). Les autres qualifiés comptent pour l'Indice (anti sous-effectif).
- Les membres **supplémentaires / non qualifiés** (l.232) « aident à la déplacer ou compenser les pertes » mais **n'ont AUCUN impact sur l'efficacité** → ce sont des **AIDES**, ils ne comptent pas dans l'effectif.
- Sous-effectif (table l.236-241, cumulatif l.243) : recharge ×2, puis Défaut Imprécise, puis Dangereuse. Un Défaut déjà porté re-reçu → −10 plat (l.245). Un seul firer qualifié PEUT tirer (Ex.2 l.255 Von Meinkopt, juste plus lent).

IMPLÉMENTATION (RAW-correcte, NE PAS régresser) : `servingCrewPresent` (`src/state/shipPostes.ts`) compte les `crewIds` aptes (`exposedCrew`) ET qualifiés (`hasWeaponGroupSkill(c, engine, 'ranged')`, groupe lu sur `poste.item.weaponGroup`). C'est VOULU — j'ai voulu le « simplifier » en comptant les corps chauds, c'était FAUX (le RAW exige la compétence). Mécanique de tir/recharge : `src/engine/crewedWeapon.ts` (`crewedPenalty`, `crewedFireWeapon`, ×2 recharge).

PIÈGE DONNÉE : un servant de scène doit AVOIR la Projectiles du groupe de sa pièce, sinon effectif 0 et la pièce ne s'arme pas. Le crew générique (`garde-du-village`=Arc, `brigand`=Arc) ne suffit pas. Canal : `SceneEntity.combat.skills` → `SpawnExtras.skills` mergé sur la créature `ref` au spawn (`spawn.ts creatureToCombatant`) + `AuthoredEnemy.skills` (encounter). Mapping siège : baliste→arbalète, canon→poudre-noire, catapulte→catapulte (lus du `weaponGroup` du trapping).

SERVIR EN ÉQUIPAGE (≠ takeover) : `serveAtPoste` — pièce libre → chef (`crewIds[0]`, arme dérivée, tire) ; pièce déjà servie → append en SUPPORT (`mannedPoste`, compte si qualifié, PAS d'arme). Tooltip pièce : « Effectif (qualifié) N/M », « Renforts (qualifiés) » vs « Aides (non qualifiées) », + carte active-héros « ✅/⚠ Servir — qualifié/NON qualifié » (idée user, calquée sur la carte d'attaque).
