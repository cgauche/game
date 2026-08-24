import { useRef, useState, type ReactNode } from 'react';
import { useModalA11y } from './Modal';
import { MenuSubScreen } from './MenuCard';
import { Tabs } from './Tabs';
import { KeyBindingsPanel } from './KeyBindingsPanel';
import { AudioControls } from './AudioControls';
import { PreferencesPanel } from './PreferencesPanel';
import { HouseRulesPanel } from './HouseRulesModal';
import { t } from '../i18n';

type OptTab = 'keys' | 'audio' | 'prefs' | 'rules';

/**
 * CORPS UNIQUE de l'écran Options — Clavier · Audio · Confort · Règles maison. Composé À L'IDENTIQUE
 * par les DEUX foyers : le sous-écran Options du menu SYSTÈME en jeu (`GameMenu`) et l'écran Options
 * du menu PRINCIPAL hors partie (`OptionsScreen` ci-dessous). Aucun fork par foyer : un seul panneau
 * clavier, un seul audio, un seul `PreferencesPanel`, un seul `HouseRulesPanel`.
 *
 * Le corps vit dans `.menu-sub-body` (défileur UNIQUE, plafonné par `.game-menu-sub-wide`) : la barre
 * d'onglets tient en tête quel que soit l'onglet, Clavier compris.
 */
export function OptionsPanel() {
  const [tab, setTab] = useState<OptTab>('keys');
  return (
    <>
      <Tabs
        label={t('gameMenu.options')}
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'keys', label: t('gameMenu.options.tab.keys') },
          { key: 'audio', label: t('gameMenu.options.tab.audio') },
          { key: 'prefs', label: t('gameMenu.options.tab.prefs') },
          { key: 'rules', label: t('gameMenu.options.tab.rules') },
        ]}
      />
      <div className="menu-sub-body">
        {tab === 'keys' && <KeyBindingsPanel />}
        {tab === 'audio' && <AudioControls />}
        {tab === 'prefs' && <PreferencesPanel />}
        {tab === 'rules' && <HouseRulesPanel />}
      </div>
    </>
  );
}

/**
 * Écran Options du MENU PRINCIPAL (hors partie) — même voile, même carte et mêmes onglets que le
 * sous-écran Options du menu système : `MenuSubScreen` + `OptionsPanel`. Le menu principal donne donc
 * accès aux touches, à l'audio et au confort AVANT de lancer une partie, et les règles optionnelles y
 * sont un onglet parmi les autres. A11y de dialogue (focus piégé, Échap = fermeture) via
 * `useModalA11y`, comme `GameMenu`.
 */
export function OptionsScreen({ onClose, title = t('gameMenu.options') }: { onClose: () => void; title?: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose, { kind: 'options' }); // aucun early-return : monté = affiché
  return (
    <div className="game-menu-overlay" role="dialog" aria-modal="true" aria-label={t('gameMenu.options')} ref={boxRef}>
      <MenuSubScreen title={title} onBack={onClose} wide>
        <OptionsPanel />
      </MenuSubScreen>
    </div>
  );
}
