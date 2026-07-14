import { useRef, type ReactNode } from 'react';
import { Modal } from './Modal';
import { RollRow, type RollRowProps, DEFAULT_ROLL_LABEL } from './RollRow';
import { useRollFrisson } from './useRollFrisson';
import { DiceRoll } from './DiceRoll';
import { d100Faces } from './Dice';
import { FLOW_VERBS } from '../state/rollFlowSpecs';

/**
 * RollShell — LA coquille UNIQUE des modales de jet différé (mono, opposé, ou N contributeurs).
 * Une seule enveloppe (`Modal` ou zone embarquée), un ORDRE de zones fixe, et une barre d'actions
 * DATA-DRIVEN filtrée par phase.
 *
 *   overlay → titre → sous-titre → instruction → extra → setup (pré-jet) → rangées (`RollRow`)
 *   → outcome/summary → postRollExtra → forcedExtra → `.modal-actions`
 *
 * Cardinalité des rangées :
 * - **mono** : 1 rangée interactive → l'issue passe par `outcome` (sous la liste) ;
 * - **opposé** : 2 rangées (1 interactive + 1 témoin `interactive:false`) ;
 * - **multi** : N rangées + `summary` (agrégat) — `summary` masqué si absent.
 *
 * La phase courante est `rolled` (au moins un jet lancé). Les actions déclarent `when` :
 * `'pre'` (avant jet), `'post'` (après), `'always'` (toujours) — le shell filtre. Aucune classe CSS
 * nouvelle : réutilise `Modal`/`roll-modal`·`test-modal`, `test-actor`/`rm-vs`, `mini-title`,
 * `cs-rows`, `modal-actions` — donc restyler/étendre se fait à UN endroit.
 */

/** Donnée d'UNE rangée de jet du shell = les props de `RollRow` (ligne + cycle d'influence propre).
 *  Le shell fournit `rolled` globalement si la rangée ne le porte pas. */
export type RollRowData = RollRowProps & { key?: string | number };

/** Un bouton de la barre d'actions, filtré par phase (`when`). Rendu dans `.modal-actions`. La
 *  PROÉMINENCE (style) n'est PLUS choisie par l'appelant : elle se DÉDUIT du RÔLE porté par la `key`
 *  (cf. `actionClass`) — un même verbe a le même poids visuel dans toutes les modales. */
export interface RollAction {
  key: string;
  label: ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  /** Phase où le bouton est VISIBLE : avant le jet / après / toujours. */
  when: 'pre' | 'post' | 'always';
}

/** Rôle visuel d'une action DÉDUIT de sa `key` (les appelants ne le choisissent plus) : abandon /
 *  secondaire = ghost ; ressource (Chance/Destin…) = resource ; tout le reste (validation, progression,
 *  jet groupé : confirm/apply/next/finish/continue/rollAll/all…) = primary. Source UNIQUE de la
 *  proéminence des barres de jet — restyler un rôle se fait ICI, jamais au call-site. */
const ACTION_GHOST_KEYS = new Set(['cancel', 'break', 'ack']);
const ACTION_RESOURCE_KEYS = new Set<string>();
function actionClass(key: string): string {
  if (ACTION_GHOST_KEYS.has(key)) return 'btn btn-ghost';
  if (ACTION_RESOURCE_KEYS.has(key)) return 'btn btn-resource';
  return 'btn btn-primary';
}

/** Commandes de barre NEUTRES (≠ verbes de cadence portés par les RANGÉES) présentes dans les
 *  modales : abandon / validation / progression. Toute AUTRE clé d'action doit être un verbe DÉCLARÉ
 *  du flux (`flowKey`) — sinon dérive (#211 : une action re-boulonnée hors du vocabulaire déclaré). */
const NEUTRAL_ACTION_KEYS = new Set(['cancel', 'confirm', 'apply', 'rollAll', 'next', 'finish', 'continue', 'all', 'ack', 'break']);

/** DEV : verrouille la surface d'actions d'une modale de jet à son vocabulaire (verbes du flux +
 *  neutres). Une clé hors-vocabulaire LÈVE — le choke-point relie la barre aux verbes DÉCLARÉS. */
function assertActionVocabulary(flowKey: keyof typeof FLOW_VERBS, actions: RollAction[]): void {
  const declared: readonly string[] = FLOW_VERBS[flowKey].verbs;
  for (const a of actions) {
    if (!NEUTRAL_ACTION_KEYS.has(a.key) && !declared.includes(a.key)) {
      throw new Error(
        `RollShell[${flowKey}] : action « ${a.key} » hors vocabulaire (verbes du flux : ${declared.join(', ')} ; neutres : ${[...NEUTRAL_ACTION_KEYS].join(', ')}).`,
      );
    }
  }
}

