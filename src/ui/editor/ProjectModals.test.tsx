// @vitest-environment jsdom
/** #367 : « Ouvrir » liste AUSSI les campagnes built-in (Arène + campagnes du jeu), dans une
 *  section distincte de « Mes projets » — ouvrir une built-in ouvre une COPIE de travail (jamais
 *  d'écriture sur le JSON commité), signalée à l'écran. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpenProjectModal } from './ProjectModals';
import { allBuiltinCampaigns } from '../../scenes/campaign';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('OpenProjectModal — section « Campagnes du jeu » (#367)', () => {
  it('liste toutes les campagnes built-in (Arène + builtinCampaigns), pas seulement les projets localStorage', () => {
    const html = renderToStaticMarkup(
      <OpenProjectModal onScenario={() => {}} onProject={() => {}} onBuiltin={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain('Campagnes du jeu');
    expect(allBuiltinCampaigns.length).toBeGreaterThan(0);
    expect(html).toContain('Arène'); // « L'Arène » (apostrophe = entité HTML en SSR)
    for (const bc of allBuiltinCampaigns.slice(1)) {
      expect(html).toContain(bc.label);
    }
    expect(html).toContain('ouvre en copie'); // « s’ouvre en copie » (apostrophe = entité HTML en SSR)
  });

  it('« Ouvrir » sur une campagne built-in appelle onBuiltin avec cette campagne (jamais onProject)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const onBuiltin = vi.fn();
    const onProject = vi.fn();
    await act(async () => {
      root.render(<OpenProjectModal onScenario={() => {}} onProject={onProject} onBuiltin={onBuiltin} onClose={() => {}} />);
    });
    const first = allBuiltinCampaigns[0];
    const row = Array.from(container.querySelectorAll('.listrow')).find((el) => el.textContent?.includes(first.label));
    expect(row).toBeTruthy();
    const btn = row!.querySelector('button.btn-primary') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(onBuiltin).toHaveBeenCalledWith(first);
    expect(onProject).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
