import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { CODEX, depuisEnveloppe } from './registry';

/**
 * Gel de FORME du Codex + cliquet de PROVENANCE (#1467 L1b V-CODEX).
 *
 * Le registre projette 125 catégories ; l'adoption du défaut d'enveloppe (`depuisEnveloppe`) ne doit
 * RIEN changer à l'écran. Trois mesures, aucune n'étant un dump des 4385 items :
 *
 *  1. CLÉS — le gel STRICT : pour chaque catégorie, le hash de `<id>|<clés triées>` ITEM PAR ITEM.
 *     Aucune valeur n'est filtrée : une clé posée à `undefined`/`null` compte comme présente. C'est
 *     la seule mesure qui voit un item perdre ou gagner une clé.
 *  2. FORME — l'UNION des clés par catégorie, à but de DIAGNOSTIC lisible. Elle ne voit PAS un item
 *     isolé qui gagne une clé que ses voisins portent déjà : c'est (1) qui l'attrape.
 *  3. PROVENANCE — pour chaque entrée de `src/data/*.json` portant `source` ou `desc`, l'item Codex
 *     de MÊME id doit les porter aussi. Le mapping dataset→catégorie est DÉDUIT (inclusion des ids),
 *     jamais une table à maintenir ; son ANGLE MORT (les tableaux qu'aucune catégorie ne couvre
 *     ENTIÈREMENT) est lui-même gelé, cf. `PARTIELS`/`ORPHELINS`.
 *
 * Régénérer les baselines : mesurer `CODEX` avec le même calcul que `clesDe`/`formeDe`/le corps du
 * test de provenance, et recopier les tables ci-dessous. Un écart NON VOULU se lit catégorie par
 * catégorie ; un écart VOULU (lot T3) se re-gèle avec sa raison dans le message de commit.
 */

const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));