export function RollShell({
  title,
  variant = 'roll',
  subtitle,
  instruction,
  embedded = false,
  disableEscClose = false,
  extra,
  setup,
  rows,
  rolled,
  winnerIndex,
  netSL,
  outcome,
  summary,
  postRollExtra,
  forcedExtra,
  actions,
  onCancel,
  flowKey,
}: {
  title: ReactNode;
  /** Famille de classes : 'roll' (rm-vs) / 'test' (test-actor). */
  variant?: 'roll' | 'test';
  subtitle?: ReactNode;
  /** Ligne d'instruction sous le sous-titre (`mini-title`). */
  instruction?: ReactNode;
  /** Rendu EMBARQUÉ (zone de jet d'une modale persistante) : même contenu, sans l'enveloppe `Modal`. */
  embedded?: boolean;
  /** N'attache PAS Échap à l'annulation (flux où l'on ne peut pas fermer — défense obligatoire). */
  disableEscClose?: boolean;
  /** Contenu optionnel AVANT les rangées (portraits, sélecteur de cible, choix de virage…). */
  extra?: ReactNode;
  /** Contenu métier PRÉ-JET uniquement (options : choix d'arme/localisation, Parade/Esquive…). */
  setup?: ReactNode;
  /** Les rangées de jet, rendues via `RollRow`. 1 = mono ; 2 = opposé ; N = multi. */
  rows: RollRowData[];
  /** Phase GLOBALE : au moins un jet lancé (défaut de `RollRow.rolled` si la rangée ne le porte pas). */
  rolled: boolean;
  /** Test opposé (2 rangées) : index de la rangée gagnante — passé à `RollRow`/RollPanel via `row`. */
  winnerIndex?: number | null;
  netSL?: number;
  /** Issue style journal sous la LISTE (cas mono : une seule rangée). Sinon `row.note` par rangée. */
  outcome?: ReactNode;
  /** Bandeau d'ISSUE agrégée sous les rangées (multi : total, succès…). Masqué si absent. */
  summary?: ReactNode;
  /** Contenu métier POST-JET (Surincantation, Contre-sort…). */
  postRollExtra?: ReactNode;
  /** Contenu métier juste APRÈS le picker du dé forcé (grille de localisation du Critique forcé). */
  forcedExtra?: ReactNode;
  /** Barre d'actions data-driven, filtrée par phase. */
  actions: RollAction[];
  /** Échap = annuler (pré-jet, ou si autorisé). Absent → modale non annulable au clavier. */
  onCancel?: () => void;
  /** Clé du flux de jet de la modale (`FLOW_VERBS`) : arme la garde de vocabulaire d'actions (DEV).
   *  Absente = modale sans flux naturel (garde inerte). */
  flowKey?: keyof typeof FLOW_VERBS;
}) {
  if (import.meta.env.DEV && flowKey) assertActionVocabulary(flowKey, actions);
  const subClass = variant === 'test' ? 'test-actor' : 'rm-vs';
  const single = rows.length === 1;
  // « Lancer » hissé dans la barre (cas MONO). On hisse quand EXACTEMENT UNE rangée est à lancer :
  // interactive (≠ false), non lancée, et porteuse d'un `onRoll`. Le multi (≥2 rangées à lancer)
  // garde son « Lancer » par rangée + « Tout lancer » → 0 hissé. Opposé (1 interactive + 1 témoin
  // sans onRoll) → 1 seule à lancer → hissé, correct.
  const rollableIdx = rows.map((r, i) => (r.interactive !== false && !(r.rolled ?? rolled) && r.onRoll ? i : -1)).filter((i) => i >= 0);
  const hoistIdx = rollableIdx.length === 1 ? rollableIdx[0] : -1;
  const hoistRow = hoistIdx >= 0 ? rows[hoistIdx] : undefined;
  // Hook appelé INCONDITIONNELLEMENT (règles des hooks) : no-op quand rien à hisser.
  const hoist = useRollFrisson(hoistRow?.onRoll, { frisson: hoistRow?.rollFrisson });
  // BUG CORRIGÉ (#396 v4) : dès que le résolveur commet (`rolled` bascule, en plein `landed`),
  // `hoistIdx` retombe à -1 (la rangée n'est plus « à lancer ») → `hoistRow` disparaît PENDANT
  // `landed`, avant que la scène n'ait eu le temps de lire ses vraies faces. On fige l'INDEX de la
  // rangée hissée dans une ref (mise à jour tant qu'elle est valide, càd AVANT/PENDANT `rolling`) —
  // `rows[hoistedRowIdx.current]` reste résolvable pendant tout `landed`, `.row.d` y est FRAIS
  // (React 18 batch la transition `landed` et le commit du store dans le MÊME rendu).
  const hoistedRowIdx = useRef<number>(-1);
  if (hoistIdx >= 0) hoistedRowIdx.current = hoistIdx;
  const landedRow = hoist.landed ? rows[hoistedRowIdx.current] : undefined;
  const hoistFaces = landedRow?.row.d ? d100Faces(landedRow.row.d.roll) : null;
  // Échap : pendant le frisson HISSÉ (roulis ou atterrissage de la scène centrale), SKIPPE — même
  // geste qu'un clic sur les dés (`hoist.skip`), jamais une annulation en pleine animation. Sinon,
  // annule seulement pré-jet ; un bouton Annuler post-jet porte sa visibilité via `when`.
  const escClose = disableEscClose ? undefined : (hoist.rolling || hoist.landed) ? hoist.skip : (!rolled ? onCancel : undefined);
  const shownActions = actions.filter((a) => a.when === 'always' || (rolled ? a.when === 'post' : a.when === 'pre'));
  const body = (
    <>
      {/* Scène centrale du roulis (#396 v2/v3, mono/opposé — le hissage `hoistIdx` ne s'active que
          pour UNE rangée à lancer) : grands dés au centre, voile sur le contenu qui reste dessous. */}
      {(hoist.rolling || hoist.landed) && <DiceRoll scene landed={hoist.landed} faces={hoistFaces} onSkip={hoist.skip} />}
      {subtitle != null && <p className={subClass}>{subtitle}</p>}
      {instruction != null && <div className="mini-title">{instruction}</div>}
      {extra}
      {!rolled && setup}
      <div className="cs-rows">
        {rows.map((r, i) => {
          const { key, ...rest } = r;
          // Test opposé (≥2 rangées, post-jet) : la rangée `winnerIndex` est accentuée, les autres atténuées.
          // Une rangée qui porte déjà son propre `winner` reste prioritaire.
          const winner = rolled && winnerIndex != null && rows.length > 1 ? (i === winnerIndex ? 'win' : 'lose') : null;
          return <RollRow key={key ?? i} {...rest} rolled={rest.rolled ?? rolled} winner={rest.winner ?? winner} rollInBar={i === hoistIdx} />;
        })}
      </div>
      {single && outcome}
      {/* DR net du Test opposé (2 rangées) — même badge que `RollPanel`, réutilisé ici. */}
      {rolled && winnerIndex != null && netSL != null && (
        <div className="rm-netsl" title="Différence de DR entre les deux jets : elle alimente les Dégâts (Test opposé)">
          DR net : {netSL >= 0 ? '+' : '−'}{Math.abs(netSL)}
        </div>
      )}
      {summary != null && <p className="rm-vs">{summary}</p>}
      {postRollExtra}
      {forcedExtra}
      <div className="modal-actions">
        {shownActions.map((a) => (
          <button
            key={a.key}
            className={actionClass(a.key)}
            disabled={a.disabled}
            title={a.title}
            /* () => a.onClick() : ne PAS passer l'événement React (coop : l'invité sérialise les intents en JSON). */
            onClick={() => a.onClick()}
          >
            {a.label}
          </button>
        ))}
        {/* « Lancer » HISSÉ (mono) : au MÊME niveau qu'Annuler/Appliquer, en DERNIER (à DROITE) — action
            PRIMAIRE à droite, « Annuler » à gauche (convention de la coquille). Pendant le roulis/
            l'atterrissage, la SCÈNE centrale (ci-dessus) porte les dés : ce bouton disparaît sans repli. */}
        {hoistIdx >= 0 && !rolled && !hoist.rolling && (
          <button key="roll" className="btn btn-primary" onClick={() => hoist.trigger()}>
            {hoistRow?.rollLabel ?? DEFAULT_ROLL_LABEL}
          </button>
        )}
      </div>
    </>
  );
  if (embedded) {
    return (
      <div className={`rs-embedded ${variant === 'test' ? 'test-modal' : 'roll-modal'}`}>
        <div className="mini-title">{title}</div>
        {body}
      </div>
    );
  }
  return (
    <Modal title={title} variant={variant} onClose={escClose}>
      {body}
    </Modal>
  );
}
