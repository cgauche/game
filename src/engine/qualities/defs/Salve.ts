import type { QualityDef } from '../types';

// Salve (Indice) (Aux Armes p.126) : chargeur d'Indice tirs avant rechargement — lu par
// magazineSize comme un chargeur À Répétition (l'arme ne se recharge qu'une fois la salve à 0).
export const quality: QualityDef = { key: 'Salve', type: 'Atout', subType: 'Arme', salvo: true };
