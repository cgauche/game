import { useState } from 'react';
import { useGame } from '../state/store';
import { listSaves } from '../state/saves';
import { SaveLoadModal } from './SaveLoadModal';
import { HouseRulesModal } from './HouseRulesModal';
import { RuleDivider } from './Ornaments';
import { Icon } from './Icon';
import { t } from '../i18n';

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const openCodex = useGame((s) => s.openCodex);
  const setPendingCampaign = useGame((s) => s.setPendingCampaign);
  const [loadOpen, setLoadOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const hasSaves = listSaves().some((m) => m != null);

  return (
    <div className="menu tx-ink">
      <div className="menu-card">
        <h1 className="title">{t('menu.title')}</h1>
        <p className="subtitle">{t('menu.subtitle')}</p>
        <RuleDivider />
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={() => { setPendingCampaign(null); setScreen('party'); }}>
            <Icon id="nav/new-game" /> {t('menu.newGame')}
          </button>
          <button className="btn" onClick={() => setLoadOpen(true)} title={hasSaves ? t('menu.load.titleHas') : t('menu.load.titleEmpty')}>
            <Icon id="nav/load" /> {t('menu.load')}
          </button>
          <button className="btn" onClick={() => setScreen('coop')}>
            <Icon id="nav/online" /> {t('menu.online')}
          </button>
          <button className="btn" onClick={() => setRulesOpen(true)} title={t('menu.houseRules.title')}>
            <Icon id="nav/rules" /> {t('menu.houseRules')}
          </button>
          <button className="btn" onClick={() => openCodex()} title={t('menu.compendium.title')}>
            <Icon id="nav/compendium" /> {t('menu.compendium')}
          </button>
        </div>
        <div className="rule-fleur menu-tools-rule" aria-hidden>{t('menu.workshop')}</div>
        <div className="menu-buttons menu-tools">
          <button className="btn" onClick={() => setScreen('editor')}>
            <Icon id="nav/editor" /> {t('menu.editor')}
          </button>
          <button className="btn btn-test" onClick={() => setScreen('test')}>
            <Icon id="nav/test-scenarios" /> {t('menu.testScenarios')}
          </button>
          <a className="btn menu-link" href="galeries.html" target="_blank" rel="noopener">
            <Icon id="nav/art-gallery" /> {t('menu.galleries')}
          </a>
        </div>
        <p className="footnote">{t('menu.footnote')}</p>
      </div>
      {loadOpen && <SaveLoadModal mode="load" onClose={() => setLoadOpen(false)} />}
      {rulesOpen && <HouseRulesModal onClose={() => setRulesOpen(false)} />}
    </div>
  );
}
