/**
 * DÉRIVEUR de la LIGNE DE DÉ du journal (#1262 V3 Lj) — la ligne se DÉRIVE de la structure de jet
 * (porteur, libellé, dé/cible, DR, issue), elle ne s'écrit pas au site.
 *
 * Un jet dont AUCUNE fenêtre n'a montré le dé (rangée résolue d'office d'une bande, étape mono d'un
 * pilote immédiat, repli sans pilote humain, sous-jet interne) a le journal pour SEULE surface : la
 * ligne y porte donc le dé, la cible, l'issue et le DR — au PATRON UNIQUE (`casc.autoRowTrace` et ses
 * variantes sans porteur / sans DR), jamais à la main.
 *
 * `issue` : le domaine peut fournir son verdict en clair (« il tient bon », « le Sort est DISSIPÉ ») ;
 * à défaut, réussi/échec. Le patron, lui, ne lui appartient pas.
 *
 * Voisin : `describeTestRoll` (ops.ts) rend la ligne de parité des Tests résolus INLINE par une op /
 * un trigger, avec son propre patron (`op.testRoll`).
 */
import { t } from '../i18n';

/** Structure LUE par le dériveur — celle qu'une rangée/étape porte déjà (`CascadeRoll`, `TestResult`). */
export interface TraceRow {
  /** Porteur du jet (libellé résolu). Absent → le libellé nomme déjà qui lance. */
  who?: string;
  /** Libellé du jet (Compétence/Caractéristique testée, avec sa situation). Défaut : « Test ». */
  label?: string;
  roll: number;
  target: number;
  /** Degré de Réussite. Absent → le jet n'en porte pas (tirage de disponibilité…). */
  sl?: number;
  success: boolean;
  /** Verdict en clair du domaine. Défaut : réussi/échec. */
  issue?: string;
}

/** LA ligne de dé d'un jet, au patron unique. */
export function traceLineOf(row: TraceRow): string {
  const dr = row.sl != null ? `${row.sl >= 0 ? '+' : ''}${row.sl}` : null;
  const key = row.who
    ? (dr != null ? 'casc.autoRowTrace' : 'casc.rowTraceNoDr')
    : (dr != null ? 'casc.rowTraceAnon' : 'casc.rowTraceAnonNoDr');
  return t(key, {
    ...(row.who != null ? { who: row.who } : {}),
    label: row.label ?? t('casc.autoRowFallbackLabel'),
    roll: row.roll,
    target: row.target,
    issue: row.issue ?? t(row.success ? 'casc.autoRowHit' : 'casc.autoRowMiss'),
    ...(dr != null ? { dr } : {}),
  });
}
