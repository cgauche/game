/**
 * Tracé d'un DÉPLACEMENT (chemin + case d'arrivée + badge d'action) — source unique du rendu, partagée
 * entre l'aperçu tap-1 (battle.preview, tactile), l'aperçu au SURVOL (desktop), l'aperçu hors combat et
 * le télégraphe de déplacement ENNEMI (teinté).
 */
import { Dims, tileCenter, diamondPath } from '../iso';
import { footprintTiles } from '../../state/footprint';
import type { Pt } from '../../state/path';

// `lift` = élévation-écran (px) d'un point selon son étage z (multi-niveau) ; défaut `() => 0` ⇒ tracé
// plan-sol byte-identique pour tous les appelants mono-niveau (z absent ⇒ lift 0 ⇒ tileCenter/diamondPath
// sans 4ᵉ argument). Un appelant de COMBAT passe `(p) => p.z ? liftAt(...) : 0` → chemin/destination posés
// au bon étage (rempart) au lieu d'être écrasés sur la cour.
export function movePreviewEls(path: Pt[], dest: Pt | null, label: string | null, d: Dims, keyPrefix: string, color = 'var(--combat-gold)', footN = 1, lift: (p: Pt) => number = () => 0): JSX.Element[] {
  const els: JSX.Element[] = [];
  if (path.length > 1) {
    const pts = path.map((p) => tileCenter(p.x, p.y, d, lift(p))).map((p) => `${p.cx},${p.cy}`).join(' ');
    els.push(<polyline key={`${keyPrefix}-path`} points={pts} fill="none" stroke={color} strokeWidth={3} opacity={0.9} pointerEvents="none" />);
  }
  // Destination = TOUTE l'empreinte du mobile (un grand / un cavalier sur monture 2×2 → 4 cases), pas
  // une seule (footN dérivé de la monture par l'appelant). footN=1 → un losange unique (iso-historique).
  const dz = dest ? lift(dest) : 0; // toute l'empreinte est au même étage que la destination
  if (dest) for (const t of footprintTiles(dest, footN)) els.push(<path key={`${keyPrefix}-dest-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, d, dz)} fill="none" stroke={color} strokeWidth={3} opacity={0.95} pointerEvents="none" />);
  const at = dest ?? (path.length ? path[path.length - 1] : null);
  if (label && at) {
    const c0 = tileCenter(at.x, at.y, d, lift(at));
    els.push(<text key={`${keyPrefix}-lbl`} x={c0.cx} y={c0.cy - 28} textAnchor="middle" className="pv-badge" pointerEvents="none">{label}</text>);
  }
  return els;
}
