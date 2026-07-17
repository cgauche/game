import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TRAITS } from './registry';
import { parseTrait, formatTrait } from './dispatch';
import type { TraitInstance } from '../statEntry';
import { slugId } from '../../data/slug';

/**
 * Parité des Traits de créature (LDB 85). Le registre `TRAITS` est désormais DÉRIVÉ 1:1 de la donnée
 * (`traits.json`) — il n'y a plus de `defs/` mécaniques. Ce garde-fou vérifie donc :
 *  1. la DÉRIVATION est totale : chaque trait de `traits.json` est présent dans `TRAITS` (par id) ;
 *  2. la mécanique de CHAQUE trait est portée par un sous-système identifié — soit `dispatch`
 *     (capabilities/passive lus par les helpers), soit un AUTRE sous-système (creatureAttacks /
 *     psychology / disease / corruption), soit journal/MJ en conscience. Les maps ci-dessous
 *     DOCUMENTENT cette propriété (qui porte quoi) ; une nouvelle donnée non listée fait échouer (2).
 */

// Traits dont la mécanique vit AILLEURS que dans les helpers de `dispatch` (la raison est documentée).
const COUVERT_AILLEURS = new Map<string, string>([
  // Environnement aquatique (T2C p.90 / MDG p.140 / LDB p.338) — op passive `offTerrainMod` (terrain d’election `eau`) :
  // (1) le drapeau positionnel `Combatant.offTerrain`, re-derive par `placeCombatant` selon la tuile, module le M
  // (encumbrance) et le DR de TOUS les Tests (combat/magic/rollFlows) hors de l’eau ; (2) `eau` est TRAVERSABLE en
  // pathing (`MoveEnv.swim` <- `requiredTerrains`, path.ts). Mecanise + teste (off-terrain.test.ts / path-swim.test.ts).
  ['Aquatique', 'ne peut aller a terre (M->0, offTerrainMod mSet:0) + traverse l’eau a pleine vitesse (MoveEnv.swim)'],
  ['Amphibie', 'full M en eau + eau traversable (offTerrainMod{eau} sans malus + MoveEnv.swim) ; +BAg au DR des Tests de Natation = residuel (pas de Test de Natation authore)'],
  ['Créature marine', 'hors de l’eau M->1 + -2 DR a tous les Tests (offTerrainMod, positionnel via placeCombatant) + eau traversable (MoveEnv.swim) ; aspersion/suffocation narrees'],
  // Attaques naturelles et armement — engine/creatureAttacks.ts + spawn.weaponsFromTraits (grantsManeuvers)
  ['À distance', 'arme dérivée au spawn (weaponsFromTraits)'],
  ['Arme', 'arme dérivée au spawn (weaponsFromTraits)'],
  ['Attaque caudale', 'attaque gratuite (creatureAttacks.ts)'],
  ['Cornes', 'attaque gratuite à la Charge (creatureAttacks.ts)'],
  ['Morsure', 'attaque gratuite (creatureAttacks.ts)'],
  ['Souffle', 'attaque de zone (creatureAttacks.ts + combatFlow)'],
  ['Tentacules', 'attaques gratuites par tentacule, count× à coût 0 (creatureAttacks.ts + aiCreatureFreeAttacks)'],
  ['Étreinte glaciale', 'attaque-Action magique (creatureAttacks.ts + combatFlow)'],
  ['Langue préhensile', 'attaque gratuite à distance (creatureAttacks.ts)'],
  ['Hurlement fantomatique', 'cri de zone (creatureAttacks.ts + combatFlow)'],
  ['Regard pétrifiant', 'attaque-Action (creatureAttacks.ts + combatFlow)'],
  ['Vomissement', 'attaque de zone (creatureAttacks.ts + combatFlow)'],
  ['Hurlement de la Bête indomptable', 'cri de zone — manœuvre gratuite 1 Avantage, 3 Assourdi + Calme→3 Brisé (creatureAttacks.ts + combatFlow)'],
  ['Frisson paralysant', 'attaque-Action de mêlée magique, 1 Sonné/DR sans dégât (creatureAttacks.ts + combatFlow)'],
  ['Venin', 'Empoisonné sur PB infligés — `effects` AUTHORÉ du trait (Test de Résistance paramétré par l’arg, fireTriggers onHit)'],
  ['Constricteur', 'Empêtré sur touche — `effects` AUTHORÉ du trait (condition empetre, escapeStrength=Force, fireTriggers onHit)'],
  ['Absorption', 'engloutissement de fin de Round MÉCANISÉ 100% data-driven (`absorption.effects` : onRoundEnd Empêtré×BF + Empoigné + Digéré ; digestion drain BF ignore PA/BE + créature guérit ; redirection onWoundLoss ; un/Round ; purge à la mort) — dispatché par `fireTriggers`, cf. `absorption.test.ts` (EDO p.147)'],
  ['Vampirique', 'drain de PB sur Morsure (combatFlow.applyFreeAttackEffects — gating « kind=morsure » sans Condition Flow)'],
  ['Se cabrer', 'couvert par le Piétinement existant (LDB 85 — trampleTarget)'],
  // Bestiaire fluvial (T2C 15) — mécanique AUTHORÉE en `effects` (fireTriggers), comme Constricteur/Venin.
  ['S\'accrocher pour se nourrir', 'attache post-Morsure + drain 1 PB/Round — `effects` AUTHORÉ (condition empetre grapple onHit + wounds onRoundStart on grappled, fireTriggers)'],
  ['Engloutir', 'engloutit à la touche : Empêtré Force=créature + drain 1 PB/Round — `effects` AUTHORÉ (fireTriggers onHit + onRoundStart)'],
  ['Salive anticoagulante', 'Hémorragique sur Morsure — `effects` AUTHORÉ (condition hemorragique, fireTriggers onHit)'],
  ['Hallucinogène', 'aura 2 m au début du Round → Test de FM → Sonné — `effects` AUTHORÉ (déclencheur onRoundStart near, fireTriggers)'],
  ['Forme de guerrière naïade', 'socle Peur 2 + Armure 2 à onCombatStart (grantTrait, `effects`) ; les 4 aspects tournants restent en desc (choix par Round = hook IA à câbler)'],
  ['Capricieux', 'DR d’un Test de Sociabilité ENVERS la créature ±d10 (T2C p.89) MÉCANISÉ : modulateur `vsCapricieux` du Test social → `capriciousMod` (±10 par DR, d10 seedé UNE fois) dans `openSkillTest` ; authoré sur le Test d’un dialogue mené avec la créature, comme vsGroups (Animosité) / vsStatus (Statut) le sont (le contexte social de l’interlocuteur est authoré, pas auto-injecté depuis l’entité)'],
  // Psychologie — engine/psychology.ts (parsePsychTraits)
  ['Peur', 'causesPeur (parsePsychTraits)'],
  ['Terreur', 'causesTerreur (parsePsychTraits)'],
  ['Frénésie', 'isFrenzyCapable + flux de Frénésie'],
  ['Animosité', 'trait psy ciblé (parsePsychTraits)'],
  ['Haine', 'trait psy ciblé (parsePsychTraits)'],
  ['Préjugé', 'trait psy ciblé (parsePsychTraits)'],
  ['Effrayé', 'trait psy ciblé ≈ Peur 0 (parsePsychTraits)'],
  ['Amour', 'trait psy ciblé (parsePsychTraits)'],
  ['Camaraderie', 'trait psy ciblé (parsePsychTraits)'],
  ['Phobie', 'trait psy ciblé ≈ Peur 1 (parsePsychTraits)'],
  ['Immunité Psychologique', 'psychImmune (parsePsychTraits)'],
  // Afflictions transmises — engine/disease.ts + state/corruptionFlow.ts
  ['Maladie', 'contraction post-combat (disease.ts — Lot D) ; arg = la maladie (rats/skavens : fievre-du-rongeur)'],
  ['Infecté', 'Blessure Purulente post-combat (disease.ts — Lot D)'],
  ['Corruption', 'exposition du groupe (corruptionFlow — Lot E)'],
  // Invocation à la mort — op `summon` du Flow `onSlain`, moissonnée par notifySlain → summonFlow.applySummon
  ['Charnier', 'death-spawn : 3d10 Zombies à la mort (op summon onSlain → resolveTriggerImpureOps/applySummon)'],
  // Reconstitution différée — op `scheduleRespawn` du Flow `onSlain` : programme la ré-invocation à
  // gameTime + d10 j (file scheduledEffects, horloge) ; fireScheduledEffects → applySummon ; précautions = cancelFlag.
  ['Gardien éternel', 'reconstitution d10 j si tué (op scheduleRespawn onSlain → resolveTriggerImpureOps → fireScheduledEffects/applySummon ; précautions = cancelFlag), #19'],
  // Dressé (Magie) : trait MARQUEUR sans effet propre — lu par le gate `startleCause` de Nerveux
  // (Condition Flow `has dresse-magie` → exemption de l'effarouchement magique, LDB 85 l.89, données).
  ['Dressé (Magie)', 'marqueur lu par le gate `startleCause` de Nerveux (exemption magie, données)'],
]);

