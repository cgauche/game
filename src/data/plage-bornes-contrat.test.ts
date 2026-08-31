/**
 * CONTRAT des deux concepts à DEUX BORNES de la donnée (#1463 L4, vague `plage`) — sondes du design
 * jugé du 2026-08-31 promues en tests.
 *
 * Ce fichier tient quatre affirmations POSITIVES, chacune mesurée sur les DEUX racines de donnée
 * (`src/data` et `src/scenes`, comme le scan des structures) :
 *  A. une seule graphie nomme une paire de bornes (`min,max`) ; ce qui reste encodé par la BORNE
 *     HAUTE SEULE est INVENTORIÉ, document par document ;
 *  B. les bornes d'un RÉGLAGE et les bornes d'un TIRAGE sont disjointes ;
 *  C. la fourchette EMBOÎTÉE (`{range: {min, max}}`) n'existe nulle part ;
 *  D. l'en-tête de `STRUCTURES_ORPHELINES` dit ce que le stock mesure.
 *
 * Ces quatre-là sont ce qui rend la CIBLE tenable : `findTableEntry`
 * (`src/engine/tables.ts`, primitive de la table CLAUDE.md) exige la forme PLATE `{min, max}`, et
 * borne le tirage des DEUX côtés — donc l'ordre des rangées d'une table éditable au Codex ne décide
 * plus de son résultat.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STRUCTURES_ORPHELINES } from '../../scripts/guards/lib/structuresStock.mjs';

/** Les DEUX racines de donnée du projet, comme le scan des structures (`scripts/docs/lib/structures-scan.mts`) :
 *  une graphie de bornes qui n'apparaîtrait que dans un document de SCÈNE échapperait sinon à la mesure.
 *  Mesuré 2026-08-31 : `src/scenes` (4 documents de projet) porte 0 paire de bornes, 0 borne haute
 *  seule, 0 `rand` — la sonde y verrouille donc une population VIDE, et c'est ce qu'on veut tenir. */
const RACINES: [string, string][] = ['src/data', 'src/scenes'].map((r) => [r, join(process.cwd(), r)]);

/** Graphies CONNUES d'une paire de bornes — celles qu'on cherche, pas seulement celle qu'on écrit. */
const PAIRES = [
  ['min', 'max'],
  ['from', 'to'],
  ['de', 'a'],
  ['low', 'high'],
  ['lo', 'hi'],
  ['debut', 'fin'],
  ['start', 'end'],
  ['inf', 'sup'],
] as const;

type Objet = Record<string, unknown>;
type Site = { doc: string; chemin: string; cles: string[] };

const estNombre = (v: unknown): v is number => typeof v === 'number';

type Mesure = {
  /** Compte par graphie de paire (`'min,max'` → n). */
  paires: Record<string, number>;
  /** Objets `{range: {min, max}}` — la cible EMBOÎTÉE. */
  emboites: string[];
  /** Élément de TABLEAU portant `min` ET `max` numériques (la candidature structurelle du lexique). */
  deuxBornes: Site[];
  /** Élément de TABLEAU portant `max` (nombre ou `null`) SANS `min` : la borne haute SEULE. */
  borneHauteSeule: Site[];
  /** Documents portant le champ `rand` (borne haute d100 portée par l'ENTITÉ), et son compte. */
  rand: Record<string, number>;
  /** Documents JSON effectivement lus, PAR RACINE — sans quoi l'élargissement de la marche à une
   *  seconde racine serait un no-op indétectable (elle n'y porte, aujourd'hui, aucune borne). */
  documentsParRacine: Record<string, number>;
};

