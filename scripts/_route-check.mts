import { bodyPlanOf } from '../src/gameIso/rig/bodyPlan';
const labels = ["Humain","Nain","Halfling","Ogre","Araignée géante","Chien","Loup","Ours","Pigeon","Rat géant","Sanglier","Serpent","Basilic","Bête des marais","Demigriffon","Dragon","Fimir","Géant","Griffon","Hydre","Jabberslythe","Manticore","Pégase","Pieuvre des tourbières","Squig des cavernes","Troll","Vouivre","Orc","Gobelin","Snotling","Banshee","Fantôme","Goule de crypte","Loup funeste","Spectre de cairn","Squelette","Vampire","Zombie","Chamane-Brey","Gor","Minotaure","Ungor","Cultiste","Mutant","Guerrier du Chaos","Sanguinaire de Khorne","Démonette de Slaanesh","Hyppogriffe","Chauve-souris vampire (Varghulf)","Guerrier des clans","Rat ogre","Vermine de choc"];
const by: Record<string, string[]> = {};
for (const l of labels) { const p = bodyPlanOf(l); (by[p] ??= []).push(l); }
for (const p of ['biped', 'quadruped', 'winged', 'monolithic']) console.log(`[${p}] (${(by[p] ?? []).length}) : ${(by[p] ?? []).join(', ')}`);
