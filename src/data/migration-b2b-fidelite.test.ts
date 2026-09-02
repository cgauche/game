/**
 * FIDÉLITÉ DE LA MIGRATION #1657 B2b — le cycle des maladies passé au nœud `test` du Flow n'a RIEN
 * perdu en route, et le script committé REPRODUIT exactement l'arbre committé.
 *
 * La migration porte déjà sa preuve en post-écriture, mais elle ne la porte QUE le jour où elle
 * écrit : rejouée sur l'état final elle sort en no-op sans rien comparer. Ce test la tient au
 * PRÉSENT, sur l'arbre committé, par une DÉ-MIGRATION entrée par entrée :
 *
 *  A. chaque porteur se dé-migre SANS PERTE — le nœud n'a que les clés que la migration pose
 *     (`kind`/`test`/`success`/`fail`), sa `success` est la séquence vide, sa `fail` est la feuille
 *     `{type:'ops', on:'target'}` et son `test` ne porte que `difficulty`. Une forme que la
 *     migration n'aurait pas pu produire (branche peuplée, `if` imbriqué, clé de jet en plus)
 *     rougit ICI, même si personne ne rejoue le script.
 *  B. ALLER-RETOUR par le VRAI script, sur un arbre JETABLE : la pré-image dé-migrée en A, écrite
 *     dans un arbre temporaire puis remigrée, rend l'arbre committé BYTE POUR BYTE. Aucune fixture
 *     figée à maintenir — la pré-image se DÉRIVE de l'arbre.
 *  C. REJEU : le script relancé sur son propre résultat ne réécrit pas un octet.
 *
 * Périmètre : les DEUX fichiers que la migration déclare en ENTRÉES (`symptoms.json`,
 * `maladies.json`). Le cycle SANS jet (`onTick.ops`, Vers du Reik) se dé-migre en `onFail` — c'est
 * la conséquence CERTAINE, qui portait ce nom menteur avant le lot.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = '2026-09-02-1657-b2b-maladies-noeud-test.mjs';
const FICHIERS = ['symptoms.json', 'maladies.json'] as const;
/** Le porteur du cycle, par fichier — la clé que la migration déclare en ENTRÉES. */
const PORTEUR: Record<string, string> = { 'symptoms.json': 'onTick', 'maladies.json': 'dailyTest' };
/** Cardinaux de la migration (sa table `CARDINAUX`) — recopiés ici pour que le test les EXIGE. */
const CARDINAUX = { onTick: 4, epreuves: 3, certains: 1, dailyTest: 1 };

const lire = (f: string) => readFileSync(join(RACINE, 'src', 'data', f), 'utf8');
const canonique = (v: unknown) => JSON.stringify(v, null, 2);

type Noeud = { kind: string; test: Record<string, unknown>; success: unknown; fail: unknown };
type Porteur = Record<string, unknown>;

/** Écarts de FORME d'un nœud — tout ce que la migration ne pourrait pas avoir produit. */
function ecartsDeForme(n: Noeud): string[] {
  const e: string[] = [];
  if (Object.keys(n).sort().join(',') !== 'fail,kind,success,test') e.push(`cles du noeud : ${Object.keys(n).sort().join(',')}`);
  if (n.kind !== 'test') e.push(`kind « ${n.kind} »`);
  if (Object.keys(n.test).join(',') !== 'difficulty') e.push(`cles du jet : ${Object.keys(n.test).join(',')}`);
  if (canonique(n.success) !== canonique({ kind: 'seq', steps: [] })) e.push(`branche success PEUPLEE : ${canonique(n.success)}`);
  const f = n.fail as { kind?: string; effect?: Record<string, unknown> };
  if (f.kind !== 'do') e.push(`branche fail a EMBRANCHEMENT (« ${f.kind} »)`);
  else if (Object.keys(f.effect ?? {}).sort().join(',') !== 'on,ops,type' || f.effect!.type !== 'ops' || f.effect!.on !== 'target') {
    e.push(`feuille d'echec hors forme : ${canonique(f.effect)}`);
  }
  return e;
}

