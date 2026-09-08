/**
 * STOCK des VOCABULAIRES encore sans libellés de valeurs (#1694) — banc À PART : la mesure part du seul
 * REGISTRE (`DEFS_DE_DOCUMENT`), jamais d'un document synthétique bâti par un autre banc.
 *
 * UNE descente, celle de `slots.ts::enfantsDe` (clés d'objet, liste, enveloppes, record, union, tuple,
 * `lazy`) — jamais une descente sœur. Le stock se tient par VOCABULAIRE (le jeu ordonné des options),
 * pas par nœud : un `z.lazy` non mémoïsé rend un nœud NEUF à chaque descente (mesuré #1694 : 2 280
 * nœuds `z.enum` distincts pour 187 vocabulaires, dont 1 770 clones du seul `conditionSchema`), si
 * bien qu'un stock par nœud compterait la même déclaration des centaines de fois. Le COMPTE, lui, se
 * tient par NŒUD DISTINCT (`{ nommes, muets }`) : sans lui, un seul nœud nommé blanchissait ses jumeaux
 * `z.enum` muets, qui rendaient un `select` anonyme sans jamais paraître au stock.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { DEFS_DE_DOCUMENT } from '../validate';
import { defDe, enfantsDe, PROFONDEUR_MAX } from './slots';
import { valeursDe } from './meta';
import { IDS_PAR_DATASET, SPECS_PAR_DATASET } from '../_ids.generated';

/** Les ids AUTHORÉS des deux racines, tels que `npm run gen` les relève — la référence qui dit d'un
 *  vocabulaire qu'il ÉNUMÈRE des entités plutôt qu'un univers de mots. */
const IDS_CONNUS: ReadonlySet<string> = new Set([
  ...Object.values(IDS_PAR_DATASET).flat(),
  ...Object.values(SPECS_PAR_DATASET).flatMap((parId) => Object.values(parId).flat()),
]);

/**
 * Un vocabulaire d'IDS ne se nomme JAMAIS : ses options sont les ids d'un dataset, dont le nom FR est
 * déjà porté par l'entrée référencée — le redéclarer en ferait une SECONDE vérité. Il se DÉRIVE (jamais
 * une liste tenue à la main) : toutes ses options sont des ids authorés (`IDS_PAR_DATASET`,
 * `SPECS_PAR_DATASET`, émis par `npm run gen`), là où un vocabulaire de mots (`action`, `free`,
 * `charge`) n'en est aucun.
 */
const estVocabulaireDIds = (options: readonly string[]): boolean => options.every((o) => IDS_CONNUS.has(o));

/**
 * Compte de NŒUDS distincts (par identité) qui portent un vocabulaire : combien le NOMMENT, combien
 * restent MUETS. L'agrégation par OU d'origine BLANCHISSAIT les jumeaux : un seul nœud nommé suffisait
 * à déclarer le vocabulaire couvert, pendant que ses jumeaux `z.enum` rendaient un `select` ANONYME
 * qu'aucun stock ne suivait (mesuré #1694 : `physique|mentale`, 1 nommé pour 2 muets).
 */
type CompteDeNoeuds = { nommes: number; muets: number };

/** Vocabulaires ATTEINTS depuis des schémas donnés : clé = les options dans leur ordre. Jouable sur une
 *  COPIE du registre (contrôle positif), jamais seulement sur `DEFS_DE_DOCUMENT`. */
function vocabulairesDe(schemas: readonly unknown[]): Map<string, CompteDeNoeuds> {
  const vus = new Map<string, CompteDeNoeuds>();
  const noeudsComptes = new Set<unknown>();
  const descendre = (noeud: unknown, ancetres: ReadonlySet<unknown>, profondeur: number): void => {
    if (!noeud || typeof noeud !== 'object' || ancetres.has(noeud) || profondeur > PROFONDEUR_MAX) return;
    const def = defDe(noeud);
    if (!def) return;
    if (def.type === 'enum') {
      if (noeudsComptes.has(noeud)) return;
      noeudsComptes.add(noeud);
      const options = Object.values(def.entries as Record<string, string>);
      const cle = options.join('|');
      const compte = vus.get(cle) ?? { nommes: 0, muets: 0 };
      if (valeursDe(noeud) !== undefined) compte.nommes += 1;
      else compte.muets += 1;
      vus.set(cle, compte);
      return;
    }
    const pile = new Set(ancetres).add(noeud);
    for (const e of enfantsDe(def)) descendre(e.noeud, pile, profondeur + 1);
  };
  for (const s of schemas) descendre(s, new Set(), 0);
  return vus;
}

