import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, MAX_GUESTS, joinGuest, makeCode, makeToken, resumeGuest, type RoomData } from './roomLogic';

describe('roomLogic (serveur, logique pure)', () => {
  it('makeCode : 6 caractères de l’alphabet sans ambiguïté', () => {
    const code = makeCode(Math.random);
    expect(code).toHaveLength(6);
    for (const c of code) expect(CODE_ALPHABET).toContain(c);
  });

  it('makeToken : 20 caractères, deux tokens diffèrent', () => {
    expect(makeToken(Math.random)).toHaveLength(20);
    expect(makeToken(Math.random)).not.toBe(makeToken(Math.random));
  });

  it('joinGuest : sièges 1..3, nom par défaut, puis pleine', () => {
    const room: RoomData = { hostToken: 'T', seats: [] };
    expect(joinGuest(room, 'Anna', Math.random)?.seat).toBe(1);
    expect(joinGuest(room, 'Bob', Math.random)?.seat).toBe(2);
    expect(joinGuest(room, '  ', Math.random)?.name).toBe('Joueur 4'); // siège 3
    expect(joinGuest(room, 'Dora', Math.random)).toBeNull();
    expect(room.seats).toHaveLength(MAX_GUESTS);
  });

  it('resumeGuest : retrouve le siège par token, null sinon', () => {
    const room: RoomData = { hostToken: 'T', seats: [] };
    const a = joinGuest(room, 'Anna', Math.random)!;
    expect(resumeGuest(room, a.token)?.seat).toBe(1);
    expect(resumeGuest(room, 'inconnu')).toBeNull();
  });

  it('joinGuest : réutilise un siège libéré (départ volontaire)', () => {
    const room: RoomData = { hostToken: 'T', seats: [] };
    joinGuest(room, 'Anna', Math.random);
    joinGuest(room, 'Bob', Math.random);
    room.seats = room.seats.filter((s) => s.seat !== 1); // ctl bye → le DO retire le siège
    expect(joinGuest(room, 'Carl', Math.random)?.seat).toBe(1);
  });
});
