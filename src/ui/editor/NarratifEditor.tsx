import { useState } from 'react';
import { ScreenShell } from '../ScreenShell';
import { Tabs, type TabItem } from '../Tabs';
import { Icon } from '../Icon';
import type { NarratifBlock } from '../../state/campaignNarratif';

/**
 * Éditeur du bloc NARRATIF d'un paquet de campagne (#765) — overlay plein-champ (`ScreenShell`, même
 * coquille que la Carte du monde). Chaque onglet LISTE en lecture les
 * entrées embarquées du narratif (par id) ; les formulaires d'authoring sont couverts par
 * #670/#671. Frontière RÉFÉRENCE vs NARRATIF : ces entrées référencent la règle globale PAR ID.
 */
type NarratifTab = 'affaires' | 'indices' | 'presetsPnj' | 'objets';

export function NarratifEditor({ narratif, onClose }: { narratif: NarratifBlock; onClose: () => void }) {
  const [tab, setTab] = useState<NarratifTab>('affaires');

  const tabs: TabItem<NarratifTab>[] = [
    { key: 'affaires', label: 'Affaires', count: narratif.affaires.length },
    { key: 'indices', label: 'Indices', count: narratif.indices.length },
    { key: 'presetsPnj', label: 'PNJ', count: narratif.presetsPnj.length },
    { key: 'objets', label: 'Objets', count: narratif.objets.length },
  ];

  return (
    <ScreenShell
      title={<><Icon id="nav/compendium" size="sm" /> Narratif de la campagne</>}
      onClose={onClose}
      body="centered"
      tabs={<Tabs tabs={tabs} active={tab} onChange={setTab} label="Rubriques du narratif" />}
    >
      {tab === 'affaires' && (
        narratif.affaires.length === 0
          ? <p className="empty">Aucune affaire dans cette campagne.</p>
          : narratif.affaires.map((a) => (
              <div key={a.id} className="listrow">
                <span className="lr-name">{a.titre}</span>
                <span className="chip">{a.id}</span>
              </div>
            ))
      )}
      {tab === 'indices' && (
        narratif.indices.length === 0
          ? <p className="empty">Aucun indice dans cette campagne.</p>
          : narratif.indices.map((i) => (
              <div key={i.id} className="listrow">
                <span className="lr-name">{i.titre}</span>
                <span className="chip">{i.kind === 'rumeur' ? 'Rumeur' : 'Indice'}</span>
                <span className="chip">{i.id}</span>
              </div>
            ))
      )}
      {tab === 'presetsPnj' && (
        narratif.presetsPnj.length === 0
          ? <p className="empty">Aucun PNJ pré-composé dans cette campagne.</p>
          : narratif.presetsPnj.map((p) => (
              <div key={p.id} className="listrow">
                <span className="lr-name">{p.profil?.label ?? p.base ?? p.id}</span>
                <span className="chip">{p.id}</span>
              </div>
            ))
      )}
      {tab === 'objets' && (
        narratif.objets.length === 0
          ? <p className="empty">Aucun objet narratif dans cette campagne.</p>
          : narratif.objets.map((o) => (
              <div key={o.id} className="listrow">
                <span className="lr-name">{o.label}</span>
                <span className="chip">{o.id}</span>
              </div>
            ))
      )}
    </ScreenShell>
  );
}
