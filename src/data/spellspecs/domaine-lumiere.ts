/**
 * Domaine de la Lumière (Hysh) — LDB 48 « Magie des Arcanes (Lumière) », 8 sorts.
 * Curation B4 : chaque entrée recopie sa description canon (spells.json) ; les volets
 * réellement arbitrés (bannissements opposés, barrières de zone, ciblage « quiconque vous
 * regarde ») restent en ops `narrative` — journalisés verbatim, rien d'inventé.
 * Aucune op nouvelle : tout compose le vocabulaire existant (heal, test→corruption,
 * charMod, condition échelonnée au DR, ignoreStatePenalties + suppressPsych).
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_LUMIERE: SpellSpec[] = [
  {
    label: 'Bannissement',
    // « …toutes les créatures dans la ZdE dont l'Endurance est inférieure à votre Force Mentale.
    //   Les cibles Mort-vivant ou Démoniaque gagnent le Trait Instable. Si elles possèdent déjà
    //   Instable, elles sont réduites à 0 PB. » — le Trait Instable est accordé aux cibles
    //   Mort-vivant/Démoniaque (op grantTrait + onlyGroups) ; le gate « E < votre FM » et la branche
    //   « déjà Instable → 0 PB » restent journalisés (non exprimables en op simple).
    durationRounds: null,
    curated: true,
    source: 'LDB 48 — Domaine de la Lumière « Bannissement »',
  },
  {
    label: "Clarté d'esprit",
    // « Tous les modificateurs négatifs agissant sur ses pensées – issus d'États, de mutations
    //   mentales, de Trait Psychologique ou de n'importe quelle autre source – sont ignorés tant
    //   que le Sort est actif. » — pénalités d'État ignorées (ignoreStatePenalties) + Traits
    //   psychologiques apaisés (suppressPsych) ; les modificateurs de mutation mentale restent MJ.
    durationRounds: null, // « (Intelligence) minutes » → échelle d'horloge (durationClockMinutes)
    curated: true,
    source: "LDB 48 — Domaine de la Lumière « Clarté d'esprit »",
  },
  {
    label: 'Fauche-démon',
    // « Le Test d'Incantation est opposé par la cible (Test de FM). Si vous l'emportez, vous
    //   annihilez une cible Démoniaque… quiconque regardait reçoit +DR Aveuglé. » — l'opposition
    //   FM est un MULTIJET dans la modale (`opposed`) : si le lanceur l'emporte, la cible Démoniaque
    //   est annihilée (reduceToZero gaté Démon) ; le cône d'aveuglement des témoins reste journalisé.
    opposed: { kind: 'resist', char: 'FM' },
    durationRounds: null,
    curated: true,
    source: 'LDB 48 — Domaine de la Lumière « Fauche-démon »',
  },
  {
    label: "Filet d'Amyntok",
    // « Les cibles gagnent +1 État Sonné, qui ne peut être retiré tant que le Sort est actif. En
    //   se remettant de cet État, les cibles effectuent un Test d'Intelligence au lieu de
    //   Résistance. Les cibles Bestial sont immunisées. » — l'État Sonné est mécanique ; le
    //   verrou « non retirable » et le Test d'Int de récupération restent journalisés.
    durationRounds: null, // durée = « (Bonus d'Int de la CIBLE) Rounds » (hors barème lanceur)
    curated: true,
    source: "LDB 48 — Domaine de la Lumière « Filet d'Amyntok »",
  },
  {
    label: 'Lumière aveuglante',
    // « Quiconque regarde dans votre direction, à moins de posséder le Talent Magie des Arcanes
    //   (Lumière), reçoit +DR État Aveuglé. » — Aveuglé total = DR du jet (base 0 + 1/DR, plancher
    //   1 de l'op, comme Purification) ; le ciblage « quiconque vous regarde » reste arbitré.
    durationRounds: null,
    curated: true,
    source: 'LDB 48 — Domaine de la Lumière « Lumière aveuglante »',
  },
  {
    label: 'Lumière de guérison',
    // « …guérissant d'un nombre de Blessure égal à votre Bonus d'Intelligence + votre Bonus de
    //   Force Mentale. Si la cible réussit un Test de Résistance Difficile (-20), elle perd
    //   également 1 Point de Corruption gagné dans l'heure précédente. » — soin = BInt + BFM (deux
    //   heal additifs) ; retrait de Corruption sur Test réussi (corruption négative).
    durationRounds: null, // Instantané
    curated: true,
    source: 'LDB 48 — Domaine de la Lumière « Lumière de guérison »',
  },
  {
    label: 'Pensée rapide',
    // « Vous gagnez un Bonus de +20 en Initiative et en Intelligence. »
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Lumière « Pensée rapide »',
  },
  {
    label: 'Protection de Phâ',
    // « Les créatures profanes (Mort-vivant, Démoniaque, mutées ou de Corruption > BFM+BE) ne
    //   peuvent pas entrer dans la ZdE. Celles déjà à l'intérieur gagnent Brisé jusqu'à ce qu'elles
    //   la quittent. Les créatures à l'intérieur ne peuvent pas gagner de Corruption. » — barrière
    //   de zone persistante (non modélisée) : arbitré.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Lumière « Protection de Phâ »',
  },
];
