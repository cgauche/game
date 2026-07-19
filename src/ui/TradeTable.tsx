import { Fragment, type ReactNode } from 'react';
import { Coins } from './Coins';
import type { Money } from '../engine/money';

/**
 * TABLE MARCHANDE canonique (#371 LOT 3) — moissonnée de l'étalon `MerchantPanel` (Acheter/Parcourir,
 * `.merch-table`) : colonnes paramétrables, rangées grisées + raison quand inabordable, cellule prix
 * `<Coins>` unique, action par rangée, sections optionnelles par rubrique (groupes). Tout écran de
 * négoce (marchand, port, marché terrestre) COMPOSE cette table au lieu de recoder son propre tableau.
 */
export interface TradeColumn<T> {
  key: string;
  label: ReactNode;
  /** Colonne mise en avant (1re info clé — dégâts, PA…) : style `col-emph`. */
  emph?: boolean;
  render: (row: T) => ReactNode;
}

export interface TradeGroup<T> {
  key: string;
  /** Sous-titre de rubrique (ex. famille d'armes) — masqué s'il n'y a qu'un seul groupe. */
  label?: ReactNode;
  rows: T[];
}

export interface TradeTableProps<T> {
  /** Colonnes de STATS entre le nom et le prix (peut être vide). */
  columns: TradeColumn<T>[];
  groups: TradeGroup<T>[];
  rowKey: (row: T) => string;
  label: (row: T) => ReactNode;
  /** Colonne Encombrement optionnelle. */
  enc?: (row: T) => ReactNode;
  price: (row: T) => Money | null | undefined;
  action: (row: T) => ReactNode;
  /** Rangée inabordable/indisponible : grisée (`unaffordable`) — `reason` en `title` de la rangée. */
  disabled?: (row: T) => boolean | { reason?: string };
  /** Fiche de détail dépliable sous la rangée (clic sur le nom — géré par l'appelant via `label`). */
  detail?: (row: T) => ReactNode;
  open?: (row: T) => boolean;
  className?: string;
  /** En-têtes des colonnes fixes (défaut « Enc »/« Prix ») — ex. « Prix/Enc » pour une cargaison en vrac. */
  encLabel?: ReactNode;
  priceLabel?: ReactNode;
}

export function TradeTable<T>({ columns, groups, rowKey, label, enc, price, action, disabled, detail, open, className, encLabel = 'Enc', priceLabel = 'Prix' }: TradeTableProps<T>) {
  const span = 1 + columns.length + (enc ? 1 : 0) + 2; // nom + stats + enc? + prix + action
  const showGroupLabels = groups.length > 1;

  const rowState = (row: T): { off: boolean; reason?: string } => {
    const d = disabled?.(row);
    if (!d) return { off: false };
    if (d === true) return { off: true };
    return { off: true, reason: d.reason };
  };

  const renderRow = (row: T) => {
    const key = rowKey(row);
    const { off, reason } = rowState(row);
    const isOpen = open?.(row) ?? false;
    const p = price(row);
    const detailContent = isOpen ? detail?.(row) : null;
    return (
      <Fragment key={key}>
        <tr className={`trade-row ${off ? 'unaffordable' : ''} ${isOpen ? 'open' : ''}`} title={off ? reason : undefined}>
          <td className="col-name">{label(row)}</td>
          {columns.map((c) => (
            <td key={c.key} className={c.emph ? 'col-emph' : 'col-stat'}>{c.render(row)}</td>
          ))}
          {enc && <td className="col-enc">{enc(row)}</td>}
          <td className="col-price">{p ? <Coins money={p} /> : '—'}</td>
          <td className="col-buy">{action(row)}</td>
        </tr>
        {detailContent && (
          <tr className="detail-row"><td colSpan={span}>{detailContent}</td></tr>
        )}
      </Fragment>
    );
  };

  return (
    <table className={`trade-table${className ? ` ${className}` : ''}`}>
      <thead>
        <tr>
          <th className="col-name">Objet</th>
          {columns.map((c) => (
            <th key={c.key} className={c.emph ? 'col-emph' : 'col-stat'}>{c.label}</th>
          ))}
          {enc && <th className="col-enc" title="Encombrement">{encLabel}</th>}
          <th className="col-price">{priceLabel}</th>
          <th className="col-buy" aria-label="Action" />
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <Fragment key={g.key}>
            {showGroupLabels && g.label != null && <tr className="group-row"><td colSpan={span}>{g.label}</td></tr>}
            {g.rows.map(renderRow)}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