/** sha256 (16 hex) de `<id>|<clés triées>` par item, jointes par \n — gel STRICT clé par clé. */
const CLES: Record<string, string> = {
  "arcanePhenomena": 'a9ce5b04e91095da',
  "advancementCosts": '3fca5e9752e2dfab',
  "disponibilite": '5bf0efe0e06d3102',
  "sizes": '0a5b3b9c8f918a21',
  "drivingMishap": '92fe6cc379b80542',
  "drunkenness": '66aa24947d6ad160',
  "encumbranceTiers": '065c74037364ee01',
  "riverNavigation": '34c199b39cb4cf6a',
  "grapple": '56b4ee72800485aa',
  "miscastMinor": '3dc24773d14f1b94',
  "miscastMajor": '416a3aa0219e8f4e',
  "miscastWrath": '3da49a322927f1e7',
  "nightStakes": '54a15ad6883f8c31',
  "voyageStakes": '688a26d167439e19',
  "flowStakes": '5991b421e4d718b4',
  "combatStakes": '1940d85367050a88',
  "races": '0728d04812275962',
  "careers": '482f179346c5e761',
  "characteristics": '532e47bfff4a9328',
  "classes": '67fd1dcccf18c04c',
  "stars": '4603d87c66f77bb2',
  "skills": '7938829857c61067',
  "talents": '99ee192563fac692',
  "axes": 'f86bc9340cdd5451',
  "trappings": '4fe70c5fb37f43e5',
  "siegeEngines": 'a7d8202fa83a7827',
  "weaponGroups": 'a7c319ff266db56c',
  "qualities": '61b2f19869aadceb',
  "etats": 'eb017cace5b342cc',
  "maladies": '4327765703d72cdc',
  "symptoms": '2b4e9356d95c9ecd',
  "mutations": 'a507855641eff14a',
  "mutationTables": 'd15351c3df15abd1',
  "effectTables": '9ae6a346268fcff3',
  "maneuvers": '30d7e463b2575792',
  "psychologie": '2287ac1af26a59cb',
  "domains": '4e7ed40a32f916d6',
  "spells": '81267fd5d0e86a78',
  "gods": 'ea520eccdbf9cd5f',
  "ventsTourbillonnants": '9a979156867c5f47',
  "creatures": '63119d8e52a4e5de',
  "traits": '3e33886305b13fdc',
  "locations": '53ca311b61c2a3f1',
  "books": 'be0011b301362125',
  "careerLevels": '4b3a9274c6cc385b',
  "eyes": '1b568aea9d6b3303',
  "hairs": 'd42c44f9511c8539',
  "calendarMonths": '94c52503e859af19',
  "calendarIntercalary": '1bb3c689c2f546df',
  "calendarWeekdays": '2ee12ca1b0a15650',
  "calendarPhases": '283caef56b8e1f4f',
  "weather": '5fcb080329574387',
  "weatherConditions": '71dd66544ecbcbe1',
  "raceAppearance": '90eb8b747119d31f',
  "pregens": 'e33b6fca9b473190',
  "oups": '1f78c6f4d47ab181',
  "interludeEvents": 'a12c10833eb0fe02',
  "peripeties": '5779340742cfe8be',
  "activities": '84e0d0a9f7ae31a5',
  "massBattlePowerEstimate": '05642f30b0f5da6b',
  "massBattleMightModifiers": '765738f4cc566e89',
  "massBattleWarMachines": '31200178c2df5093',
  "massBattleStructures": '91c097996fda97ca',
  "massBattleHazards": 'b2e5ec3bde8aa256',
  "details": '1d94d0c95e00ff48',
  "names": '8ab7649e0daf9e50',
  "structures": 'c94cf687573cb06d',
  "vehicles": 'dcc320ad1f8760a1',
  "celestialHouses": '0507cb49e07e8336',
  "groups": '72ed4fd1de352fae',
  "psychologies": 'a85f35c0a34172ef',
  "seaShanties": '2bf96225710afb8c',
  "crewRoles": '6f11f0ef0cc2ef8b',
  "crewTestTypes": '5e7398e513c81e5c',
  "navalTraits": 'aad18a5e9ac71d9b',
  "traumas": 'b3dade314ac669df',
  "criticalsTete": '86be88523cd5f8a4',
  "criticalsBras": 'bc398f7c81265cdf',
  "criticalsCorps": '9bc9d56433a21bac',
  "criticalsJambe": '2ad610ca9963d74d',
  "aaCriticalsTete": '11034e490ae406f9',
  "aaCriticalsBras": '5872ebe159f016b7',
  "aaCriticalsCorps": '7bc1d9ca4059fcd3',
  "aaCriticalsJambe": '9e70d8c421a47bda',
  "incidentsMonture": '245d13bec4d29c6b',
  "problemesVehicule": 'be08717e5cb4e005',
  "rencontresPositives": '005516ea5d3b70fd',
  "rencontresFortuites": '7b04e3f65ef2ea8d',
  "rencontresDangereuses": '0446e754073bdbbe',
  "shipCriticalsCargaison": '31dffdc825bb5aac',
  "shipCriticalsGreement": 'b3cb30a563bfd78d',
  "shipCriticalsCoque": '50423b525fae7d8c',
  "shipCriticalsAvirons": 'ac4815f65c3877aa',
  "shipCriticalsEquipements": 'd0041160c877c84f',
  "riverCriticalsGreement": '61d1e2547e056ad7',
  "riverCriticalsAvirons": '69f70586f60d36d4',
  "riverCriticalsGouvernail": 'f6fb5f2042e0aa4d',
  "riverCriticalsCoque": 'df77f1ed19fe476c',
  "riverCriticalsSuperstructure": '764a4347e01ffe06',
  "seaManannFactors": 'be87a8fce12d62aa',
  "seaBoardEvents": '97b25dc48859e8db',
  "seaPortEvents": 'b5e945f967845b57',
  "waterExposure": 'e4ceeca1e943d0cd',
  "navalPorts": '73b923d02e3c9d73',
  "navalProgression": '2291cebbdc91ae10',
  "shipHullSizes": 'f527a8d6b518ea36',
  "shipSpeedTraits": 'cf53c1c384e11f8f',
  "shipConstructionTraits": '364e4dec54ddf769',
  "seaNavigation": '83821f8854de4594',
  "seaPerils": '71176a2d80f34467',
  "seaWeather": '1c4ce48945ff48e0',
  "montures": '753bb5df6cb62fd3',
  "tavernGames": '8abef4f4ee68acfc',
  "obsessions": '335a5d95e4a39469',
  "reglesOptionnelles": '4d155947d39d1654',
  "surincantation": '561218369ab9cdfd',
  "structureCriticals": '84e0df29c1ae4e21',
  "artilleryMisfire": 'aa3ad3238b5356f8',
  "landCargo": '6d7821cf42e5eaf5',
  "seaCargo": '8cfba773c19f3147',
  "riverPerils": 'cf9331a2a02a1742',
  "crewMoraleFactors": '9d0a69495919ea9c',
  "crewMoraleBands": '94afdaf30f522e1b',
  "steamBreakdowns": 'e394290422469f33',
  "regles": '5d8038eb4d292abc',
};