function mesurer(): Mesure {
  const m: Mesure = { paires: {}, emboites: [], deuxBornes: [], borneHauteSeule: [], rand: {}, documentsParRacine: {} };
  const walk = (n: unknown, doc: string, chemin: string, dansTableau: boolean): void => {
    if (Array.isArray(n)) {
      for (const e of n) walk(e, doc, `${chemin}[]`, true);
      return;
    }
    if (!n || typeof n !== 'object') return;
    const o = n as Objet;
    const cles = Object.keys(o);

    for (const [a, b] of PAIRES) {
      if (estNombre(o[a]) && estNombre(o[b])) m.paires[`${a},${b}`] = (m.paires[`${a},${b}`] ?? 0) + 1;
    }
    const r = o.range as Objet | undefined;
    if (r && typeof r === 'object' && !Array.isArray(r) && estNombre(r.min) && estNombre(r.max)) {
      m.emboites.push(`${doc}${chemin}`);
    }
    if (dansTableau && estNombre(o.min) && estNombre(o.max)) m.deuxBornes.push({ doc, chemin, cles });
    if (dansTableau && 'max' in o && !('min' in o) && (estNombre(o.max) || o.max === null)) {
      m.borneHauteSeule.push({ doc, chemin, cles });
    }
    if (estNombre(o.rand)) m.rand[doc] = (m.rand[doc] ?? 0) + 1;

    for (const c of cles) walk(o[c], doc, `${chemin}.${c}`, false);
  };
  const documents = (dir: string, prefixe: string): [string, string][] =>
    readdirSync(dir).flatMap((e): [string, string][] => {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) return documents(p, `${prefixe}${e}/`);
      return e.endsWith('.json') ? [[`${prefixe}${e}`, p]] : [];
    });
  for (const [cle, racine] of RACINES) {
    const lus = documents(racine, '');
    m.documentsParRacine[cle] = lus.length;
    for (const [nom, chemin] of lus) walk(JSON.parse(readFileSync(chemin, 'utf8')), nom, '', false);
  }
  return m;
}

const M = mesurer();

