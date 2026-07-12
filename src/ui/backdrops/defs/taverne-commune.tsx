import type { BackdropDef } from '../types';

/** Taverne commune — silhouettes sobres (poutre, table, lueur de cheminée), à raffiner par un
 *  artiste (structure d'abord, cf. brief #371). Tokens `var(--…)` uniquement. */
export const backdrop: BackdropDef = {
  id: 'taverne-commune',
  label: 'Taverne commune',
  render: () => (
    <svg viewBox="0 0 320 96" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <rect x={0} y={0} width={320} height={96} fill="var(--panel2)" />
      <rect x={0} y={0} width={320} height={10} fill="var(--bg2)" opacity={0.6} />
      <rect x={30} y={0} width={10} height={96} fill="var(--bg2)" opacity={0.35} />
      <rect x={150} y={0} width={10} height={96} fill="var(--bg2)" opacity={0.35} />
      <rect x={270} y={0} width={10} height={96} fill="var(--bg2)" opacity={0.35} />
      <circle cx={230} cy={30} r={26} fill="var(--gold)" opacity={0.18} />
      <rect x={190} y={62} width={80} height={8} rx={2} fill="var(--border)" />
      <rect x={200} y={44} width={8} height={18} fill="var(--border)" />
      <rect x={252} y={44} width={8} height={18} fill="var(--border)" />
      <rect x={40} y={70} width={70} height={7} rx={2} fill="var(--bg2)" />
    </svg>
  ),
};