/** Union des clés PRÉSENTES par catégorie (diagnostic lisible — un item isolé qui gagne une clé que
 *  ses voisins portent déjà lui échappe : c'est `CLES` qui l'attrape). */
const FORME: Record<string, string> = {
  "arcanePhenomena": 'desc group id label meta sections source sub',
  "advancementCosts": 'id label meta source sub',
  "disponibilite": 'id label sections source',
  "sizes": 'id label sections',
  "drivingMishap": 'desc id label meta sub',
  "drunkenness": 'desc id label meta sections sub',
  "encumbranceTiers": 'id label meta source',
  "riverNavigation": 'id label meta sections source',
  "grapple": 'id label sections source',
  "miscastMinor": 'id label meta sections source sub',
  "miscastMajor": 'id label meta sections source sub',
  "miscastWrath": 'id label meta sections source sub',
  "nightStakes": 'desc id label source',
  "voyageStakes": 'desc id label source',
  "flowStakes": 'desc id label source sub',
  "combatStakes": 'desc id label source sub',
  "races": 'appearance desc group id label meta source tabs',
  "careers": 'desc exergue group id label meta source sub tabs',
  "characteristics": 'desc id label meta sections source sub',
  "classes": 'desc id label sections source',
  "stars": 'desc id label meta sections source sub',
  "skills": 'desc id label meta sections source sub',
  "talents": 'desc id label meta sections source',
  "axes": 'desc id label meta sections',
  "trappings": 'desc id label meta sections source sub',
  "siegeEngines": 'appearance desc id label meta previewRef sections source sub',
  "weaponGroups": 'id label sections sub',
  "qualities": 'desc id label sections source sub',
  "etats": 'desc id label sections source',
  "maladies": 'id label meta sections sub',
  "symptoms": 'desc id label sections source',
  "mutations": 'appearance desc group id label sections source sub',
  "mutationTables": 'id label sections sub',
  "effectTables": 'id label sections source sub',
  "maneuvers": 'desc id label meta sections source sub',
  "psychologie": 'appearance desc group id label meta sections source sub',
  "domains": 'desc id label meta sections source',
  "spells": 'desc id label meta sections source sub',
  "gods": 'desc id label sections source sub',
  "ventsTourbillonnants": 'id label meta sub',
  "creatures": 'appearance desc group id label meta previewRef sections source statblock sub',
  "traits": 'appearance desc id label meta sections source sub',
  "locations": 'desc group id label sections source sub',
  "books": 'desc group id label sections sub',
  "careerLevels": 'group id label sections sub',
  "eyes": 'id label sections sub',
  "hairs": 'id label sections sub',
  "calendarMonths": 'id label sub',
  "calendarIntercalary": 'id label sub',
  "calendarWeekdays": 'id label',
  "calendarPhases": 'id label sub',
  "weather": 'id label sub',
  "weatherConditions": 'desc id label meta source',
  "raceAppearance": 'appearance id label meta sub',
  "pregens": 'id label meta sections sub',
  "oups": 'id label meta sub',
  "interludeEvents": 'desc id label sub',
  "peripeties": 'desc id label sub',
  "activities": 'desc id label meta sections source sub',
  "massBattlePowerEstimate": 'desc id label meta',
  "massBattleMightModifiers": 'desc id label meta',
  "massBattleWarMachines": 'id label meta',
  "massBattleStructures": 'id label meta',
  "massBattleHazards": 'desc id label sub',
  "details": 'id label sections',
  "names": 'id label sections sub',
  "structures": 'desc id label meta sections sub',
  "vehicles": 'desc id label meta source',
  "celestialHouses": 'desc id label source sub',
  "groups": 'id label',
  "psychologies": 'desc id label sections source',
  "seaShanties": 'desc id label meta sections source',
  "crewRoles": 'desc id label sections',
  "crewTestTypes": 'id label meta sections',
  "navalTraits": 'desc id label sections source sub',
  "traumas": 'desc id label sections sub',
  "criticalsTete": 'desc id label meta sections sub',
  "criticalsBras": 'desc id label meta sections sub',
  "criticalsCorps": 'desc id label meta sections sub',
  "criticalsJambe": 'desc id label meta sections sub',
  "aaCriticalsTete": 'desc id label meta sections sub',
  "aaCriticalsBras": 'desc id label meta sections sub',
  "aaCriticalsCorps": 'desc id label meta sections sub',
  "aaCriticalsJambe": 'desc id label meta sections sub',
  "incidentsMonture": 'desc id label meta sections sub',
  "problemesVehicule": 'desc id label meta sections sub',
  "rencontresPositives": 'desc id label meta sections sub',
  "rencontresFortuites": 'desc id label meta sections sub',
  "rencontresDangereuses": 'desc id label meta sections sub',
  "shipCriticalsCargaison": 'desc id label meta sections sub',
  "shipCriticalsGreement": 'desc id label meta sections sub',
  "shipCriticalsCoque": 'desc id label meta sections sub',
  "shipCriticalsAvirons": 'desc id label meta sections sub',
  "shipCriticalsEquipements": 'desc id label meta sections sub',
  "riverCriticalsGreement": 'desc id label meta sections sub',
  "riverCriticalsAvirons": 'desc id label meta sections sub',
  "riverCriticalsGouvernail": 'desc id label meta sections sub',
  "riverCriticalsCoque": 'desc id label meta sections sub',
  "riverCriticalsSuperstructure": 'desc id label meta sections sub',
  "seaManannFactors": 'id label meta',
  "seaBoardEvents": 'desc id label sub',
  "seaPortEvents": 'desc id label sub',
  "waterExposure": 'desc id label meta sections source',
  "navalPorts": 'desc group id label meta sections source',
  "navalProgression": 'desc id label source sub',
  "shipHullSizes": 'id label meta sections source',
  "shipSpeedTraits": 'id label meta source',
  "shipConstructionTraits": 'id label meta source',
  "seaNavigation": 'id label sections source',
  "seaPerils": 'desc id label sections source',
  "seaWeather": 'id label meta sections source',
  "montures": 'id label meta sections',
  "tavernGames": 'desc id label meta source',
  "obsessions": 'id label sub',
  "reglesOptionnelles": 'desc id label meta sub',
  "surincantation": 'id label meta source sub',
  "structureCriticals": 'desc id label meta sub',
  "artilleryMisfire": 'desc id label meta sub',
  "landCargo": 'id label meta',
  "seaCargo": 'id label',
  "riverPerils": 'id label sub',
  "crewMoraleFactors": 'desc id label',
  "crewMoraleBands": 'id label meta sub',
  "steamBreakdowns": 'desc id label meta sub',
  "regles": 'desc id label source',
};

