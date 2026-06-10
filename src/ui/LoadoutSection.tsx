import type { Combatant, ItemInstance } from '../engine/types';
import { weaponHands } from '../engine/items';

interface Props {
  hero: Combatant;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetActive: (id: string) => void;
  onSetSlot: (id: string, slot: 'main' | 'off', uid: string | null) => void;
}

/** Constructeur de loadouts (sets d'armes) : nom, actif, slots main/secondaire depuis les armes portées.
 *  Une arme à 2 mains en principale grise le slot secondaire (LDB : 2 mains). */
export function LoadoutSection({ hero, onCreate, onRename, onDelete, onSetActive, onSetSlot }: Props) {
  const loadouts = hero.loadouts ?? [];
  const weapons: ItemInstance[] = (hero.items ?? []).filter((i) => i.kind === 'melee' || i.kind === 'ranged');
  const oneHanded = weapons.filter((w) => weaponHands(w) === 1);

  return (
    <div className="sheet-loadouts">
      <div className="mini-title">Sets d'armes (loadouts)</div>
      {loadouts.length === 0 && <p className="muted">Aucun set. Créez-en un pour choisir vos armes en main.</p>}
      {loadouts.map((lo) => {
        const mainItem = weapons.find((w) => w.uid === lo.main);
        const mainTwoHanded = mainItem ? weaponHands(mainItem) === 2 : false;
        const active = hero.activeLoadoutId === lo.id;
        return (
          <div key={lo.id} className={`loadout-row ${active ? 'active' : ''}`}>
            <button className={`btn small ${active ? 'btn-primary' : ''}`} title="Rendre actif" onClick={() => onSetActive(lo.id)}>
              {active ? '● Actif' : 'Activer'}
            </button>
            <input className="lo-name" value={lo.name} onChange={(e) => onRename(lo.id, e.target.value)} />
            <label className="lo-slot">Main
              <select value={lo.main ?? ''} onChange={(e) => onSetSlot(lo.id, 'main', e.target.value || null)}>
                <option value="">— vide —</option>
                {weapons.map((w) => (
                  <option key={w.uid} value={w.uid}>{w.name}{weaponHands(w) === 2 ? ' (2M)' : ''}</option>
                ))}
              </select>
            </label>
            <label className="lo-slot">2nde
              <select value={lo.off ?? ''} disabled={mainTwoHanded} onChange={(e) => onSetSlot(lo.id, 'off', e.target.value || null)}>
                <option value="">{mainTwoHanded ? '— (2 mains) —' : '— vide —'}</option>
                {oneHanded.filter((w) => w.uid !== lo.main).map((w) => (
                  <option key={w.uid} value={w.uid}>{w.name}</option>
                ))}
              </select>
            </label>
            <button className="btn small" title="Supprimer ce set" onClick={() => onDelete(lo.id)}>🗑</button>
          </div>
        );
      })}
      <button className="btn small" onClick={() => onCreate(`Set ${loadouts.length + 1}`)}>+ Nouveau loadout</button>
    </div>
  );
}
