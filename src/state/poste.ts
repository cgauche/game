/**
 * POSTE — modèle-VUE UNIQUE de l'assignation « affecter des personnes à un poste/rôle », projeté depuis
 * les catalogues de données existants (les `.json` restent séparés, on ne recopie rien). Sert la surface
 * héros-first (`PostesRoster`) : les Activités de voyage (EDOC ch.8) et les rôles d'équipage (MDG ch.14)
 * partagent le MÊME type-vue, avec leur seule vraie différence portée en donnée (`cardinality`).
 *
 * FRONTIÈRE : ceci ne décrit QUE l'assignation. La RÉSOLUTION (jets individuels du voyage vs Tests
 * d'équipage mutualisés) reste dans ses modules dédiés (`engine/activities`, `state/shipCrew`) — un Poste
 * ne fait qu'exposer l'identité assignable, jamais la mécanique de résolution. PUR.
 */
import type { SkillRef } from '../engine/skills';
import type { ActivityDef } from '../engine/activities';
import type { CrewRoleData } from '../data';

/** Cardinalité d'assignation d'un poste : `heroExclusive` = chaque héros en tient exactement un (Activité
 *  de voyage, EDOC l.131) ; `slotFilling` = un poste accueille 0..N héros (rôle d'équipage). */
export type PosteCardinality = 'heroExclusive' | 'slotFilling';

/** Identité assignable commune (héros-first). L'`icon` est optionnelle (absente pour un rôle d'équipage).
 *  `skills` sert l'inférence « auto » (meilleure compétence du héros) partagée avec les résolveurs. */
export interface Poste {
  id: string;
  label: string;
  icon?: string;
  skills: SkillRef[];
  desc?: string;
  cardinality: PosteCardinality;
}

/** Activité de voyage (`activitiesFor('voyage')`) → Poste. Chaque héros en tient un (EDOC l.131). */
export function activityAsPoste(def: ActivityDef): Poste {
  return {
    id: def.id,
    label: def.label,
    icon: def.icon,
    skills: def.skills ?? [],
    desc: def.desc,
    cardinality: 'heroExclusive',
  };
}

/** Rôle d'équipage (`crewRoles`, MDG ch.14) → Poste. Un rôle accueille 0..N servants ; pas d'icône. */
export function crewRoleAsPoste(r: CrewRoleData): Poste {
  return {
    id: r.id,
    label: r.label,
    skills: r.skills,
    desc: r.desc,
    cardinality: 'slotFilling',
  };
}
