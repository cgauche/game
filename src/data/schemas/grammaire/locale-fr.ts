/**
 * LANGUE des refus de schéma — règle 4 (« UI en français »), #1588. La carte d'erreurs FR livrée par
 * zod (`z.locales.fr`) est posée UNE fois sur la configuration GLOBALE de la dépendance : tout refus
 * produit par un `safeParse` la traverse, quel que soit le schéma et quel que soit l'appelant (écran,
 * test, script de garde). Aucun site ne traduit, aucun message ne se réécrit.
 *
 * Le module est importé pour son EFFET par `grammaire/ref.ts`, RACINE du graphe : un banc tient que
 * TOUT fichier de `src/data/schemas/**` important zod en VALEUR atteint ce module transitivement
 * (`refus-en-francais.test.ts`). Charger un schéma, c'est avoir posé sa langue.
 */
import { z } from 'zod';

z.config(z.locales.fr());
