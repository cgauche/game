/**
 * Cliquet de l'ⓘ (`ab-codex-info`) — #1078.
 *
 * Une icône ⓘ POSÉE À CÔTÉ d'un contrôle qui porte déjà sa règle est une affordance PARALLÈLE :
 * elle est morte partout où le contrôle lui-même peut porter la référence (`CodexRef wrap`) ou
 * bien où la chip du breakdown la porte (`ModLine.ref`). Le stock restant est ÉNUMÉRÉ par fichier,
 * avec ce qu'il attend — il ne peut que DÉCROÎTRE, jamais remonter.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const UI = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Les SOURCES de `src/ui`, récursivement. Les fichiers de test sont hors sujet : ils NOMMENT la
 *  classe (souvent pour prouver son absence), ils n'affichent aucune affordance. */
function uiFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return uiFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** Occurrences de la classe d'ⓘ, par chemin RELATIF à `src/ui`. */
function infoAffordances(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of uiFiles(join(UI, 'ui'))) {
    const n = (readFileSync(f, 'utf8').match(/ab-codex-info/g) ?? []).length;
    if (n) out[f.slice(join(UI, 'ui').length + 1).replace(/\\/g, '/')] = n;
  }
  return out;
}

/**
 * Stock RESTANT, mesuré. Ce que chaque site attend :
 *  - `jetProps/*` : l'ⓘ est accolé à un CONTRÔLE de choix (menu d'arme, menu de Localisation,
 *    bascule « Tirer dans le tas »/« Je ne bouge pas », case « des deux armes ») — la règle se lit
 *    AVANT que le modificateur n'existe, donc avant qu'une chip ne puisse la porter ;
 *  - `ActionBar`/`CharacterSheet`/`MerchantPanel`/`PossessionsRegistry` : ⓘ d'un ÉLÉMENT de liste
 *    (sort, compétence, possession) sans contrôle englobable à ce jour ;
 *  - `compendium/CodexRef.tsx` : la DÉFINITION de la classe (l'habillage de l'affordance).
 * Toute NOUVELLE occurrence, et tout retour d'une occurrence supprimée, échoue ici.
 */
const RATCHET: Record<string, number> = {
  'ActionBar.tsx': 4,
  'CharacterSheet.tsx': 1,
  'MerchantPanel.tsx': 3,
  'PossessionsRegistry.tsx': 2,
  'compendium/CodexRef.tsx': 1,
  'jetProps/useAttackJetProps.tsx': 7,
  'jetProps/useDefenseJetProps.tsx': 1,
};

describe('ⓘ parallèle — stock ÉNUMÉRÉ et décroissant (#1078)', () => {
  it('aucun ⓘ hors du stock déclaré, et aucun retour d’un ⓘ supprimé', () => {
    expect(infoAffordances()).toEqual(RATCHET);
  });

  it('les surfaces converties n’en portent PLUS aucun (le contrôle EST l’affordance)', () => {
    const measured = infoAffordances();
    for (const f of ['ChanceButtons.tsx', 'ResilienceButton.tsx', 'DeterminationButton.tsx', 'RollRow.tsx', 'RollLine.tsx']) {
      expect(measured[f], `${f} : l’ⓘ est mort dans ce lot, il ne revient pas`).toBeUndefined();
    }
  });
});