// Journal/MJ EN CONSCIENCE : pas d'effet moteur câblable sans système support — la desc (verbatim)
// est affichée à l'inspecteur ; rien d'inventé.
const JOURNAL_MJ = new Map<string, string>([
  ['Arboricole', 'bonus Escalade/Discrétion en forêt — pas de biome forêt mécanisé'],
  ['Limicole', 'pas de terrain marécageux à pénalité de Mouvement'],
  ['Grimpant', 'pas de système d’escalade (surfaces verticales)'],
  ['Pisteur', 'Pistage hors combat — arbitrage MJ'],
  ['Béni', 'Bénédictions de PNJ — pas de liste de prières dans la donnée (MJ)'],
  ['Miracles', 'Miracles de PNJ — pas de liste dans la donnée (MJ)'],
  ['Lanceur de Sorts', 'la donnée bestiaire ne liste pas les sorts connus → choix d’AUTEUR (éditeur : spells du spawn/statbloc) ; l’IA incante enemy.spells'],
  ['Mort-vivant', 'marqueur (consommé par Hurlement fantomatique, les Groupes et les contractions)'],
  // Dressé : chaque discipline est un trait à part entière (anti-pattern chaîne supprimé). Phase 1 =
  // STRUCTURE ; Phase 2 a CÂBLÉ Guerre/Magie (exemption Nerveux + CC) ; Phase 3 a CÂBLÉ Dompté (ignore
  // Bestial) et Garde (Territorial). Restent narratives/non modélisées : Monture, Cavalerie, Rapporteur…
  // Monture : la mountabilité réelle est posée par l'ENCOUNTER (`m.mount`/`ridesEntityId`, choix d'auteur
  // de scène) ; le trait reste le marqueur RAW. Cavalerie de choc : règle « charger en bon ordre » (Aux
  // Armes, formations d'unités) NON modélisée. Les deux = narratif/auteur, pas d'effet moteur isolé.
  ['Dressé (Monture)', 'marqueur RAW ; mountabilité posée par l’encounter (m.mount/ridesEntityId)'],
  ['Dressé (Cavalerie de choc)', 'charge en bon ordre (Aux Armes, formations) — non modélisé'],
  ['Dressé (Rapporteur)', 'discipline narrative (rapport) — arbitrage MJ'],
  ['Dressé (Revenir à la maison)', 'discipline narrative (retour au bercail) — arbitrage MJ'],
  ['Dressé (Trait)', 'discipline narrative (animal de trait : tire carrosse/chariot/charrue, LDB 85 l.118) — arbitrage MJ'],
  ['Increvable', 'recousue/ressuscitée post-combat — arbitrage MJ'],
  // Traits des Horreurs de Tzeentch (EDO) — flavor de statbloc sans système support, desc verbatim.
  ['Marque de Tzeentch', 'Mutations du statbloc — fixées par l’auteur/MJ (l’éditeur pose les Mutations de la créature) ; pas de génération runtime'],
  ['Dédoublement', 'scission en 2 horreurs bleues à la mort/Critique — pas de spawn-on-death dans le moteur (MJ/auteur)'],
  ['Feu de Tzeentch', 'aura de feu entre Horreurs du même type — pas de système d’aura inter-créatures (MJ)'],
  // Traits de créature EDO (Appendice 2) — desc verbatim, mécaniques complexes sans système support.
  ['Amorphe', 'demi-Blessures hors feu/froid/magie + immunité aux Critiques — pas de réduction de dégâts typée (MJ)'],
  ['Contagieux', 'transmet la maladie hébergée au toucher — pas câblé (MJ ; cf. Infecté/Maladie)'],
  ['Décérébré', 'sans I/Int/FM/Soc, joue toujours en dernier — pas de système « sans Initiative » (MJ)'],
  ['Voleur de chair', 'revêt la peau d’un humain tué (trait de Gideon) — pas de système de déguisement (MJ)'],
  // Traits ZI sans système support (desc verbatim, MJ).
  ['Fouissement', 'déplacement par creusement de tunnel — pas de système de fouissement (positionnement MJ)'],
  ['Déstabilisant', 'aura ZI : une créature Instable à proximité compte ses Avantages −2 en fin de Round — pas de système d’aura inter-créatures modélisé (MJ ; cf. Feu de Tzeentch)'],
  ['Marque de Khorne', 'Frénésie + Savoir-vivre (Suivants de Khorne) + Animosité Slaanesh + interdits + achats hors carrière (MDG 07 l.250-252) — même canal que Marque de Tzeentch (auteur/MJ)'],
  // Traits homebrew frenchy.bzh (ex-frenchy-traits.json, fondu) — flavor d’aura/spawn sans système, desc verbatim.
  // Aura de Mort : aura de LANCEMENT conditionnelle au DOMAINE (Nécromancie/Shyish + ; Ghyran/Hysh/Azyr −).
  // Le câblage cast↔aura existe (cf. Aura de Dhar, DISPATCH) mais le GATING par Domaine du sort lancé n'est
  // pas exprimable (skillDRBonus n'est pas conditionnel au Domaine) → reste à bâtir.
  ['Aura de Mort', 'rayon 70 m : +DR Nécromancie/Shyish, −10 autres Domaines — gating par Domaine du cast à bâtir'],
]);

