import { describe, it, expect } from 'vitest';
import { spells } from './index';

/**
 * Garde STRUCTURELLE : tout `op:'wounds'` d'un sort DÉCLARE sa mitigation.
 *
 * `GameOp` `wounds` ignore par DÉFAUT le Bonus d'Endurance ET les Points d'Armure
 * (`src/engine/ops.ts`, type `wounds`) — l'inverse du défaut RAW, où les Dégâts sont réduits par
 * les deux (LDB 13). Un `wounds` qui n'écrit ni `ignoreTB` ni `ignoreAP` hérite donc SILENCIEUSEMENT
 * de l'exception, jamais de la règle : le silence est indistinguable de l'oubli. On exige les DEUX
 * champs écrits, sur CHAQUE `wounds` de `spells.json` (aucune liste d'exception) — la valeur reste
 * libre, c'est la DÉCLARATION qui est obligatoire, et elle se relit contre la `desc` verbatim.
 */

type AnyRec = Record<string, unknown>;

/** Tout objet `{op:'wounds'}` atteignable depuis `node`, à profondeur quelconque (Flow, ops
 *  imbriquées `delayed`/`grant`, branches `success`/`fail`…). */
function collectWounds(node: unknown, acc: AnyRec[] = []): AnyRec[] {
  if (Array.isArray(node)) {
    for (const n of node) collectWounds(n, acc);
    return acc;
  }
  if (node && typeof node === 'object') {
    const rec = node as AnyRec;
    if (rec.op === 'wounds') acc.push(rec);
    for (const v of Object.values(rec)) collectWounds(v, acc);
  }
  return acc;
}

describe('mitigation des Dégâts : tout `wounds` de sort la DÉCLARE', () => {
  it('aucun `op:"wounds"` sans `ignoreTB` ET `ignoreAP` explicites', () => {
    const undeclared: string[] = [];
    for (const sp of spells) {
      for (const w of collectWounds(sp)) {
        const missing = (['ignoreTB', 'ignoreAP'] as const).filter((k) => !(k in w));
        if (missing.length) undeclared.push(`${sp.id} : ${missing.join('+')} absent(s)`);
      }
    }
    expect(undeclared).toEqual([]);
  });

  it('couvre bien la classe (≥ 20 `wounds` mesurés)', () => {
    const n = spells.reduce((acc, sp) => acc + collectWounds(sp).length, 0);
    expect(n).toBeGreaterThanOrEqual(20);
  });
});
