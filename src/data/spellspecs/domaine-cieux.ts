/**
 * Domaine des Cieux (Azyr) — LDB 48 « Magie des Arcanes (Cieux) », 8 sorts.
 * Curation B4. Les Projectiles magiques (Arc de T'Essla, Comète de Cassandora) sont résolus par
 * le moteur missile (Dégâts lus de la desc) ; la spec ne porte que les États additionnels à la
 * touche. Les Signes d'Amul accordent Chance/Destin (ops gainResource, retirés à
 * l'expiration s'ils ne sont pas dépensés). L'attribut de Domaine (Azyr : PA métalliques ignorés)
 * reste assuré par domainAttributes.ts.
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_CIEUX: SpellSpec[] = [
  {
    label: "Arc de T'Essla",
    // « Projectile magique avec Dégâts +10 qui inflige +1 État Aveuglé. » — Dégâts via le moteur
    // missile ; la spec ne porte que l'Aveuglé à la touche.
    durationRounds: null,
    curated: true,
    source: "LDB 48 — Domaine des Cieux « Arc de T'Essla »",
  },
  {
    label: 'Bouclier céruléen',
    // « +DR PA à toutes les Localisations contre les Attaques de Corps à corps. Si attaqué par une
    //   arme en métal, l'attaquant subit BFM Dégâts. » — la borne « Corps à corps seulement » et la
    //   riposte conditionnelle (arme métallique) ne sont pas exprimables en une op simple : arbitré.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine des Cieux « Bouclier céruléen »',
  },
  {
    label: 'Comète de Cassandora',
    // « …agit comme un Projectile magique avec Dégâts +12 qui frappe toutes les cibles dans la ZdE,
    //   qui gagnent également +1 État En flammes et +1 État À Terre. » — Dégâts ZdE via le moteur
    //   missile ; États additionnels en ops. Le délai d'un Round et la dérive au Test de Perception
    //   (visée) restent journalisés.
    durationRounds: null, // « Spécial » (impact différé)
    curated: true,
    source: 'LDB 48 — Domaine des Cieux « Comète de Cassandora »',
  },
  {
    label: 'Ironie du Destin',
    // « Tous les alliés dans la ZdE (hors Talent Cieux) forment une réserve unique pour leurs Points
    //   de Chance… Quand le Sort prend fin, vous réallouez les Points. » — mise en commun d'une
    //   réserve de Chance partagée : non modélisée (arbitré).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine des Cieux « Ironie du Destin »',
  },
  {
    label: "Le Premier Signe d'Amul",
    // « Gagnez +1 Point de Chance. Pour chaque +2 DR, gagnez +1 Point de Chance supplémentaire. Tous
    //   ces Points inutilisés à la fin de la Durée du Sort sont perdus. »
    durationRounds: { bonusOf: 'I' }, // « (Bonus d'Initiative) Rounds »
    curated: true,
    source: "LDB 48 — Domaine des Cieux « Le Premier Signe d'Amul »",
  },
  {
    label: "Le Second Signe d'Amul",
    // « Gagnez +DR Points de Chance. Pour chaque +2 DR, gagnez +1 Point de Chance supplémentaire.
    //   Tous ces Points inutilisés à la fin de la Durée du Sort sont perdus. » — « +DR » modélisé par
    //   l'échelle 1/DR ; le « +1 par +2 DR » SUPPLÉMENTAIRE reste journalisé.
    durationRounds: { bonusOf: 'I' },
    curated: true,
    source: "LDB 48 — Domaine des Cieux « Le Second Signe d'Amul »",
  },
  {
    label: "Le Troisième Signe d'Amul",
    // « Gagnez +1 Point de Destin. Si ce Point de Destin n'a pas été utilisé à la fin de la Durée du
    //   Sort, il est perdu. »
    durationRounds: { bonusOf: 'I' },
    curated: true,
    source: "LDB 48 — Domaine des Cieux « Le Troisième Signe d'Amul »",
  },
  {
    label: 'Maudit',
    // « Tant que le Sort est actif, vous pouvez dépenser des Points de Chance pour forcer un
    //   adversaire à relancer ses Tests. » — dépense de Chance pour imposer une relance ennemie :
    //   mécanique de relance forcée ciblée non modélisée (arbitré).
    durationRounds: { bonusOf: 'I' },
    curated: true,
    source: 'LDB 48 — Domaine des Cieux « Maudit »',
  },
];