// Traits dont la mécanique est portée par les helpers de `dispatch` (capabilities/passive/effects/
// grantsManeuvers de la donnée). Tout trait de traits.json qui n'est NI ici NI dans les maps ci-dessus
// échoue le test de couverture — on n'oublie aucun trait dans un trou.
const DISPATCH = new Set<string>([
  'À sang-froid', 'Affamé', 'Armure', 'Belliqueux', 'Bestial', 'Bond', 'Brutal', 'Champion', 'Coriace',
  // Dressé (Guerre) : passive +10 CC (charMod) + marqueur du gate Nerveux (bruits). Dompté : suppression
  // GÉNÉRIQUE du Trait Bestial (suppressesCapabilities, lue par traitCapability ; +2d10 Soc = profil cuit
  // à l'authoring). Garde : capability `territorial` (lue par isTerritorial). Tous DISPATCH (LDB 85 l.85/89).
  // Dressé (Divertir) : passive +10 aux Tests de Divertissement/Musicien/Représentation (skillMod ×3,
  // LDB 85 l.104) — même canal passive que Dressé (Guerre) +10 CC. DISPATCH.
  'Dressé (Guerre)', 'Dressé (Dompté)', 'Dressé (Garde)', 'Dressé (Divertir)',
  'Corruption mentale', 'Démoniaque', 'Élite', 'Endurant', 'Éthéré', 'Fabriqué', 'Foulée', 'Furtif',
  'Grand', 'Immunité', 'Infravision', 'Insensible à la douleur', 'Instable', 'Intelligent', 'Magique',
  'Meneur', 'Mutation', 'Nerveux', 'Nuée', 'Parasité', 'Perturbant', 'Protection', 'Rage', 'Rapide',
  // Rampant (T2C 15) : capability `noRun` (donnée) → `runMultiplier`=0 (budget de Course nul), la Marche
  // reste intacte. Dispatché (capability lue par hasNoRun).
  'Rampant',
  // Salive analgésique (T2C 15) : capability `wakelessBite` (donnée) → le modifier de touche `wake-sleeper`
  // NE réveille PAS une proie endormie (Inconscient magique) quand CETTE créature l'attaque (morsure indolore),
  // là où toute autre attaque la réveille. Dispatché (capability lue par le modifier).
  'Salive analgésique',
  // Métamorphose (Enfant d'Ulric, Middenheim p.116) : le trait `grantsManeuvers` DEUX manœuvres `targeting:'self'`
  // (forme hybride / forme humaine) portant les ops `transform`/`endTransform` — bascule de profil DELTA (tableau RAW
  // VERBATIM), Traits hybrides et apparence, PERSISTANTE et réversible, au prix de DEUX Actions (loseTurn). Activée
  // par le JOUEUR via `battleSelfManeuver` (hotbar). Dispatché (grantsManeuvers). Auto-transformation de l'IA à câbler.
  'Métamorphose',
  // Redoutable (ZI) : Avantage min = Indice au début du tour — effet `onTurnStart` en donnée (op
  // gainAdvantage, indice baké via withArg, gardé Empêtré/Surpris). Dispatché comme tout `effects`.
  'Redoutable',
  // Aura de Dhar : aura `affects:'allies'` (10 m) + passive (porteur compris) = `skillDRBonus`
  // Focalisation/Langue, lue au lancement par `castTestTalentDR`. Dispatché (aura/passive en donnée).
  'Aura de Dhar',
  // Manifestation de Ghur (#18) : capability `spellDomainImmunity:'bete'` (donnée), lue par id par
  // `immuneToSpellDomain` au chemin d'incantation (`applyCast`) → un Sort du Domaine de la Bête
  // n'applique aucun de ses effets au porteur. Clause RAW de vulnérabilité anti-démon/mort-vivant
  // (hors Bête) NON modélisée (pas de concept de créature « vulnérable comme un démon/mort-vivant » —
  // rien d'inventé) : documentée sur la capability `spellDomainImmunity`.
  'Manifestation de Ghur',
  'Régénération', 'Résistance à la Magie', 'Rusé', 'Sang corrosif', 'Stupide', 'Taille', 'Territorial',
  'Toile', 'Vision nocturne', 'Vol',
  // Atouts de STRUCTURE de siège (ADE II 8) : capabilities `structResistant`/`structImpenetrable`
  // (donnée), lues par `hasCapability` dans `engine/structures` (`structureImmune`) — canal dispatch.
  'Résistant', 'Impénétrable (structure)',
]);

