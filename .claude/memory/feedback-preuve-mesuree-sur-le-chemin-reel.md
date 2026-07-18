---
name: feedback-preuve-mesuree-sur-le-chemin-reel
description: "Une preuve mesurée sur un chemin OPTIONNEL ne prouve rien du cas normal — incident 2026-07-18 : « couture fermée, distance RGB 4,9 » était mesuré en forçant appearance.colors ; sans lui, 174 paires sur 210 avaient une couture > 30"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
---

**Incident (2026-07-18)** : un fix de socle (« `g_flesh` dérivé de la peau du personnage ») a livré une preuve chiffrée impeccable — « avant-bras `[48,30,20]` vs main `[52,32,22]`, distance RGB **4,9**, couture fermée ». J'ai accepté le chiffre. Un juge adversarial a re-mesuré **sans forcer `appearance.colors`** (une personnalisation OPTIONNELLE, `src/gameIso/rig/appearance.ts:27`, non renseignée par défaut) : sur 21 races × 10 tenues, **174 paires sur 210 avaient une couture > 30 RGB, jusqu'à 227**. La preuve avait été mesurée sur le SEUL chemin qui contourne le bug.

**Why :** un agent qui construit son propre banc de mesure choisit — souvent sans malice — le chemin le plus commode à instancier. Ce chemin est rarement le chemin NORMAL du produit. Un chiffre précis (« 4,9 ») inspire une confiance que sa méthode ne mérite pas : la précision de la mesure ne dit rien de la représentativité du cas mesuré.

**How to apply :**
- **Exiger que la preuve nomme son CHEMIN**, pas seulement son résultat : « mesuré sur quoi, avec quels champs renseignés, et est-ce le défaut du produit ? ». Un brief doit dire « **sans jamais forcer <le champ optionnel>** » quand un tel champ existe.
- **Un cas unique n'est pas une preuve de classe.** Exiger une MATRICE (ici : 4 tenues × 3 vues × 3 espèces contrastées dont une non-humaine), pas un point choisi. Le point choisi est toujours le plus favorable.
- **Se méfier des chiffres qui tombent trop bien.** « 4,9 » sur un seuil implicite de 30 aurait dû déclencher la question « et sur les autres cas ? » — c'est le symétrique de [[feedback-un-detecteur-ne-mesure-que-sa-couverture]] : là le détecteur bornait son angle mort, ici le banc bornait son échantillon.
- Corollaire déjà vécu le même jour : **mesuré ≠ perçu** ([[user-barre-art-relevee-2026-07-16]]) et **une part isolée ≠ le rendu composé** (incident Cultiste). Trois formes du même piège : la preuve est valide dans son cadre et le cadre n'est pas le produit.

Lié : [[feedback-verifier-les-claims-architecturaux-des-agents]], [[feedback-audit-obligatoire-avant-annonce-de-fermeture]], [[game-test-de-cablage-vs-ctx-forge]] (même famille : une clé testée par un ctx forgé au lieu du flux réel).
