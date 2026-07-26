---
name: game-frenchy-vo-bridge
description: "Mapper un terme frenchy.bzh vers notre donnée = via la colonne VO de l'Annexe, PAS la colonne « Khaos Project » (≠ Cubicle7-FR)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 583862c1-7e63-4e95-b150-b9b93ba918ab
---

Pour rattacher un talent/compétence/trait de la source fan **frenchy.bzh** à NOTRE donnée (`src/data/*.json`, sourcée Cubicle7-FR = LDB/AA/ZI), passer par la **colonne VO** des Annexes B/C/D du guide frenchy (`Source/Warhammer - Habitants & Créatures du Vieux-Monde (Discord) PDF/81-83 - Annexe …`), **PAS** la colonne « Traduction Officielle (Khaos Project) » — Khaos est une AUTRE trad fan qui **diverge parfois** de Cubicle7-FR.

**Pièges vérifiés (Khaos ≠ notre FR) :**
- *Craftsman* : Khaos « Artisan », mais notre LDB = **« Maître artisan »** (`maitre-artisan`, LDB l.615 « ajoute Métier à la carrière »). *Master Tradesman* = **« Travailleur qualifié »** (`travailleur-qualifie`, LDB l.147). → ne pas conclure « Artisan absent » : il existe sous « Maître artisan ».
- *Crew Commander* : Khaos « Officier de Siège », mais AA = **« Commandant d'équipe »** (`commandant-d-equipe`).
- *Gunner* : Khaos/officiel « Fusilier », mais notre LDB/AA = **« Artilleur »** (`artilleur`).

**Conséquence :** toute table de correspondance bâtie sur la colonne Khaos marque à tort « absent de notre donnée » des talents qui EXISTENT sous un autre nom FR. Toujours re-vérifier via VO + l'effet dans la source FR autorisée avant de conclure « absent ».

**Avant de dire « absent », vérifier la DONNÉE RÉELLE (`src/data/creatures.json`), PAS une table de correspondance ni un registre de CODE (`engine/traits/registry.ts`).** Le nettoyage `1768092` avait déjà correctement remappé la quasi-totalité des libellés frenchy (talents ET traits ET compétences) vers leur nom officiel : mes « talents/traits perdus » étaient ~tous des FAUX POSITIFS (libellé officiel ≠ libellé frenchy normalisé). Ex : le trait `Redoutable 2` (ZI/Grim) est porté par ~30 créatures sans porter d'effet codé côté moteur → chercher son entrée dans le code renvoie « absent » à tort. Le user a corrigé 3× : « Fusilier est dans AA » → Artilleur, « Regarde la VO » → Artisan=Maître artisan, « j'avais rajouté les trait ZI » → Redoutable déjà sur les créatures. Vraies lacunes trouvées = SEULEMENT côté talents (Fusilier/Artilleur, Vigilance, Effraction, Pas de Côté, Détection d'artefact, Artisan) ; traits/compétences = 0 à restaurer. Prolonge [[game-frenchy-bzh-creatures]] + [[credo-exemples-calibrants]].

**Édition JSON `src/data/*.json` (piège Windows) :** écrire avec `json.dumps(data, ensure_ascii=False, indent=2)` ET `io.open(path,'w',encoding='utf-8',newline='')` — le mode texte Python sur Windows traduit `\n`→`\r\n` (CRLF) et casse le round-trip byte-fidèle de `serialize.test.ts`. Vérifier `raw.count('\r')==0` après écriture.