/** Catégories dont ≥1 item DÉFAUSSE une `source`/`desc` que la donnée porte, avec leur compte.
 *  Les adopter changerait le rendu de ces fiches — hors périmètre du lot V-CODEX (#1467). */
const MUETS: Record<string, number> = {
  "aaCriticalsTete": 20,
  "aaCriticalsBras": 20,
  "aaCriticalsCorps": 20,
  "aaCriticalsJambe": 20,
  "arcanePhenomena": 8,
  "calendarIntercalary": 6,
  "calendarMonths": 12,
  "calendarWeekdays": 8,
  "careerLevels": 432,
  "crewMoraleFactors": 28,
  "crewMoraleBands": 4,
  "crewRoles": 2,
  "crewTestTypes": 10,
  "criticalsTete": 20,
  "criticalsBras": 20,
  "criticalsCorps": 20,
  "criticalsJambe": 20,
  "eyes": 10,
  "hairs": 10,
  "interludeEvents": 31,
  "maladies": 16,
  "massBattlePowerEstimate": 5,
  "massBattleMightModifiers": 9,
  "massBattleWarMachines": 10,
  "massBattleStructures": 5,
  "structures": 24,
  "massBattleHazards": 10,
  "mutationTables": 17,
  "oups": 8,
  "peripeties": 10,
  "reglesOptionnelles": 54,
  "riverPerils": 4,
  "seaManannFactors": 26,
  "seaBoardEvents": 40,
  "seaPortEvents": 18,
  "steamBreakdowns": 6,
  "traumas": 29,
  "weaponGroups": 38,
  "weather": 4,
};

