import { describe, expect, it } from 'vitest';

import {
  AI_ACTIONS,
  DRAFT_KINDS,
  EFFORT,
  MAX_POSTING_CHARS,
  MIN_POSTING_CHARS,
  errorSchema,
  requestSchemas,
  responseSchemas,
} from '../assistant.js';

const POSTING =
  'Senior Fullstack Developer (m/w/d) bei Nordlicht Software in Berlin, hybrid. Wir suchen Erfahrung mit React, Node.js und TypeScript. Gehalt 75.000 bis 85.000 Euro. Kontakt: Jana Peters, jana@example.com';

const extraction = {
  company: 'Nordlicht Software',
  role: 'Senior Fullstack Developer',
  location: 'Berlin',
  workMode: 'hybrid',
  salaryMin: 75000,
  salaryMax: 85000,
  skills: ['React', 'Node.js', 'TypeScript'],
  contactName: 'Jana Peters',
  contactEmail: 'jana@example.com',
  summary: 'Fullstack-Stelle mit React und Node.js.',
};

describe('Assistent-Verträge', () => {
  it('kennt die vier Aktionen und ihre Aufwand-Stufen', () => {
    expect(AI_ACTIONS).toEqual(['stellenanzeige', 'passung', 'vorbereitung', 'entwurf']);
    expect(EFFORT).toEqual({
      stellenanzeige: 'low',
      passung: 'medium',
      vorbereitung: 'medium',
      entwurf: 'medium',
    });
  });

  it('lässt nur Anzeigentexte zwischen 80 und 20.000 Zeichen zu', () => {
    expect(MIN_POSTING_CHARS).toBe(80);
    expect(MAX_POSTING_CHARS).toBe(20_000);

    expect(requestSchemas.stellenanzeige.safeParse({ posting: POSTING }).success).toBe(true);
    expect(
      requestSchemas.stellenanzeige.safeParse({ posting: 'x'.repeat(MIN_POSTING_CHARS - 1) })
        .success,
    ).toBe(false);
    expect(
      requestSchemas.stellenanzeige.safeParse({ posting: 'x'.repeat(MAX_POSTING_CHARS + 1) })
        .success,
    ).toBe(false);
  });

  it('verlangt beim Abgleich ein Profil, bei der Vorbereitung nicht', () => {
    expect(requestSchemas.passung.safeParse({ posting: POSTING }).success).toBe(false);
    expect(
      requestSchemas.vorbereitung.safeParse({
        posting: POSTING,
        company: 'Nordlicht Software',
        role: 'Senior Developer',
      }).success,
    ).toBe(true);
  });

  it('kennt die drei Entwurfsarten', () => {
    expect(DRAFT_KINDS).toEqual(['anschreiben', 'nachfassen', 'dankeschoen']);
    expect(
      requestSchemas.entwurf.safeParse({
        kind: 'anschreiben',
        company: 'Nordlicht Software',
        role: 'Senior Developer',
      }).success,
    ).toBe(true);
    expect(
      requestSchemas.entwurf.safeParse({
        kind: 'bewerbung',
        company: 'Nordlicht Software',
        role: 'Senior Developer',
      }).success,
    ).toBe(false);
  });

  it('prüft die Antwort der Anzeigen-Extraktion', () => {
    expect(responseSchemas.stellenanzeige.parse(extraction)).toEqual(extraction);
    expect(
      responseSchemas.stellenanzeige.safeParse({ ...extraction, workMode: 'vor-ort' }).success,
    ).toBe(false);
    expect(
      responseSchemas.stellenanzeige.safeParse({ ...extraction, salaryMin: null }).success,
    ).toBe(true);
  });

  it('prüft die Antwort des Abgleichs auf die drei Stufen', () => {
    const fit = { fit: 'hoch', summary: 'Passt.', matches: [], gaps: [], talkingPoints: [] };
    expect(responseSchemas.passung.parse(fit)).toEqual(fit);
    expect(responseSchemas.passung.safeParse({ ...fit, fit: 'sehr gut' }).success).toBe(false);
  });

  it('führt die Fehlerantwort der API-Routen als Schema', () => {
    expect(errorSchema.parse({ error: 'unauthorized' })).toEqual({ error: 'unauthorized' });
    expect(errorSchema.safeParse({}).success).toBe(false);
  });
});