const vocabulairesDuRegistre = (): Map<string, CompteDeNoeuds> =>
  vocabulairesDe(DEFS_DE_DOCUMENT.map((d) => d.schema));

/** Les vocabulaires qu'un `enumNomme` nomme DÉJÀ et qui gardent un jumeau MUET — doctrine
 *  « un enum = une const nommée au module qui le porte » (#1694). */
const jumeauxMuets = (vocabulaires: Map<string, CompteDeNoeuds>): string[] =>
  [...vocabulaires]
    .filter(([, c]) => c.nommes >= 1 && c.muets > 0)
    .map(([cle, c]) => `${cle} (${c.nommes} nommé(s), ${c.muets} muet(s))`)
    .sort();

/** Les vocabulaires NOMMÉS, par leurs options — un par `enumNomme` atteint depuis le registre. */
const NOMMES = [
  'action|free|charge',
  'base|avancee',
  'capacite-de-combat|capacite-de-tir',
  'esquive|parade|init|resist|auto',
  'fixed|variable|all',
  'flag|param|mode',
  'interlude|voyage|mer|bataille|bataille-round|auberge',
  'melee|ranged|zone|allFoes|allAround|self',
  'physique|mentale',
  'prop|roof|relief',
  'selfWound|weaponDamageActLast|actionPenalty|loseMovement|loseAction|trauma|hitAlly|misfire',
  'weapon|ammo|armour|inventory',
].sort();

/**
 * STOCK DÉCROISSANT — vocabulaires de MOTS (hors ids d'entités) qu'aucun `enumNomme` ne nomme encore.
 * Chacun est nommé par ses OPTIONS, ce qui l'identifie où qu'il vive (champ de racine, rangée,
 * profondeur, grammaire partagée). Cette liste ne fait que DÉCROÎTRE : nommer un vocabulaire, c'est
 * le retirer d'ici.
 */
