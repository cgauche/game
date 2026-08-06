/**
 * SOCLE des SETS D'ÉQUIPEMENT quadrupèdes (#1128 L1) — deux contrats :
 *
 *  1. ÉTANCHÉITÉ du registre `harnais/defs/` : id kebab-case unique, gabarits DÉCLARÉS connus du
 *     registre d'espèces, clés de déco visant un os réel du gabarit (et une vue réelle). Le
 *     prédicat est PUR et mesuré d'abord sur des defs factices — valides ET fautives — puis appliqué
 *     au registre réel : une garde qui ne mordrait que sur le stock présent passerait à vide le jour
 *     où ce stock est vide.
 *  2. PIPELINE d'atelier : un dessin `<set>@<espèce>-<vue>.dessin.mts` compile sur le gabarit de
 *     l'espèce nommée, la sortie est IDEMPOTENTE, et sa désynchronisation fait ROUGIR `--check`
 *     (la porte de commit) — vert de nouveau après régénération PAR LE GÉNÉRATEUR.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUAD_HARNAIS } from './index';
import type { QuadHarnaisDef } from './types';
import { buildQuadSkeleton } from '../quadSkeleton';
import { QUAD_SPECIES, WINGED_SPECIES } from '../../creatures';

const SPECIES = { ...QUAD_SPECIES, ...WINGED_SPECIES };
/** Os RÉELS des gabarits (union sur toutes les espèces : les os d'aile n'existent que chez les ailés). */
const OS = new Set(Object.values(SPECIES).flatMap((p) => Object.keys(buildQuadSkeleton(p))));
const VUES = new Set(['profile', 'front', 'back']);

/** Violations du contrat d'un set — liste VIDE = def étanche. */
function violations(d: QuadHarnaisDef): string[] {
  const v: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.id)) v.push(`id non kebab-case : « ${d.id} »`);
  if (!d.especes.length) v.push(`${d.id} : aucun gabarit déclaré`);
  for (const e of d.especes) if (!(e in SPECIES)) v.push(`${d.id} : gabarit inconnu « ${e} »`);
  for (const cle of Object.keys(d.deco)) {
    const [os, vue] = cle.split('#');
    if (!OS.has(os)) v.push(`${d.id} : os inconnu « ${os} »`);
    if (vue !== undefined && !VUES.has(vue)) v.push(`${d.id} : vue inconnue « ${vue} »`);
  }
  return v;
}

const set = (over: Partial<QuadHarnaisDef> = {}): QuadHarnaisDef => ({
  id: 'sellerie-factice',
  label: 'Sellerie factice',
  especes: ['cheval'],
  deco: { tronc: '<path d="M0 0 L1 1 Z" fill="@corps"/>', 'tete#profile': '<path d="M0 0 L1 1 Z" fill="@corps"/>' },
  ...over,
});

describe('registre des sets d\'équipement quadrupèdes : étanchéité', () => {
  it('une def conforme ne lève AUCUNE violation', () => {
    expect(violations(set())).toEqual([]);
  });

  it('id non kebab-case, gabarit inconnu, gabarits vides, os ou vue inconnus sont REFUSÉS', () => {
    expect(violations(set({ id: 'Sellerie_Imperiale' }))).toContain('id non kebab-case : « Sellerie_Imperiale »');
    expect(violations(set({ especes: ['licorne-de-verre'] }))).toContain('sellerie-factice : gabarit inconnu « licorne-de-verre »');
    expect(violations(set({ especes: [] }))).toContain('sellerie-factice : aucun gabarit déclaré');
    expect(violations(set({ deco: { selle: '<path/>' } as QuadHarnaisDef['deco'] })))
      .toContain('sellerie-factice : os inconnu « selle »');
    expect(violations(set({ deco: { 'tronc#trois-quarts': '<path/>' } as QuadHarnaisDef['deco'] })))
      .toContain('sellerie-factice : vue inconnue « trois-quarts »');
  });

  it('le registre réel est étanche, et sa table est keyée par l\'`id` de chaque def', () => {
    const defs = Object.values(QUAD_HARNAIS);
    expect(defs.flatMap(violations)).toEqual([]);
    for (const [cle, d] of Object.entries(QUAD_HARNAIS)) expect(cle).toBe(d.id);
    expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
  });
});

