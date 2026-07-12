/**
 * Schéma de `lieux-services.json` — vocabulaire des SERVICES de lieu (#343) EXTENSIBLES par catalogue
 * (patron `naval-ports.json`), au-delà du port et du marché qui portent leur propre schéma riche
 * (`MapPlace.port`/`MapPlace.market`). Consommé par référence (`MapPlace.services[].kind`) et résolu
 * par `placeServices` (`src/state/worldMap.ts`) : id STABLE → libellé/icône d'affichage. Vocabulaire
 * app-interne de routage d'écran (id/label/icône), aucune mécanique RAW à sourcer par entrée
 * (cf. `EXEMPT_DATASETS`, `scripts/guards/lib/citationCoverage.mjs`).
 */
import { z } from 'zod';

export const file = 'lieux-services.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    /** Icône d'affichage (id du registre `src/ui/icons`). */
    icon: z.string().optional(),
    /** Note d'affichage (Markdown) — facultative. */
    desc: z.string().optional(),
    /** Réplique de boniment (donnée d'auteur, saveur maison — pas de RAW à sourcer) affichée par le
     *  bandeau d'interlocuteur statique (`SpeakerBanner` variant `boniment`) du service. */
    hostLine: z.string().optional(),
    /** Bande d'ambiance par défaut du service (id du registre `src/ui/backdrops`). */
    backdrop: z.string().optional(),
  }),
);

export type LieuxServicesData = z.infer<typeof schema>;
