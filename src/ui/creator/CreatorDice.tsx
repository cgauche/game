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
import { useRollFrisson } from '../useRollFrisson';
import { DiceRoll } from '../DiceRoll';
import { d100Faces } from '../Dice';
import { Section, XpBadge } from './CreatorStepFrame';

export function CreatorDice({ label, hint, rolled, xp, onRoll, roll, children }: {
  /** Libellé du bouton de tirage (« Tirer la race (d100) »…) — inutile si `rolled` (jets figés par le seed). */
  label?: string;
  /** Règle du bonus (LDB) sous le bouton — réf sourcée, jamais une paraphrase. */
  hint?: ReactNode;
  /** Un tirage a-t-il été posé ? (masque le bouton initial, montre le verdict). */
  rolled: boolean;
  /** PX gagnés si le tirage est gardé — reflété EN DIRECT dans le compteur de la fiche. */
  xp: number;
  onRoll?: () => void;
  /** Valeur d100 COURANTE du tirage (#396 v3) — traduite en vraies faces à l'atterrissage
   *  (`d100Faces`). Absente (ex. signe astral : seul l'id résolu est conservé) ⇒ les dés se figent
   *  SANS chiffre plutôt que d'en inventer un (jamais une face qui contredit le score). */
  roll?: number;
  /** Verdict garder/relancer/choisir (contrôles propres à l'étape). */
  children?: ReactNode;
}) {
  // Même geste que RollShell/RollRow (#396) : le tirage du créateur roule au centre de sa zone avant
  // de révéler son verdict. Découplé de `rolled` (qui bascule DÈS le résolveur commis, en plein
  // `landed`) : sinon les vraies faces n'auraient pas le temps de s'afficher.
  const { rolling, landed, trigger, skip } = useRollFrisson(onRoll);
  const faces = landed && roll != null ? d100Faces(roll) : null;
  return (
    <Section title="Aux dés" right={<XpBadge value={xp} />}>
      {hint && <p className="hint" style={{ marginTop: 0 }}>{hint}</p>}
      {rolling || landed ? (
        <DiceRoll scene landed={landed} faces={faces} onSkip={skip} />
      ) : !rolled && onRoll ? (
        <div className="row-flex">
          {/* Attente = encrier rouge bordé-teinté « Atelier du scribe » (#414 : composant unique,
              langue « tu peux agir » — ROUGE bordé, en retrait du rempli de navigation). */}
          <button className="dicewell act" onClick={() => trigger()}>
            <span className="dicewell-tray">
              <Icon id="nav/dice" size="sm" />
              <Icon id="nav/dice" size="sm" />
            </span>
            <span className="dicewell-txt">{label}</span>
          </button>
        </div>
      ) : (
        children
      )}
    </Section>
  );
}
