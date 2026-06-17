/**
 * Chip d'ENTITÉ — SOURCE UNIQUE d'affichage d'une référence (compétence, talent, sort, objet, trait…)
 * sur TOUS les écrans (Codex, créateur, fiche, carte, résumé). Une boîte `.entity-chip` + un
 * déclencheur popover `CodexRef` (survol = description + source ; clic = ouvre le Codex). Gère le
 * CHOIX « A ou B » (chaque option cliquable) de façon identique partout. Le `CodexRowView` du Codex
 * ET les composants d'écran passent par ici → plus aucun rendu d'entité parallèle.
 */
import { Fragment, type ReactNode } from 'react';
import { CodexRef } from './compendium/CodexRef';
import { splitTopLevelOu } from '../engine/careerSlots';
import { statName } from '../engine/statEntry';
import { findSkillById, findTalentById, skillInstanceLabel, talentConcrete } from '../data';
import type { SkillInstance, TalentInstance } from '../engine/types';

/** Un chip : boîte `.entity-chip` + déclencheur `CodexRef` (`label` = clé de résolution) + badge
 *  optionnel en fin (carac/valeur, `+avancées`, `×N`…). */
export function EntityRef({
  category,
  label,
  show,
  badge,
  instance,
  className,
}: {
  category: string;
  label: string;
  show?: ReactNode;
  badge?: ReactNode;
  /** Instance paramétrée (« 8 Tentacules +8 ») — affichée en tête du popover + transmise au Codex. */
  instance?: string;
  className?: string;
}) {
  return (
    <span className={`entity-chip${className ? ` ${className}` : ''}`}>
      <CodexRef category={category} label={label} instance={instance}>
        {show ?? label}
      </CodexRef>
      {badge != null && badge !== '' && <em className="entity-badge">{badge}</em>}
    </span>
  );
}

/** Groupe de CHOIX « A ou B » avec options DÉJÀ séparées : un chip cliquable par option + « ou ». */
export function ChoiceChips({ category, options }: { category: string; options: { label: string; show: string }[] }) {
  return (
    <span className="entity-choice">
      {options.map((o, i) => (
        <Fragment key={i}>
          {i > 0 && <em className="chip-ou">ou</em>}
          <EntityRef category={category} label={o.label} show={o.show} />
        </Fragment>
      ))}
    </span>
  );
}

/** Une ENTRÉE brute de compétence/talent : « A ou B » → choix éclaté ; sinon un simple chip. */
export function EntityChoice({ category, entry }: { category: string; entry: string }) {
  const opts = splitTopLevelOu(entry);
  return opts.length > 1 ? (
    <ChoiceChips category={category} options={opts.map((o) => ({ label: statName(o), show: o }))} />
  ) : (
    <EntityRef category={category} label={statName(entry)} show={entry} />
  );
}

/** Chip d'une compétence CONCRÈTE (instance d'un héros) — libellé vivant + badge `+avancées`. */
export function SkillChip({ skill }: { skill: SkillInstance }) {
  return (
    <EntityRef
      category="skills"
      label={findSkillById(skill.skillId)?.label ?? skill.skillId}
      show={skillInstanceLabel(skill)}
      badge={`+${skill.advances}`}
    />
  );
}

/** Chip d'un talent CONCRET (instance d'un héros) — libellé vivant + `×N` si répété. */
export function TalentChip({ talent }: { talent: TalentInstance }) {
  return (
    <EntityRef
      category="talents"
      label={findTalentById(talent.talentId)?.label ?? talent.talentId}
      show={`${talentConcrete(talent)}${talent.times > 1 ? ` ×${talent.times}` : ''}`}
    />
  );
}