describe('deux bornes : une seule graphie, et rien d’emboîté (#1463 L4, vague `plage`)', () => {
  it('A — la marche couvre les DEUX racines de donnée (sinon l’affirmation « dans la donnée » ment)', () => {
    // `src/scenes` ne porte AUCUNE borne aujourd'hui (mesuré 2026-08-31) : les assertions ci-dessous
    // y verrouillent donc le vide. Sans ce compte, ramener la marche à la seule racine `src/data` ne
    // ferait rougir aucun test — la sonde revendiquerait une couverture qu'elle n'a plus.
    const lues = Object.entries(M.documentsParRacine).filter(([, n]) => n > 0).map(([r]) => r).sort();
    expect(
      lues,
      'la marche ne lit plus les DEUX racines de donnée : une graphie de bornes posée dans un document de scène échapperait à tout ce que ce fichier affirme.',
    ).toEqual(['src/data', 'src/scenes']);
  });

  it('A — la SEULE paire de bornes nommée dans la donnée est `min,max`', () => {
    expect(
      Object.keys(M.paires).sort(),
      'une graphie CONCURRENTE de `min,max` est apparue (from/to, de/a, low/high…) : une fourchette s’écrit `{min, max}` — c’est la forme que `findTableEntry` (`src/engine/tables.ts`) lit.',
    ).toEqual(['min,max']);
    expect(M.paires['min,max'], 'la population à deux bornes a disparu : la sonde ne mesure plus rien.').toBeGreaterThan(1400);
  });

  it('A — ce qui reste encodé par la BORNE HAUTE SEULE est INVENTORIÉ : les rangs maximaux de `talents.json`, et rien d’autre', () => {
    // Un RANG maximal n'est PAS une fourchette : `talents.json › max` est le nombre de fois qu'un
    // Talent peut être pris (`null` = sans limite, `{bonusOf}` = un Bonus de Caractéristique).
    // Aucun d100 ne le traverse — il n'a pas de borne basse à porter.
    expect(
      [...new Set(M.borneHauteSeule.map((s) => `${s.doc}${s.chemin}`))].sort(),
      'un document encode ENCORE une table par sa seule borne haute — sa borne basse serait reconstruite par POSITION, donc ni authorée ni éditable, et son lookup ordre-dépendant (cf. `weather.json`/`advancementCosts.json`, migrés le 2026-08-31).',
    ).toEqual(['talents.json[]', 'talents.json[].variants[]']);
  });

  it('A — `rand` (borne haute d100 portée par l’ENTITÉ) est un RESTE NOMMÉ, borné à six documents', () => {
    // Reste ANCRÉ au pilotage de #1463 : sa cible est un document TABLE dédié (DESIGN v2 S1), donc
    // il appartient à la vague `reference`/`pick,table` — pas à celle-ci. Ce qu'on verrouille ici,
    // c'est son PÉRIMÈTRE : il ne doit pas s'étendre à un septième document en attendant.
    expect(
      Object.keys(M.rand).sort(),
      '`rand` a gagné un document : la borne haute portée par l’entité ne s’étend pas — sa cible est un document TABLE dédié (#1463 S1).',
    ).toEqual(['astrology.json', 'eyes.json', 'hairs.json', 'species.json', 'stars.json', 'talents.json']);
  });

  it('B — les bornes d’un RÉGLAGE et celles d’un TIRAGE sont DISJOINTES', () => {
    // Discriminant STRUCTUREL, celui que le lexique déclare (`bornes.coPresence`) : une borne de
    // réglage vit avec sa valeur par défaut ou son pas. Mesuré 2026-08-31 : `kind` seul ne
    // discrimine pas (`oups.json` et `sea-events.json` le portent aussi).
    const estBorne = (s: Site) => s.cles.includes('default') || s.cles.includes('step');
    const bornes = M.deuxBornes.filter(estBorne);
    const tirages = M.deuxBornes.filter((s) => !estBorne(s));
    expect(
      [...new Set(bornes.map((s) => s.doc))],
      'les bornes de DOMAINE d’un réglage ne vivent que dans `reglesOptionnelles.json` : ailleurs, `min,max` est une plage de TIRAGE.',
    ).toEqual(['reglesOptionnelles.json']);
    expect(bornes.length, 'la population des bornes de réglage a disparu : la sonde ne mesure plus rien.').toBeGreaterThan(0);
    expect(
      tirages.filter((s) => s.doc === 'reglesOptionnelles.json'),
      'un réglage porte `min,max` SANS `default` ni `step` : il serait classé plage de tirage (`bornes` passe AVANT `plage` dans le lexique, mais sa co-présence n’est plus vérifiée).',
    ).toEqual([]);
    expect(bornes.filter((b) => tirages.includes(b)), 'intersection non vide entre bornes et tirages.').toEqual([]);
  });

  it('C — la fourchette EMBOÎTÉE `{range: {min, max}}` n’existe NULLE PART', () => {
    // La cible que le lexique déclarait avant le 2026-08-31 (« portée par `range` », #1463 S1) :
    // 0 objet la portait. La cible retenue est la fourchette PLATE, celle que `findTableEntry` lit.
    expect(
      M.emboites,
      'un objet emboîte sa fourchette sous `range` : `findTableEntry` (`src/engine/tables.ts`) lit la forme PLATE `{min, max}` — emboîter fork le lookup partagé.',
    ).toEqual([]);
  });

  it('D — l’en-tête de `STRUCTURES_ORPHELINES` dit ce que le stock MESURE', () => {
    const parMotif: Record<string, { lignes: number; occurrences: number }> = {};
    for (const o of STRUCTURES_ORPHELINES) {
      const v = (parMotif[o.motif] ??= { lignes: 0, occurrences: 0 });
      v.lignes += 1;
      v.occurrences += o.occurrences;
    }
    expect(
      parMotif,
      'la répartition PAR MOTIF des orphelines a bougé : l’en-tête du stock la CITE ligne à ligne, elle ne peut pas dériver en silence.',
    ).toEqual({ 'clé réservée': { lignes: 103, occurrences: 437 }, 'identité non résolue': { lignes: 2, occurrences: 2 } });
    expect(
      parMotif['clé de référence non résolue'],
      'la branche `clé de référence non résolue` (la SEULE que la prose décrivait) s’est peuplée : l’en-tête doit alors la décrire pour de bon.',
    ).toBeUndefined();

    // Le déclencheur `source` : ce que le motif `clé réservée` nomme vraiment — un NOM de clé
    // réservé au lexique, sur un objet dont le CONTENU est légitime (une vraie référence de livre).
    const parSource = STRUCTURES_ORPHELINES.filter((o) => o.signature.split(',').includes('source'));
    expect(
      { lignes: parSource.length, occurrences: parSource.reduce((s, o) => s + o.occurrences, 0) },
      'la part de `source` dans les orphelines a bougé : l’en-tête du stock la CITE comme preuve que le contenu de ces objets est légitime.',
    ).toEqual({ lignes: 65, occurrences: 144 });

    const blocs = readFileSync(join(process.cwd(), 'scripts/guards/lib/structuresStock.mjs'), 'utf8')
      .split('export const STRUCTURES_ORPHELINES')[0]
      .split('/** Objet qui ANNONCE une référence');
    const entete = blocs[blocs.length - 1];
    for (const chiffre of ['103', '437', '2', '65', '144', '105']) {
      expect(entete, `l’en-tête des orphelines ne cite plus le compte \`${chiffre}\` qu’il affirme.`).toContain(chiffre);
    }
    expect(
      entete,
      'l’en-tête des orphelines réaffirme « la valeur pointe vers rien » — mesuré FAUX pour les 103 lignes `clé réservée` : le déclencheur est le NOM de la clé, pas la valeur.',
    ).not.toContain('la valeur pointe vers rien');
  });
});
