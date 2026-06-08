import type { QualityDef } from '../types';

export const quality: QualityDef = { "key": "Empaleuse", "type": "Atout", "subType": "Arme", "critTrigger": c=>(c.roll??-1)%10===0 };