const VOCABULAIRES_SANS_LIBELLES: string[] = [
  '5m|10m|unite',
  '>=|<=|==|<|>',
  'CC|CT|F|E|I|Ag|Dex|Int|FM|Soc',
  'Commune|Limitée|Rare|Exotique',
  'Commune|Limitée|Rare|Exotique|Unique',
  'Inoffensive|Inquiétante|Menaçante|Mortelle',
  'Limitée|Rare',
  'M|F',
  'N|E|S|O',
  'N|E|\\|/',
  'N|NE|E|SE|S|SO|O|NO',
  'Variable|Personnelle|Très courte|Courte|Moyenne|Longue|Très longue|Considérable',
  'X|V',
  'action|mouvement|gratuit|aucun',
  'allyTestMod|firstRoundBonus|planningBonus',
  'ally|enemy',
  'all|blackpowder',
  'all|movement',
  'any|all',
  'arme|morsure|caudale|cornes|souffle|vomi|tentacules|etreinte|regard|langue|hurlement',
  'armyMight',
  'auberge|maison|camp',
  'aucune|legeres|abondantes|tres-abondantes',
  'aucun|retard|quart-de-tour|demi-tour',
  'avirons|voile|mixte',
  'bete|serviteur|vehicule',
  'bete|vehicule-terrestre',
  'bout-portant|courte|moyenne|longue|extreme',
  'brasPrincipal|random',
  'bravoure|ami|staggering|belligerent|blackout',
  'calme-plat|legere-brise|brise-fraiche|vent-modere|vent-violent|violente-tempete',
  'caniculaire|chaude|mediane|froide|glaciale',
  'cargaison|greement|coque|avirons|equipements|gouvernail|superstructure',
  'chaleur|froid',
  'clair|pluie|brouillard|neige|tempete',
  'classe|relais|compagnie|peage|patrouille',
  'complet|partiel',
  'complet|sans-disponibilite|sans-marchandage|simplifie',
  'current|ever',
  'd10|d100',
  'dangereuse|tresDangereuse|extreme',
  'days|hours|minutes',
  'dechirure|fracture',
  'dechirure|fracture|amputation',
  'declare|tirage',
  'deduite-du-set|geste-d-etat|grille|gouttiere-arche|selecteur-de-sets|coin-de-tour|bandeau-de-phase|interlude|pastille-etat|pastille-entite|frise|geste-secondaire',
  'defense|attack|both',
  'degage|brume|brouillard|puree-de-pois',
  'dominant|nord|sud|ouest|est',
  'douleur|mobilite|structurel|sensoriel|maladie|faim|magique|etat|ivresse|intrinseque',
  'dr|dr-ecrete|toute-la-reserve|points-de-la-ligne|points-de-la-ligne-suivante|chiffres-du-de|gain-au-choix|aucun-gain|termine-le-passage',
  'edge|tile|instance',
  'encounter|threatened',
  'enemies|allies|all',
  'enemy|ally',
  'equipage|avirons|greement|coque|equipements|cargaison|gouvernail|superstructure',
  'exact|ok|drift-minor|drift|drift-major',
  'extended|terreur|binary',
  'fixed|perDR|perHit|perKill',
  'fleeing|pursuing',
  'froid|chaleur',
  'gable|hip|shed|flat',
  'gable|stone-entry|chimney|sign|window-band|belfry',
  'generalDown|intervention|noIntervention|combatWon|combatLost',
  'group|talent|trait|psych',
  'harness|jolt|wheel|crash',
  'heldGround|intoCrowd',
  'heroStart|personnage|prop',
  'heure|minute|round',
  'imparfaite|moyenne|totale',
  'incantation|focalisation|dissipation',
  'incantation|focalisation|seconde-vue',
  'income|craftExtended|learnTalent|identify|entrainement|mecenat|ritualFocus|masterWeapon|identifyByResearch|memorizeDiscount|combatTraining|punchausen|knowledgeResearch|reputation|wrathOfTheGods|dissensionScout|dissensionEmeute|contremaitre|forage|seaChart|opportunityTrade|crewTraining',
  'indice|rumeur',
  'inferieur|superieur',
  'ingestion|immersion',
  'interieur|exterieur',
  'interior|exterior',
  'intermediaire|complexe|difficile|tresDifficile',
  'jamais|toujours|si-ecart',
  'jet|forceSuccess',
  'ladder|surface',
  'ldb|aa',
  'le-plus-lent|aucun',
  'ligne-de-force|pierre-gardienne|vortex|nexus|appui-arcanique|tempete|corruption|site',
  'lisses|griffues',
  'localisation|porteur',
  'majeure|mineure-x2',
  'melee|ranged|ammunition|armor|trapping',
  'metal|leather|chaos',
  'metal|nonMagic',
  'might|startMight|allyTestMod|firstRoundBonus|planningBonus',
  'mineure|arcane|invocation|beni|chaos',
  'mineure|majeure|importante',
  'mineure|moderee|majeure',
  'mineur|majeur',
  'minuscule|tres-petite|petite|moyenne|grande|enorme|monstrueuse',
  'minutes|hours|days',
  'min|max|sum|first',
  'moderee|grave',
  'movement|all',
  'm|km',
  'navTest|obstacle|detect',
  'navire|navire-fluvial',
  'night|voyage|weather|flow|activity|combat',
  'noise|magic',
  'none|half|crawl',
  'nord|sud|est|ouest',
  'normale|pietre',
  'onHit|onCrit|onWoundLoss|onSlain|onRoundStart|onStartled|onKill|onCharged|onGainCondition|onCombatStart|onCombatEnd|onRoundEnd|onTurnStart|onTurnEnd|onDayStart|onWake|onAttackResolved|onCastResolved|onMiscast|onOwnTestFailed',
  'opposed|extended',
  'party|enemies',
  'party|hero',
  'party|hero|caster|target',
  'pas|trot|galop',
  'pluie|averse|neige',
  'plus2|plus1|normal|minus1|half',
  'premier|courant|extreme',
  'proue|tribord|poupe|babord',
  'radius|diameter',
  'rafle-le-pot|reprend-mise|cible-ou-passe|remise-ou-abandon|quitte-la-manche',
  'remplace|ajoute',
  'reposant|narratif|ereintant|attaque',
  'reserve|choix',
  'resist|contact',
  'roll|wounds|extra|mv|points|compteur',
  'rural|urbain|sauvage',
  'sec|beau|pluie|pluie-diluvienne|neige|blizzard',
  'self|ally|opponent|party|neutral|hostile',
  'self|victim|engaged|grappled',
  'ship-criticals|river-criticals',
  'sort|rituel',
  'source-d-eau|blessures-et-etats',
  'source|group|any',
  'spell|prayer|talent|trait|trapping|quality|disease|symptom|mutation|condition|psychology|maneuver|creature|activity|rule|tavernGame|miscastMinor|miscastMajor|miscastWrath',
  'success|failure',
  'success|failure|fumble',
  'success|stupefying',
  'suppressExposure|gatherInfo|noSurprise|mapMade|rerollToken|countsAsRest|campCare|extraActivity|skipStage|fullRecovery|worsenWeather',
  'target|caster',
  'team|thrower|pot|volley',
  'terrestre|fluvial|maritime',
  'test|combat|threat|hold|rally',
  'tete|brasG|brasD|corps|jambeG|jambeD',
  'tete|bras|corps|jambe',
  'toute|khorne|nurgle|slaanesh|tzeentch',
  'trait|amelioration',
  'tresFacile|facile|accessible|intermediaire|complexe|difficile|tresDifficile|presqueImpossible|impossible',
  'units-lowest|nul',
  'valide|renonce',
  'veillee|parchemin',
  'verbatim|descripteur',
  'victim|self',
  'village|ville|cite',
  'weaponGroupsMelee|weaponGroupsRanged|winds|arcaneDomains|cultBlessings|cultMiracles|cultChaos|seaShanties|groups|diseases|sizes|mutations|breathTypes|damageTypes|weaponsMelee|weaponsRanged',
  'woundsCurrent|woundsMax|size|advantage',
  'wounds|bleed|trauma|surgery',
  'x+|x-|y+|y-',
  'x|y',
];

