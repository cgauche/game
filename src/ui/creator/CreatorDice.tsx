/**
 * « Aux dés » — cérémonie de tirage RÉCURRENTE du créateur (arbitrage 2026-07-13) : même place (tête
 * de Zone A), même langage à chaque étape qui offre un tirage (d100 Race/Carrière, 2d10 Caractéristiques,
 * d100 Signe astral). Un seul composant remplace les 4 libellés de tirage divergents.
 *
 * Le GAIN DE PX est mis en scène par `XpBadge` : la fiche vivante (CreatorSummary) recalcule `xpTotal`
 * à chaque changement du brouillon, donc accepter un tirage incrémente le compteur PX EN DIRECT.
 * Composé exclusivement de primitives/classes existantes (Section, XpBadge, .btn, .row-flex, Icon).
 */
import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { Section, XpBadge } from './CreatorStepFrame';

export function CreatorDice({ label, hint, rolled, xp, onRoll, children }: {
  /** Libellé du bouton de tirage (« Tirer la race (d100) »…) — inutile si `rolled` (jets figés par le seed). */
  label?: string;
  /** Règle du bonus (LDB) sous le bouton — réf sourcée, jamais une paraphrase. */
  hint?: ReactNode;
  /** Un tirage a-t-il été posé ? (masque le bouton initial, montre le verdict). */
  rolled: boolean;
  /** PX gagnés si le tirage est gardé — reflété EN DIRECT dans le compteur de la fiche. */
  xp: number;
  onRoll?: () => void;
  /** Verdict garder/relancer/choisir (contrôles propres à l'étape). */
  children?: ReactNode;
}) {
  return (
    <Section title="Aux dés" right={<XpBadge value={xp} />}>
      {hint && <p className="hint" style={{ marginTop: 0 }}>{hint}</p>}
      {!rolled && onRoll ? (
        <div className="row-flex">
          <button className="btn" onClick={onRoll}>
            <Icon id="nav/dice" size="sm" /> {label}
          </button>
        </div>
      ) : (
        children
      )}
    </Section>
  );
}
