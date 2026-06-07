import type { SceneEntity } from '../../state/scene';

/**
 * Liste sélectionnable de toutes les entités de la scène — permet de sélectionner une entité
 * même cachée sous un bâtiment/overlay ou hors écran (que le clic-sur-case ne peut pas atteindre).
 */
export function EntityListPanel({
  entities,
  selectedId,
  onSelect,
}: {
  entities: SceneEntity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!entities.length) return null;
  const ICON: Record<string, string> = { heroStart: '🏁', personnage: '🙂', objet: '📦', prop: '🌳' };
  return (
    <div className="ed-entity-list">
      <h4>Entités ({entities.length})</h4>
      <ul>
        {entities.map((e) => (
          <li key={e.id} className={e.id === selectedId ? 'sel' : ''} onClick={() => onSelect(e.id)} style={{ cursor: 'pointer' }}>
            {ICON[e.kind] ?? '•'} {e.label ?? e.ref ?? e.id} <span className="pos">({e.pos.x},{e.pos.y})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