/** ANGLE MORT du mapping déduit : tableaux qu'une catégorie couvre PARTIELLEMENT (ids en commun,
 *  mais pas tous) — ils sortent du cliquet de provenance. Gelé : un dataset qui cesse d'être
 *  couvert en entier atterrit ici et rougit, au lieu de disparaître du filet en silence. */
const PARTIELS: string[] = [
  "actions.json#0 (55)",
  "breath-types.json#0 (6)",
  "damage-types.json#0 (4)",
  "land-cargo.json#0 (9)",
  "lightLevels.json#0 (5)",
  "lightTones.json#0 (4)",
  "merchantFamilies.json#0 (7)",
  "merchants.json#0 (6)",
  "props.json#0 (78)",
  "qualitySubtypes.json#0 (3)",
  "river-navigation.json#0 (5)",
  "sea-cargo.json#0 (13)",
  "sea-perils.json#0 (4)",
  "sea-perils.json#1 (3)",
  "sea-perils.json#2 (5)",
  "sea-weather.json#3 (6)",
  "structureAppearance.json#0 (18)",
  "systemes.manifest.json#0 (16)",
  "water-exposure.json#0 (12)",
];

/** Tableaux identifiés qu'AUCUNE catégorie ne touche (manifestes d'outillage, vocabulaires de
 *  rendu, tables nichées exposées autrement). Gelé au même titre que `PARTIELS`. */
const ORPHELINS: string[] = [
  "donnees.manifest.json#0 (11)",
  "lieux-services.json#0 (7)",
  "miscast.json#0 (5)",
  "primitives.manifest.json#0 (28)",
  "propMaterials.json#0 (4)",
  "qualityTypes.json#0 (2)",
  "raw.manifest.json#0 (8)",
  "reliefMaterials.json#0 (6)",
  "river-navigation.json#1 (3)",
  "roofMaterials.json#0 (4)",
  "sea-cargo.json#1 (3)",
  "sea-events.json#3 (5)",
  "sea-navigation.json#0 (5)",
  "sea-weather.json#0 (4)",
  "sea-weather.json#1 (5)",
  "sea-weather.json#2 (4)",
];

const clesDe = (items: readonly object[]): string =>
  createHash('sha256').update(items.map((i) => `${(i as { id: string }).id}|${Object.keys(i).sort().join(',')}`).join('\n')).digest('hex').slice(0, 16);