describe('libellés de VALEURS — stock nominatif décroissant des VOCABULAIRES', () => {
  it('le stock des vocabulaires SANS libellés est celui déclaré, et il DÉCROÎT', () => {
    const stock = [...vocabulairesDuRegistre()]
      .filter(([cle, c]) => c.nommes === 0 && !estVocabulaireDIds(cle.split('|')))
      .map(([cle]) => cle)
      .sort();
    expect(stock).toEqual(VOCABULAIRES_SANS_LIBELLES.slice().sort());
  });

  it('les vocabulaires NOMMÉS sont ceux des defs migrés, tous atteints depuis le registre', () => {
    const nommes = [...vocabulairesDuRegistre()].filter(([, c]) => c.nommes > 0).map(([cle]) => cle).sort();
    expect(nommes).toEqual(NOMMES);
  });

  it('un vocabulaire NOMMÉ ne laisse AUCUN jumeau muet — un enum = une const nommée', () => {
    expect(
      jumeauxMuets(vocabulairesDuRegistre()),
      'ces vocabulaires sont nommés à un endroit et redéclarés en `z.enum` ailleurs : partager la const',
    ).toEqual([]);
  });

  it('contrôle positif : un jumeau MUET injecté dans une COPIE du registre est VU', () => {
    const copie = [
      ...DEFS_DE_DOCUMENT.map((d) => d.schema),
      z.object({ jumeau: z.enum(['physique', 'mentale']) }),
    ];
    expect(jumeauxMuets(vocabulairesDe(copie))).toEqual(['physique|mentale (1 nommé(s), 1 muet(s))']);
  });
});

const RACINE_SRC = fileURLToPath(new URL('../../../', import.meta.url));

export type Fichier = { readonly chemin: string; readonly source: string };

function sourcesDeSrc(): Fichier[] {
  const fichiers: Fichier[] = [];
  const marcher = (rel: string): void => {
    for (const e of readdirSync(RACINE_SRC + rel, { withFileTypes: true })) {
      const chemin = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        marcher(chemin);
        continue;
      }
      if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name)) continue;
      fichiers.push({ chemin: `src/${chemin}`, source: readFileSync(RACINE_SRC + chemin, 'utf8') });
    }
  };
  marcher('');
  return fichiers;
}