/** Reconstruit la forme ANCIENNE d'un porteur (`{difficulty?, onFail, …}`), en PRÉSERVANT l'ordre des clés. */
function demigrer(p: Porteur): { avant: Porteur; ecarts: string[] } {
  const ecarts: string[] = [];
  const avant: Porteur = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'test') {
      const n = v as Noeud;
      ecarts.push(...ecartsDeForme(n));
      avant.difficulty = n.test.difficulty;
      avant.onFail = (n.fail as { effect: { ops: unknown[] } }).effect.ops;
    } else if (k === 'ops') {
      avant.onFail = v;
    } else {
      avant[k] = v;
    }
  }
  return { avant, ecarts };
}

/** L'arbre committé, dé-migré fichier par fichier — la PRÉ-IMAGE, dérivée, jamais figée. */
function preImage(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of FICHIERS) {
    const doc = JSON.parse(lire(f)) as Porteur[];
    out[f] = canonique(doc.map((e) => (e[PORTEUR[f]] ? { ...e, [PORTEUR[f]]: demigrer(e[PORTEUR[f]] as Porteur).avant } : e)));
  }
  return out;
}

describe('migration #1657 B2b — fidélité, aller-retour et rejeu', () => {
  it('A. chaque porteur se DÉ-MIGRE sans perte, et aucune forme hors migration n’a été authorée', () => {
    const ecarts: string[] = [];
    const compte = { onTick: 0, epreuves: 0, certains: 0, dailyTest: 0 };
    for (const f of FICHIERS) {
      for (const e of JSON.parse(lire(f)) as Porteur[]) {
        const p = e[PORTEUR[f]] as Porteur | undefined;
        if (!p) continue;
        if (f === 'symptoms.json') {
          compte.onTick++;
          if (p.test) compte.epreuves++;
          else compte.certains++;
        } else compte.dailyTest++;
        const { avant, ecarts: ec } = demigrer(p);
        ecarts.push(...ec.map((m) => `${f}/${String(e.id)}.${PORTEUR[f]} : ${m}`));
        // La forme ancienne est COMPLÈTE : une conséquence, et une Difficulté dès qu'il y a un jet.
        if (!Array.isArray(avant.onFail) || !avant.onFail.length) ecarts.push(`${f}/${String(e.id)} : consequence VIDE apres de-migration`);
        if (p.test && avant.difficulty === undefined) ecarts.push(`${f}/${String(e.id)} : epreuve sans Difficulte recouvree`);
        if (p.ops && 'difficulty' in avant) ecarts.push(`${f}/${String(e.id)} : effet certain porteur d'une Difficulte`);
      }
    }
    expect(ecarts).toEqual([]);
    expect(compte).toEqual(CARDINAUX);
  });

  it('B/C. ALLER-RETOUR par le VRAI script : la pré-image remigrée rend l’arbre committé, et le rejeu est no-op', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mig-1657-b2b-'));
    try {
      mkdirSync(join(dir, 'scripts', 'migrations'), { recursive: true });
      mkdirSync(join(dir, 'src', 'data'), { recursive: true });
      const script = join(dir, 'scripts', 'migrations', SCRIPT);
      copyFileSync(join(RACINE, 'scripts', 'migrations', SCRIPT), script);
      const avant = preImage();
      for (const f of FICHIERS) writeFileSync(join(dir, 'src', 'data', f), avant[f], 'utf8');
      // La pré-image DIFFÈRE de l'arbre : sans quoi le script sortirait en no-op et ne prouverait rien.
      for (const f of FICHIERS) expect(avant[f], `${f} : pre-image identique a l'arbre`).not.toBe(lire(f));

      execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' });
      for (const f of FICHIERS) expect(readFileSync(join(dir, 'src', 'data', f), 'utf8'), f).toBe(lire(f));

      const apres = FICHIERS.map((f) => readFileSync(join(dir, 'src', 'data', f), 'utf8'));
      execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' });
      FICHIERS.forEach((f, i) => expect(readFileSync(join(dir, 'src', 'data', f), 'utf8'), `${f} : rejeu non no-op`).toBe(apres[i]));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