// ── pipeline d'atelier : dessin de set → compilé, sous la porte `--check` ─────────────────────
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const SET = 'set-factice-l1';
const DESSIN = join(ROOT, `src/gameIso/rig/quadruped/atelier/harnais/${SET}@boeuf-profil.dessin.mts`);
const COMPILE = join(ROOT, 'src/gameIso/rig/quadruped/harnais/setFacticeL1ProfilCompile.ts');

const compilateur = (...args: string[]) =>
  spawnSync(process.execPath, [join(ROOT, 'node_modules/tsx/dist/cli.mjs'), join(ROOT, 'scripts/rig/compile-dessin-quad.mts'), ...args],
    { cwd: ROOT, encoding: 'utf8' });
const md5 = (f: string) => createHash('md5').update(readFileSync(f)).digest('hex');

describe('compilation d\'un dessin de SET (gabarit lu du suffixe @espèce)', () => {
  it('compile, reste idempotent, ROUGIT à la désynchro et REVERDIT après régénération', () => {
    mkdirSync(dirname(DESSIN), { recursive: true });
    writeFileSync(DESSIN, [
      '/** Fixture de test (#1128 L1) — écrite et supprimée par quad-harnais.test.ts. */',
      'export interface GroupeDessin { bone: string; svg: string }',
      'export const DESSIN: GroupeDessin[] = [',
      '  { bone: \'tronc\', svg: \'<path d="M40 80 L70 80 L70 92 L40 92 Z" fill="@corps"/>\' },',
      '  { bone: \'tete\', svg: \'<path d="M88 62 L98 62 L98 70 L88 70 Z" fill="@corps"/>\' },',
      '];',
      '',
    ].join('\n'));
    try {
      const un = compilateur(SET);
      expect(un.stderr + un.stdout).toContain(`harnais/${SET}@boeuf-profil.dessin.mts`);
      expect(un.status).toBe(0);
      expect(existsSync(COMPILE), 'la sortie du set vit sous quadruped/harnais/').toBe(true);

      const texte = readFileSync(COMPILE, 'utf8');
      expect(texte).toContain('export const SET_FACTICE_L1_PROFIL_COMPILE: Record<string, string> = {');
      expect(texte).toContain(`depuis atelier/harnais/${SET}@boeuf-profil.dessin.mts`);
      // Cuisson monde → local effectuée : les coordonnées du dessin ne survivent pas telles quelles.
      expect(texte).not.toContain('M40 80');
      expect(texte).toMatch(/^ {2}tronc: "/m);
      expect(texte).toMatch(/^ {2}tete: "/m);

      const empreinte = md5(COMPILE);
      expect(compilateur(SET).status, 'seconde compilation').toBe(0);
      expect(md5(COMPILE), 'idempotence : même dessin → même octet').toBe(empreinte);
      expect(compilateur('--check', SET).status, '--check sur un compilé à jour').toBe(0);

      // DÉSYNCHRO d'un octet du compilé → la porte doit refuser.
      writeFileSync(COMPILE, `${readFileSync(COMPILE, 'utf8')} `);
      const rouge = compilateur('--check', SET);
      expect(rouge.status, '--check sur un compilé désynchronisé').toBe(1);
      expect(rouge.stderr).toContain('sortie(s) divergentes du dessin');

      // Remise en état PAR LE GÉNÉRATEUR (jamais une restauration à la main) → empreinte retrouvée.
      expect(compilateur(SET).status).toBe(0);
      expect(md5(COMPILE)).toBe(empreinte);
      expect(compilateur('--check', SET).status).toBe(0);
    } finally {
      rmSync(DESSIN, { force: true });
      rmSync(COMPILE, { force: true });
    }
  }, 180_000);
});
