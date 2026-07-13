import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emojisIn } from '../../scripts/guards/lib/emojiAffordance.mjs';

/**
 * Garde-fou anti-emoji (LOT 4) : les AFFORDANCES de l'UI passent par le registre d'icônes
 * (`src/ui/icons/` + `<Icon id>` / `<IconG id>`), plus jamais par un emoji dans le code ou la
 * donnée. Ce test de BUILD scanne les sources (fs) : tout emoji hors de la liste d'exceptions
 * ci-dessous fait échouer la suite. MIGRER un fichier = le retirer des exceptions (une exception
 * devenue propre est inoffensive — elle ne force rien).
 * Mécanique de détection (plages Unicode, glyphes tolérés, `emojisIn`) :
 * `scripts/guards/lib/emojiAffordance.mjs` (module .mjs pur, partagé avec un futur hook pre-commit).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // racine du projet (src/ui/ → ../../)
const SCAN_DIRS = ['src/ui', 'src/state', 'src/gameIso', 'src/scenes', 'src/i18n'];

/** Fichiers exclus par NATURE (pas par état de migration) :
 *  - `*.test.*` : les tests portent les emojis de leurs composants non migrés et sont réécrits
 *    AVEC leur composant (ils ne rendent rien à l'utilisateur) ;
 *  - `_registry.generated.ts` : en-tête « ⚠ généré » émis par scripts/gen-registry.mjs. */
const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel) || rel.endsWith('_registry.generated.ts');

/** EXCEPTIONS — fichiers hors périmètre du garde d'AFFORDANCE. #139 CLOS (2026-07-06) : familles A
 *  (47 fichiers UI/éditeur, ~90 emoji) ET B (préfixes de LOG/journal `src/state`, `desc`/prose de
 *  donnée, descriptions de scénarios de test) sont ENTIÈREMENT migrées — liste VIDE. Rester vide :
 *  toute nouvelle affordance passe par `<Icon id>`/`<IconG id>` (jamais un emoji, même « juste pour
 *  l'instant ») ; un emoji de LOG/journal se retire tout autant (texte affiché à l'utilisateur). */
const EXCEPTIONS = new Set<string>([]);

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e)) files.push(p);
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  for (const e of readdirSync(join(ROOT, 'src/data'))) if (e.endsWith('.json')) files.push(join(ROOT, 'src/data', e));
  // #290 — projets de campagne (`src/scenes/**/*.json`, données de dialogue/scène) : mêmes affordances
  // que le code, jamais un emoji collé au `text` d'un choix (cf. `DialogueChoice.icon`, `<Icon>`).
  const walkJson = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walkJson(p);
      else if (e.endsWith('.json')) files.push(p);
    }
  };
  walkJson(join(ROOT, 'src/scenes'));
  return files;
}

describe('garde-fou anti-emoji (affordances → registre d’icônes)', () => {
  it('aucun emoji hors exceptions dans src/ui, src/state, src/gameIso, src/scenes et src/data/*.json', () => {
    const offenders: string[] = [];
    for (const f of scanFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (EXCLUDED(rel) || EXCEPTIONS.has(rel)) continue;
      const hits = emojisIn(readFileSync(f, 'utf8'));
      if (hits.length) offenders.push(`${rel} → ${hits.join(' ')}`);
    }
    expect(offenders, 'Emoji d’affordance détecté — utiliser <Icon id> (src/ui/icons/) ou ajouter une exception JUSTIFIÉE').toEqual([]);
  });

  it('CLIQUET : toute exception dont le fichier est devenu propre (ou a disparu) doit être RETIRÉE', () => {
    // Sans ce resserrage, la liste ne fond jamais : une exception nettoyée par un lot suivant resterait
    // inerte. Ici elle devient rouge → la dette se rembourse mécaniquement au fil des migrations.
    const stale: string[] = [];
    for (const rel of EXCEPTIONS) {
      let text: string;
      try { text = readFileSync(join(ROOT, rel), 'utf8'); }
      catch { stale.push(`${rel} → fichier disparu`); continue; }
      if (emojisIn(text).length === 0) stale.push(`${rel} → plus aucun emoji`);
    }
    expect(stale, 'Exception(s) PÉRIMÉE(s) — retirer ces entrées de EXCEPTIONS').toEqual([]);
  });
});
