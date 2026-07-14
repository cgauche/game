import { useRef, useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { useModalA11y } from './Modal';
import { ScreenMeta } from './ScreenMeta';
import { MenuCard, MenuSection, MenuButton } from './MenuCard';
import { Tabs } from './Tabs';
import { Icon } from './Icon';
import { KeyBindingsPanel } from './KeyBindingsPanel';
import { HouseRulesPanel } from './HouseRulesModal';
import { AudioControls } from './AudioControls';
import { CoopMenuSection, GmSoloToggle } from './CoopPanels';
import { t } from '../i18n';

/**
 * Menu SYSTÈME plein écran (pause) — bouton ☰ de la barre HUD ET touche Échap (binding `toggle-menu`,
 * `state.gameMenuOpen`) l'ouvrent quand aucune modale n'est active. Voile sombre + colonne d'entrées :
 * MÊME langage que le menu principal (`MainMenu`), tous deux composant `MenuCard`. Contenu STRICT à six
 * entrées (Reprendre · Sauvegarder/Charger · Coopération · Options · Fin de séance · Quitter) ; la
 * Coopération et les Options sont des SOUS-ÉCRANS (retour au menu), jamais des widgets inline.
 * A11y de dialogue (`role="dialog"`, focus piégé, Échap = Retour/Fermer) via `useModalA11y`. Pur à props
 * pour ce qui délègue vers le haut (Sauvegarder/Charger, Fin de séance, Quitter) ; le reste est composé ici.
 */
type MenuView = 'root' | 'coop' | 'options';
type OptTab = 'keys' | 'audio' | 'rules';

export function GameMenu({ sceneName, time, onQuit, onSaveLoad, onEndSession, initialView = 'root', initialOpen = false }: {
  sceneName?: string;
  /** Horloge de campagne (minutes depuis l'époque) — méta d'en-tête discrète (lieu + date, jamais la bourse). */
  time: number;
  onQuit: () => void;
  /** Ouvre la modale Sauvegarder/Charger (Jalon 5) — absent en combat (sauvegarde refusée) ou chez l'invité. */
  onSaveLoad?: () => void;
  /** Ouvre l'écran de fin de séance (Ambitions + Détermination + Chance restaurée) — exploration seule. */
  onEndSession?: () => void;
  /** Sous-écran affiché à l'ouverture — aide de test (défaut `root`). */
  initialView?: MenuView;
  /** Force l'ouverture — aide de test (le rendu SSR de zustand v5 lit l'état INITIAL, pas `gameMenuOpen`). */
  initialOpen?: boolean;
}) {
  const storeOpen = useGame((s) => s.gameMenuOpen);
  const open = storeOpen || initialOpen;
  const setOpen = useGame((s) => s.setGameMenu);
  const [view, setView] = useState<MenuView>(initialView);
  const [tab, setTab] = useState<OptTab>('keys');
  const boxRef = useRef<HTMLDivElement>(null);

  const close = () => { setOpen(false); setView('root'); };
  // Une entrée qui délègue vers le haut FERME d'abord le menu (la modale/écran cible s'ouvre par-dessus la scène).
  const act = (fn?: () => void) => () => { close(); fn?.(); };
  // Échap / bouton Retour : depuis un sous-écran on remonte au menu ; depuis le menu on ferme.
  const back = () => { if (view !== 'root') setView('root'); else close(); };
  useModalA11y(boxRef, open ? back : undefined);

  return (
    <div className="game-menu">
      <button
        type="button"
        className="gm-btn"
        aria-label={open ? t('gameMenu.close') : t('gameMenu.menu')}
        aria-expanded={open}
        title={open ? t('gameMenu.close') : t('gameMenu.menu')}
        onClick={() => (open ? close() : setOpen(true))}
      >
        ☰
      </button>
      {open && (
        <div className="game-menu-overlay" role="dialog" aria-modal="true" aria-label={t('gameMenu.menu')} ref={boxRef}>
          {view === 'root' && (
            <MenuCard
              className="game-menu-card"
              header={<div className="menu-card-head">
                <h2 className="menu-card-title">{t('gameMenu.menu')}</h2>
                <div className="menu-card-meta">
                  {sceneName && <span className="menu-card-sub">{t('gameMenu.scene')} — {sceneName}</span>}
                  <ScreenMeta meta={{ time }} />
                </div>
              </div>}
            >
              <MenuSection rule={false}>
                <MenuButton icon="ui/round-start" onClick={close}>{t('gameMenu.resume')}</MenuButton>
                <MenuButton icon="file/save" disabled={!onSaveLoad} onClick={act(onSaveLoad)} title={onSaveLoad ? undefined : 'Indisponible en combat'}>{t('gameMenu.saveLoad')}</MenuButton>
                <MenuButton icon="nav/online" onClick={() => setView('coop')}>{t('gameMenu.section.coop')}</MenuButton>
                <MenuButton icon="ui/settings" onClick={() => setView('options')}>{t('gameMenu.options')}</MenuButton>
                <MenuButton icon="resource/xp" disabled={!onEndSession} onClick={act(onEndSession)} title={onEndSession ? undefined : 'Indisponible en combat'}>{t('gameMenu.endSession')}</MenuButton>
                <MenuButton icon="map-tool/door" onClick={onQuit}>{t('gameMenu.quit')}</MenuButton>
              </MenuSection>
            </MenuCard>
          )}

          {view === 'coop' && (
            <MenuSubScreen title={t('gameMenu.section.coop')} onBack={back}>
              <p className="hint">{t('gameMenu.coop.hint')}</p>
              <CoopMenuSection />
              <GmSoloToggle />
            </MenuSubScreen>
          )}

          {view === 'options' && (
            <MenuSubScreen title={t('gameMenu.options')} onBack={back} wide>
              <Tabs
                label={t('gameMenu.options')}
                active={tab}
                onChange={setTab}
                tabs={[
                  { key: 'keys', label: t('gameMenu.options.tab.keys') },
                  { key: 'audio', label: t('gameMenu.options.tab.audio') },
                  { key: 'rules', label: t('gameMenu.options.tab.rules') },
                ]}
              />
              <div className="menu-sub-body">
                {tab === 'keys' && <KeyBindingsPanel />}
                {tab === 'audio' && <AudioControls />}
                {tab === 'rules' && <HouseRulesPanel />}
              </div>
            </MenuSubScreen>
          )}
        </div>
      )}
    </div>
  );
}

/** Sous-écran du menu système (Coopération, Options) : même carte plein écran, en-tête Retour + titre. */
function MenuSubScreen({ title, onBack, wide, children }: {
  title: ReactNode;
  onBack: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <MenuCard
      className={`game-menu-card game-menu-sub${wide ? ' game-menu-sub-wide' : ''}`}
      header={<div className="menu-card-head menu-sub-head">
        <button type="button" className="btn small btn-ghost menu-back" onClick={onBack}>
          <Icon id="ui/undo" size="sm" /> {t('gameMenu.back')}
        </button>
        <h2 className="menu-card-title">{title}</h2>
      </div>}
    >
      {children}
    </MenuCard>
  );
}
