// @vitest-environment jsdom
/**
 * Chips de modificateur CODEX-LIÉES (#1078 LOT B3a). Trois contrats :
 *  1. une ligne qui porte sa RÈGLE (`ModLine.ref`) rend un `CodexRef` CLIQUABLE (la chip EST
 *     l'affordance — il n'y a plus d'ⓘ voisin) ;
 *  2. son popover s'ouvre DANS le corps DÉFILABLE d'une `RollShell` (`.rs-scroll`) sans être
 *     coupé : `CodexRef` le rend en PORTAL sur `document.body`, hors du scrollport ;
 *  3. la PROVENANCE se NOMME au rendu : aucun producteur ne passe de résolveur (recette B3a —
 *     un site qui l'oubliait affichait « pregen-101 » à l'écran).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RollShell } from './RollShell';
import { RULE_REF } from '../engine/ruleRefs';
import type { PendingRoll } from './RollLine';
import { soutienMod } from '../engine/skills';
import { useGame } from '../state/store';
import type { Combatant } from '../engine/types';

const mount = (node: React.ReactElement) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
};

const pending = (mods: PendingRoll['mods']): PendingRoll => ({ label: 'Projectiles', base: 55, mods });

function shell(mods: PendingRoll['mods']) {
  return (
    <RollShell
      title="Tir"
      rows={[{ row: { pending: pending(mods) }, rolled: false }]}
      rolled={false}
      actions={[]}
    />
  );
}

describe('ModChips — la chip PORTE sa règle (#1078)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); }); // démonte aussi les portals de popover (React les possède)
    container.remove();
  });

  it('ligne AVEC ref → chip CodexRef cliquable ; ligne SANS ref → span muet', () => {
    ({ container, root } = mount(shell([
      { label: 'Viser', value: 20, ref: RULE_REF.viser },
      { label: 'Avantage', value: 10 },
    ])));
    const chips = [...container.querySelectorAll('.rm-mod')];
    expect(chips).toHaveLength(2);
    const [viser, avantage] = chips;
    expect(viser.textContent).toBe('+20 Viser');
    expect(viser.classList.contains('codex-ref')).toBe(true);
    expect(viser.getAttribute('role')).toBe('button'); // cliquable → ouvre la fiche Codex
    expect(viser.getAttribute('tabindex')).toBe('0');
    // La ligne sans règle ne prétend rien : ni popover, ni clic.
    expect(avantage.classList.contains('codex-ref')).toBe(false);
    expect(avantage.getAttribute('role')).toBeNull();
  });

  it('POPOVER dans le corps DÉFILÉ (.rs-scroll) : porté sur document.body, hors du scrollport', () => {
    ({ container, root } = mount(shell([{ label: 'Viser', value: 20, ref: RULE_REF.viser }])));
    const scroll = container.querySelector('.rs-scroll');
    expect(scroll, 'la coquille rend bien son corps défilable').not.toBeNull();
    const chip = container.querySelector('.rm-mod.codex-ref') as HTMLElement;
    expect(scroll!.contains(chip), 'la chip vit DANS le scrollport').toBe(true);

    act(() => { chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    const pop = document.querySelector('.codex-pop');
    expect(pop, 'le popover est rendu').not.toBeNull();
    // Le PORTAL : le popover n'est PAS un descendant du scrollport (aucun clipping `overflow`
    // possible), il est monté directement sous <body>.
    expect(scroll!.contains(pop!)).toBe(false);
    expect(pop!.parentElement).toBe(document.body);
    // Et il porte bien le texte de la RÈGLE (verbatim `regles.json`), pas un rappel maison.
    expect(pop!.textContent).toContain('viser');
  });

  it('provenance `by` : un badge par soutien, NOM seul tant qu’aucune catégorie ne l’expose', () => {
    ({ container, root } = mount(shell([
      { label: 'Soutien', value: 20, ref: RULE_REF.soutien, by: [{ label: 'Perdita' }, { label: 'Valentyn' }] },
    ])));
    // Badge PARTAGÉ `.entity-badge` (base.css), pas une classe mono-écran de plus.
    const by = [...container.querySelectorAll('.rm-roll-mods .entity-badge')].map((n) => n.textContent);
    expect(by).toEqual(['Perdita', 'Valentyn']);
    // Aucun lien inventé : sans catégorie, le badge n'est pas cliquable.
    expect(container.querySelector('.rm-roll-mods .entity-badge')!.getAttribute('role')).toBeNull();
  });

  // ── Recette B3a, capture 07 : « pregen-101 » s'affichait parce que `medicFlow` n'avait pas passé
  //    de résolveur id→nom. La résolution est REMONTÉE au rendu : aucun producteur n'en fournit.
  it('les badges rendent les NOMS du store — AUCUN site ne passe de résolveur', () => {
    const party = [
      { id: 'pregen-101', label: 'Perdita' },
      { id: 'pregen-102', label: 'Valentyn' },
    ] as Combatant[];
    useGame.setState({ party, battle: null });
    // `soutienMod` est le producteur RÉEL, appelé comme tout site l'appelle : un seul argument.
    const mod = soutienMod({ count: 2, bonus: 20, ids: ['pregen-101', 'pregen-102'] })!;
    expect(mod.by, 'le moteur reste PUR : il ne connaît que des ids').toEqual([{ id: 'pregen-101' }, { id: 'pregen-102' }]);

    ({ container, root } = mount(shell([mod])));
    const by = [...container.querySelectorAll('.rm-roll-mods .entity-badge')].map((n) => n.textContent);
    expect(by).toEqual(['Perdita', 'Valentyn']);
    // L'id BRUT ne fuit jamais à l'écran.
    expect(container.textContent).not.toContain('pregen-101');
  });

  it('un `label` qui vaut son propre id (repli fautif) est RÉSOLU comme s’il était absent', () => {
    useGame.setState({ party: [{ id: 'pregen-101', label: 'Perdita' }] as Combatant[], battle: null });
    ({ container, root } = mount(shell([
      { label: 'Soutien', value: 10, ref: RULE_REF.soutien, by: [{ id: 'pregen-101', label: 'pregen-101' }] },
    ])));
    expect(container.querySelector('.rm-roll-mods .entity-badge')!.textContent).toBe('Perdita');
  });

  it('provenance INCONNUE du store : le badge retombe sur son id, jamais sur un vide muet', () => {
    useGame.setState({ party: [], battle: null });
    ({ container, root } = mount(shell([
      { label: 'Soutien', value: 10, ref: RULE_REF.soutien, by: [{ id: 'fantome-9' }] },
    ])));
    expect(container.querySelector('.rm-roll-mods .entity-badge')!.textContent).toBe('fantome-9');
  });
});