function allTraitLabels(): string[] {
  const path = fileURLToPath(new URL('../../data/traits.json', import.meta.url));
  return (JSON.parse(readFileSync(path, 'utf8')) as { label: string }[]).map((t) => t.label);
}

describe('parité — registre des Traits dérivé de traits.json', () => {
  it('la dérivation est totale : chaque trait de traits.json est dans TRAITS (par id)', () => {
    const missing = allTraitLabels().filter((l) => !TRAITS[slugId(l)]);
    expect(missing).toEqual([]);
  });

  it('chaque trait de traits.json est couvert par un sous-système identifié (dispatch / ailleurs / journal)', () => {
    const uncovered = allTraitLabels().filter(
      (l) => !DISPATCH.has(l) && !COUVERT_AILLEURS.has(l) && !JOURNAL_MJ.has(l),
    );
    expect(uncovered).toEqual([]);
  });

  it('une seule source de couverture par trait (pas de double-classement)', () => {
    const seen = new Map<string, number>();
    for (const l of [...DISPATCH, ...COUVERT_AILLEURS.keys(), ...JOURNAL_MJ.keys()]) {
      seen.set(l, (seen.get(l) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([l]) => l);
    expect(dupes).toEqual([]);
  });

  it('parseTrait normalise Indice/argument/casse', () => {
    expect(parseTrait('Démoniaque 8+')).toEqual({ id: 'demoniaque', indice: 8, arg: undefined });
    expect(parseTrait('Toile 40')).toEqual({ id: 'toile', indice: 40, arg: undefined });
    expect(parseTrait('Immunité (Poison)')).toEqual({ id: 'immunite', indice: undefined, arg: 'Poison' });
    expect(parseTrait('À Sang-froid')?.id).toBe('a-sang-froid'); // casse de la donnée ≠ id canonique
    expect(parseTrait('Vol 100')).toEqual({ id: 'vol', indice: 100, arg: undefined });
    expect(parseTrait('Nuée')?.id).toBe('nuee');
    expect(parseTrait('Taille (Énorme)')).toEqual({ id: 'taille', indice: undefined, arg: 'Énorme' });
    expect(parseTrait('Armure 4')).toEqual({ id: 'armure', indice: 4, arg: undefined });
    expect(parseTrait('Trait inconnu')).toBeNull();
  });

  // La nature d'affichage est DÉRIVÉE de la donnée (plus de liste en dur PLUS_DISPLAY) :
  //  attaque (grantsManeuvers mêlée OU capabilities.naturalWeapon, dont le tir) → « +Dégâts » ;
  //  wardSave → « N+ » ; sinon Indice nu « N ».
  it('formatTrait : nature « +N » dérivée de la donnée', () => {
    const fmt = (id: string, value?: number) => formatTrait({ id, ...(value != null ? { value } : {}) } as TraitInstance);
    expect(fmt('morsure', 9)).toBe('Morsure +9'); // attaque mêlée (grantsManeuvers)
    expect(fmt('a-distance', 8)).toBe('À distance +8'); // attaque à distance (naturalWeapon ranged)
    expect(fmt('vol', 100)).toBe('Vol 100'); // indice simple
    expect(fmt('demoniaque', 8)).toBe('Démoniaque 8+'); // sauvegarde (wardSave)
  });
});
