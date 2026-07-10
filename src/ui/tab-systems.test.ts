import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cliquet de COMPTE #288 : les systèmes d'onglets CSS (sélecteurs `.*tabs`) sont gelés aux 5
 * systèmes recensés — `.port-tabs`, `.zone-tabs`, `.logic-tabs`, `.merchant-tabs`+`.merch-subtabs`,
 * `.sheet-tabs`. Un 6e système (nouvelle classe de sélecteur `.xxx-tabs` non répertoriée) échoue :
 * avant d'en écrire un, réutiliser un système existant (ou une future primitive `<Tabs>`).
 */

const UI = fileURLToPath(new URL('.', import.meta.url)); // src/ui/

function walk(dir: string, test: (f: string) => boolean, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, test, acc);
    else if (test(e)) acc.push(p);
  }
  return acc;
}
const rel = (abs: string) => abs.slice(UI.length).split('\\').join('/');

/** Classe → système canonique (5 systèmes recensés, #288). */
const SYSTEM_OF: Record<string, string> = {
  'port-tabs': 'port',
  'zone-tabs': 'zone',
  'logic-tabs': 'logic',
  'merchant-tabs': 'merchant',
  'merch-subtabs': 'merchant',
  'sheet-tabs': 'sheet',
};
const SYSTEM_COUNT = new Set(Object.values(SYSTEM_OF)).size; // 5

/** Sélecteurs de classe `.xxxtabs`/`.xxx-tabs` définis (déclaration `{`) dans un fichier CSS. */
function tabClassSelectors(src: string): string[] {
  const out: string[] = [];
  const re = /\.([A-Za-z][\w-]*tabs)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

describe('#288 — cliquet de COMPTE des systèmes d’onglets CSS (gelé à 5)', () => {
  it('aucune classe `.*tabs` hors des 5 systèmes recensés', () => {
    const files = walk(UI, (e) => e.endsWith('.css'));
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const cls of new Set(tabClassSelectors(src))) {
        if (!(cls in SYSTEM_OF)) offenders.push(`${rel(f)} → .${cls}`);
      }
    }
    expect(
      offenders,
      `Nouveau système d'onglets CSS (6e+) — réutiliser un système existant (${Object.keys(SYSTEM_OF).join(', ')}) ou introduire une primitive <Tabs> partagée :\n` + offenders.join('\n'),
    ).toEqual([]);
  });

  it('CLIQUET : SYSTEM_OF reste gelé à 5 systèmes distincts', () => {
    expect(SYSTEM_COUNT).toBe(5);
  });
});