function formeDe(items: readonly object[]): string {
  const k = new Set<string>();
  for (const i of items) for (const key of Object.keys(i)) k.add(key);
  return [...k].sort().join(' ');
}

/** Tableaux d'entrées IDENTIFIÉES nichés dans un JSON de donnée (un fichier peut en porter plusieurs). */
function tableauxIdentifies(v: unknown, out: Record<string, unknown>[][] = []): Record<string, unknown>[][] {
  if (Array.isArray(v)) {
    if (v.length && v.every((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')) out.push(v as Record<string, unknown>[]);
    return out;
  }
  if (v && typeof v === 'object') for (const x of Object.values(v)) tableauxIdentifies(x, out);
  return out;
}

describe('Codex — défaut d’enveloppe (#1467 L1b)', () => {
  it('les CLÉS de chaque item sont celles gelées (aucune clé n’apparaît ni ne disparaît, valeur comprise)', () => {
    const mesure: Record<string, string> = {};
    for (const c of CODEX) mesure[c.key] = clesDe(c.items);
    expect(mesure).toEqual(CLES);
  });

  it('la FORME de chaque catégorie est celle gelée', () => {
    const mesure: Record<string, string> = {};
    for (const c of CODEX) mesure[c.key] = formeDe(c.items);
    expect(mesure).toEqual(FORME);
  });

  it('PROVENANCE : un item dont la donnée porte source/desc les porte au Codex — et l’angle mort du mapping est gelé', () => {
    const muets: Record<string, number> = {};
    const apparies: string[] = [];
    const partiels: string[] = [];
    const orphelins: string[] = [];
    for (const f of readdirSync(DATA_DIR).filter((x) => x.endsWith('.json'))) {
      for (const [n, arr] of tableauxIdentifies(JSON.parse(readFileSync(DATA_DIR + f, 'utf8'))).entries()) {
        const ids = arr.map((e) => e.id as string);
        let etat: 'total' | 'partiel' | 'orphelin' = 'orphelin';
        for (const c of CODEX) {
          const byId = new Map(c.items.map((i) => [i.id, i]));
          const couverts = ids.filter((id) => byId.has(id)).length;
          if (couverts === 0) continue;
          if (couverts < ids.length) { if (etat === 'orphelin') etat = 'partiel'; continue; }
          etat = 'total';
          let m = 0;
          for (const e of arr) {
            const item = byId.get(e.id as string)!;
            const porteSource = !!(e.source && typeof e.source === 'object');
            const porteDesc = typeof e.desc === 'string' && e.desc.length > 0;
            if ((porteSource && !item.source) || (porteDesc && !item.desc)) m++;
          }
          if (m) muets[c.key] = Math.max(muets[c.key] ?? 0, m);
        }
        (etat === 'total' ? apparies : etat === 'partiel' ? partiels : orphelins).push(`${f}#${n} (${ids.length})`);
      }
    }
    expect(muets).toEqual(MUETS);
    expect(partiels).toEqual(PARTIELS);
    expect(orphelins).toEqual(ORPHELINS);
    expect(apparies.length).toBe(115);
  });
});

describe('depuisEnveloppe — le défaut lui-même', () => {
  const enveloppe = { id: 'x', label: 'X', desc: 'prose', source: { book: 'livre-de-base', page: 42 } };

  it('la source passe par src() : ABRÉVIATION du livre, jamais son id', () => {
    expect(depuisEnveloppe(enveloppe).source).toEqual({ book: 'LDB', page: 42 });
  });

  it('les extras l’emportent sur le défaut (le renommage reste visible au site)', () => {
    expect(depuisEnveloppe(enveloppe, { desc: 'enjeu', label: 'Autre' })).toMatchObject({ desc: 'enjeu', label: 'Autre' });
  });

  it('desc ET source absentes restent ABSENTES — ni chaîne vide, ni null', () => {
    const item = depuisEnveloppe({ id: 'x', label: 'X' });
    expect(Object.keys(item)).toEqual(['id', 'label']);
  });
});
