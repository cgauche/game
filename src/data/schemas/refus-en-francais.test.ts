/**
 * LANGUE des refus de schéma (#1588) — règle 4 : l'écran est en français, et un refus de schéma EST
 * ce que l'auteur lit quand le Compendium ou l'éditeur rejettent sa saisie. La carte d'erreurs FR de
 * zod est posée UNE fois (`grammaire/locale-fr.ts`).
 *
 * Trois volets, chacun sur le chemin RÉEL de son cas :
 *  - la porte par FICHIER (`validateDataset`) — le refus que le Compendium rend au save ;
 *  - la porte de la modale « Avancé » de l'éditeur (`SCHEMA_BLOCS_AVANCES` + `formatZodError`,
 *    `src/ui/editor/Editor.tsx:910`), qui ne passe PAS par le registre de documents ;
 *  - la GARDE DE CLASSE : tout fichier de `src/data/schemas/**` qui importe zod en VALEUR atteint la
 *    locale transitivement. Sans elle, un def futur bâti sur `ref`/`avancement` seuls parlerait
 *    anglais sans qu'aucun banc ne bouge.
 *
 * Le refus reste NOMINATIF : chemin du champ et options attendues sont conservés. Traduire n'est pas
 * appauvrir.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clotureDImports } from '../../../scripts/guards/lib/importGraph.mjs';
import { listerArbre } from '../../../scripts/guards/lib/lister.mjs';
import { validateDataset, formatZodError } from './validate';
import { SCHEMA_BLOCS_AVANCES } from '../../ui/editor/Editor';
import weatherJson from '../weather.json';

/** Les mots que zod prononce en ANGLAIS, toutes familles d'issue confondues (sa locale `en`). */
const ANGLAIS = /\bInvalid\b|\bToo small\b|\bToo big\b|\bUnrecognized keys?\b|\bexpected\b|\breceived\b/;

const copie = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('les refus de schéma parlent français (#1588)', () => {
  it('porte par FICHIER — une OPTION hors énumération : refus français, au chemin, options conservées', () => {
    const doc = copie(weatherJson) as { conditions: { id: string }[] };
    doc.conditions[2].id = 'crachin';

    const dit = validateDataset('weather.json', doc);

    expect(dit, 'le document corrompu doit être refusé').not.toBeNull();
    expect(dit).not.toMatch(ANGLAIS);
    expect(dit).toContain('conditions.2.id');
    // Les options attendues restent NOMMÉES : un refus qui dirait seulement « invalide » n'apprend rien.
    expect(dit).toContain('"sec"');
    expect(dit).toContain('"blizzard"');
  });

  /**
   * La modale « Avancé » colle un JSON de trois blocs de logique. Le cas MESURÉ à l'écran le
   * 2026-09-21 (`{"dialogues": 42}`) : c'est CETTE paire — `SCHEMA_BLOCS_AVANCES.safeParse` puis
   * `formatZodError('Blocs de logique', …)` — que `saveAdvanced` pose dans `advError`, et rien
   * d'autre ne transforme le texte entre là et le `role="alert"` (`Editor.tsx:1239`).
   */
  it('porte de la modale « Avancé » — un bloc au MAUVAIS TYPE : refus français, au chemin', () => {
    const lu = SCHEMA_BLOCS_AVANCES.safeParse({ dialogues: 42 });

    expect(lu.success, 'un bloc au mauvais type doit être refusé').toBe(false);
    const dit = formatZodError('Blocs de logique', lu.error!);

    expect(dit).not.toMatch(ANGLAIS);
    expect(dit).toBe('Blocs de logique — JSON invalide contre son schéma :\n  - dialogues: Entrée invalide : tableau attendu, nombre reçu');
  });

  /**
   * GARDE DE CLASSE — la question n'est pas « ces deux cas parlent-ils français ? » mais « un schéma
   * PEUT-IL naître hors de la locale ? ». Réponse mesurée sur le graphe d'imports d'EXÉCUTION : un
   * `import type` est effacé à la compilation et ne porte aucun effet de module, il ne compte donc
   * pas comme une atteinte (`typesEffaces`, `scripts/guards/lib/importGraph.mjs`).
   */
  it('GARDE — tout fichier de `schemas/**` important zod en VALEUR atteint la locale', () => {
    const PERIMETRE = 'src/data/schemas';
    const LOCALE = `${PERIMETRE}/grammaire/locale-fr.ts`;
    const ZOD_EN_VALEUR = /^[ \t]*import[ \t]+(?!type[ \t])[^\n]*from[ \t]*['"]zod['"]/m;

    const porteurs = listerArbre(PERIMETRE, { filtre: (rel) => rel.endsWith('.ts') && !rel.includes('.test.') })
      .map((rel) => `${PERIMETRE}/${rel}`)
      .filter((f) => f !== LOCALE && ZOD_EN_VALEUR.test(readFileSync(resolve(f), 'utf8')));

    expect(porteurs.length, 'périmètre vide = faux vert : la garde ne mesurerait rien').toBeGreaterThan(100);

    // Cache PARTAGÉ : les 128 marches sont du MÊME régime (`typesEffaces`), et se recouvrent presque
    // toutes — sans partage, chaque module de la grammaire est relu et re-résolu à chaque def.
    const cache = new Map<string, string[] | null>();
    const orphelins = porteurs.filter((f) => !clotureDImports([resolve(f)], { typesEffaces: true, cache }).has(LOCALE));
    expect(orphelins).toEqual([]);
  });
});
