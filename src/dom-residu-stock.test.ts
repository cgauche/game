// @vitest-environment jsdom
/**
 * Cliquet du stock des fuites DOM (#1619) : la barrière de `src/test-setup.ts` échoue au fichier qui
 * laisse un nœud dans `document.body` ; `scripts/guards/lib/domResiduStock.mjs` liste les fuites
 * connues, en EXTINCTION. Ce fichier verrouille les deux : le verdict de la barrière et la décroissance.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { residusDom, cleFichierTest, messageResiduDom } from './test-setup';
import { DOM_RESIDU_STOCK } from '../scripts/guards/lib/domResiduStock.mjs';

/** Population mesurée le 2026-09-01 sur les 299 fichiers de test jsdom. Ne peut que DÉCROÎTRE. */
const MAX_DOM_RESIDU = 12;

describe('barrière de fuite DOM — verdict', () => {
  it('nomme le fichier ET les nœuds laissés dans document.body', () => {
    const div = document.createElement('div');
    div.className = 'fuite-jouet';
    document.body.appendChild(div);
    try {
      const residus = residusDom(document.body);
      expect(residus).toEqual(['<div class="fuite-jouet">']);
      const msg = messageResiduDom('src/ui/JouetQuiFuit.test.tsx', residus, new Set());
      expect(msg).toContain('src/ui/JouetQuiFuit.test.tsx');
      expect(msg).toContain('<div class="fuite-jouet">');
    } finally {
      div.remove(); // ce fichier ne fuit pas : il démonte son propre jouet
    }
  });

  it('se tait pour un fichier du stock d’extinction, et pour un body vide', () => {
    expect(messageResiduDom('src/ui/CharacterSheet.test.tsx', ['<div>'], DOM_RESIDU_STOCK)).toBeNull();
    expect(messageResiduDom('src/ui/JouetQuiFuit.test.tsx', [], new Set())).toBeNull();
    expect(residusDom(document.body)).toEqual([]);
  });

  it('la clé de stock est le chemin POSIX relatif à la racine, quelle que soit la séparation', () => {
    expect(cleFichierTest('C:\\dépôt\\src\\ui\\A.test.tsx', 'C:\\dépôt')).toBe('src/ui/A.test.tsx');
    expect(cleFichierTest('/dépôt/src/ui/A.test.tsx', '/dépôt')).toBe('src/ui/A.test.tsx');
  });
});

describe('stock d’extinction — cliquet', () => {
  it('ne CROÎT pas', () => {
    expect(
      DOM_RESIDU_STOCK.size,
      `DOM_RESIDU_STOCK a GONFLÉ (${DOM_RESIDU_STOCK.size} > ${MAX_DOM_RESIDU}) — une fuite neuve se DÉMONTE, jamais ne se stocke.`,
    ).toBeLessThanOrEqual(MAX_DOM_RESIDU);
  });

  it('ne porte que des fichiers existants (une ligne morte se retire)', () => {
    const fantomes = [...DOM_RESIDU_STOCK].filter((f) => !existsSync(f));
    expect(fantomes, `ligne(s) du stock sans fichier — retirer de domResiduStock.mjs :\n${fantomes.join('\n')}`).toEqual([]);
  });
});