const RX_DECLARATION_NOMMEE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)[^=\n]*=\s*enumNomme\s*\(/g;
/** Récepteur nommé, éventuellement CLONÉ en chemin (`X.describe(…).extract(…)`) — c'est justement le
 *  clone qui échappe au refus posé sur l'instance. */
const RX_SELECTION =
  /([A-Za-z_$][\w$]*)((?:\s*\.\s*[A-Za-z_$][\w$]*\s*\([^()]*\))*)\s*\.\s*(extract|exclude)\s*\(/g;
const RX_SELECTION_INLINE = /enumNomme\s*\(\s*\{[^{}]*\}\s*\)\s*\.\s*(extract|exclude)\s*\(/g;

/**
 * GARDE STRUCTURELLE (#1694) : `.extract(`/`.exclude(` posé sur un enum NOMMÉ. Le refus posé par
 * `enumNomme` sur l'instance ne survit pas à un clone (`.describe(…)`, `.meta(…)` rendent un nœud
 * neuf dont les méthodes zod sont intactes) — un sous-enum naîtrait alors SANS libellés, en silence.
 * Le récepteur se reconnaît par sa DÉCLARATION `const X = enumNomme(` où qu'elle vive dans `src/**`
 * (les deux sélections réelles, `defs/disponibilite.ts` et `grammaire/valeurs.ts`, portent sur
 * `availabilitySchema`/`difficultySchema`, deux `z.enum` NUS : elles restent légitimes).
 * Fonction PURE des sources — jouable sur une COPIE (contrôle positif).
 */
export function selectionsSurEnumNomme(fichiers: readonly Fichier[]): string[] {
  const nommes = new Set<string>();
  for (const { source } of fichiers) {
    RX_DECLARATION_NOMMEE.lastIndex = 0;
    let d: RegExpExecArray | null;
    while ((d = RX_DECLARATION_NOMMEE.exec(source))) nommes.add(d[1]);
  }
  const fautes: string[] = [];
  for (const { chemin, source } of fichiers) {
    for (const rx of [RX_SELECTION, RX_SELECTION_INLINE]) {
      rx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(source))) {
        const inline = rx === RX_SELECTION_INLINE;
        if (!inline && !nommes.has(m[1])) continue;
        const ligne = source.slice(0, m.index).split('\n').length;
        fautes.push(`${chemin}:${ligne} .${inline ? m[1] : m[3]}()`);
      }
    }
  }
  return fautes.sort();
}

describe('un sous-univers se déclare par son propre enumNomme, jamais par .extract/.exclude', () => {
  it('aucune sélection posée sur un enum NOMMÉ dans src/**', () => {
    expect(
      selectionsSurEnumNomme(sourcesDeSrc()),
      'zod rend un sous-enum SANS les libellés du parent : déclarer le sous-univers par son propre enumNomme',
    ).toEqual([]);
  });

  it('contrôle positif : une sélection injectée dans une COPIE de source est VUE', () => {
    const copie: Fichier[] = [
      { chemin: 'a.ts', source: "export const nature = enumNomme({ physique: 'Physique', mentale: 'Mentale' });\n" },
      { chemin: 'b.ts', source: 'const sous = nature.extract([\n  ‘physique’,\n]);\n' },
      { chemin: 'c.ts', source: "const direct = enumNomme({ a: 'A', b: 'B' }).exclude(['b']);\n" },
      { chemin: 'd.ts', source: "const clone = nature.describe('x').extract(['physique']);\n" },
    ];
    expect(selectionsSurEnumNomme(copie)).toEqual([
      'b.ts:1 .extract()',
      'c.ts:1 .exclude()',
      'd.ts:1 .extract()',
    ]);
  });

  it('une sélection sur un enum NU (jamais nommé) reste légitime', () => {
    const copie: Fichier[] = [{ chemin: 'a.ts', source: "const s = availabilitySchema.extract(['Limitée']);\n" }];
    expect(selectionsSurEnumNomme(copie)).toEqual([]);
  });
});
