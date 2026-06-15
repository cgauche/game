/**
 * Nécromancie (Magie noire) — LDB 50, 4 sorts. Curation B4 : « Réanimation » et « Relever les
 * morts » INVOQUENT des morts-vivants contrôlés (champ summon — liés au sorcier, ils s'effondrent
 * s'il tombe) ; « Crâne hurlant » est un Projectile qui terrifie ; « L'appel de Vanhel » (Action/
 * Mouvement gratuit aux morts-vivants) reste narratif. Source du moteur d'invocation : state/summonFlow.
 */
import { SpellSpec } from '../../engine/spellspec';

export const NECROMANCIE: SpellSpec[] = [
  {
    label: 'Crâne hurlant',
    // « Projectile magique qui n'affecte que les cibles SANS le Trait Mort-vivant, Dégâts = BFM. Pour
    //   chaque blessure infligée, Test de Calme (+0) ou État Brisé. » — Dégâts via le moteur missile ;
    //   le Test de Calme/Brisé à la touche ; le filtre « non mort-vivant » reste journalisé.
    durationRounds: null,
    curated: true,
    source: 'LDB 50 — Nécromancie « Crâne hurlant »',
  },
  {
    label: "L'appel de Vanhel",
    // « (Bonus d'Intelligence) cibles Mort-vivant gagnent une Action OU un Mouvement gratuit (au
    //   choix, pour toutes). +(BInt) cibles par +2 DR. » — octroi d'action gratuite à des PNJ
    //   morts-vivants : non modélisé : arbitré.
    durationRounds: null,
    curated: true,
    source: "LDB 50 — Nécromancie « L'appel de Vanhel »",
  },
  {
    label: 'Réanimation',
    // « Réanimez (BFM + DR) corps en zombies ou squelettes à portée. Ils entrent avec l'État À Terre,
    //   sous votre contrôle ; ils s'effondrent si vous mourez ou tombez Inconscient. Reste actif
    //   jusqu'au lever du soleil. +(BFM + DR) par +2 DR. » — invocation de morts-vivants contrôlés,
    //   liés au sorcier ; le choix zombie/squelette, l'État À Terre initial et la surincantation
    //   restent journalisés.
    durationRounds: null, // « Jusqu'au lever du soleil » (persiste ; lié au sorcier)
    curated: true,
    source: 'LDB 50 — Nécromancie « Réanimation »',
  },
  {
    label: 'Relever les morts',
    // « (DR + 1) squelettes sortent du sol dans la ZdE, avec l'État À Terre, sous votre contrôle ; ils
    //   s'écroulent si vous mourez ou tombez Inconscient. Reste actif jusqu'au lever du soleil. +(DR)
    //   par +2 DR. » — invocation de squelettes contrôlés, liés au sorcier.
    durationRounds: null, // « Jusqu'au lever du soleil »
    curated: true,
    source: 'LDB 50 — Nécromancie « Relever les morts »',
  },
];
