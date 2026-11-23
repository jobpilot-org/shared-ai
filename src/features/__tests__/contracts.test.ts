import { describe, expect, it } from 'vitest';

import { MAX_POSTING_CHARS, MIN_POSTING_CHARS, responseSchemas } from '../../assistant.js';
import { cvSchema } from '../cv-import.js';
import { jobInputSchema, jobSchema, jobUserPrompt } from '../job-import.js';
import { fitInputSchema, fitUserPrompt } from '../job-fit.js';
import { reviewInputSchema, reviewUserPrompt, today } from '../profile-review.js';
import { draftSchema, letterInputSchema, letterUserPrompt, SECTION_KEYS } from '../cover-letter.js';

const POSTING =
  'Senior Fullstack Developer (m/w/d) bei Nordlicht Software in Berlin, hybrid. Wir suchen Erfahrung mit React, Node.js und TypeScript. Gehalt 75.000 bis 85.000 Euro. Kontakt: Jana Peters, jana@example.com';

const profile = {
  headline: 'Fullstack-Entwickler',
  city: 'Berlin',
  summary: 'Fünf Jahre React.',
  contact: { address: true, phone: false, email: true, birthDate: false },
  experience: [
    {
      id: 'entry-1',
      title: 'Senior Developer',
      organization: 'Nordlicht Software',
      location: 'Berlin',
      description: 'React, Node.js',
      period: '2021-2026',
    },
  ],
  education: [],
  skills: [{ id: 'skill-1', category: 'Frontend', items: 'React, TypeScript' }],
  languages: [{ language: 'Englisch', level: 'C1' }],
};

describe('Stellenanzeigen-Import', () => {
  it('nutzt dieselben Eckdaten wie das Übernehmen einer Anzeige', () => {
    expect(jobSchema).toBe(responseSchemas.stellenanzeige);
  });

  it('hält sich an die Grenzen des Anzeigentexts', () => {
    expect(jobInputSchema.parse({ posting: POSTING })).toEqual({ posting: POSTING });
    expect(jobInputSchema.safeParse({ posting: 'x'.repeat(MIN_POSTING_CHARS - 1) }).success).toBe(
      false,
    );
    expect(jobInputSchema.safeParse({ posting: 'x'.repeat(MAX_POSTING_CHARS + 1) }).success).toBe(
      false,
    );
  });

  it('nennt die Seite nur, wenn sie mitgeschickt wurde', () => {
    expect(jobUserPrompt({ posting: POSTING })).toBe(
      `<stellenanzeige>\n${POSTING}\n</stellenanzeige>`,
    );
    expect(jobUserPrompt({ posting: POSTING, url: 'https://example.com/job' })).toContain(
      'Seite: https://example.com/job',
    );
  });
});

describe('Lebenslauf-Import', () => {
  it('lässt fehlende Angaben als null zu und verlangt alle Pflichtfelder', () => {
    const entry = {
      title: 'Senior Developer',
      organization: null,
      location: null,
      description: null,
      startDate: '2021-03',
      endDate: null,
      isCurrent: true,
    };
    const draft = {
      firstName: 'Jana',
      lastName: 'Peters',
      headline: null,
      street: null,
      postalCode: null,
      city: 'Berlin',
      phone: null,
      email: null,
      birthDate: null,
      birthPlace: null,
      summary: null,
      experience: [entry],
      education: [],
      volunteering: [],
      skills: [{ category: 'Frontend', items: 'React' }],
      languages: [],
      links: [{ kind: 'github', url: 'https://github.com/jana' }],
    };

    expect(cvSchema.parse(draft)).toEqual(draft);
    expect(cvSchema.safeParse({ ...draft, experience: undefined }).success).toBe(false);
    expect(cvSchema.safeParse({ ...draft, links: [{ kind: 'mastodon', url: '' }] }).success).toBe(
      false,
    );
  });
});

describe('Passung', () => {
  it('verlangt Profil und Anzeigentext ab 80 Zeichen', () => {
    const posting = {
      company: 'Nordlicht Software',
      role: 'Senior Developer',
      description: POSTING,
    };
    expect(fitInputSchema.safeParse({ profile, posting }).success).toBe(true);
    expect(
      fitInputSchema.safeParse({ profile, posting: { ...posting, description: 'zu kurz' } })
        .success,
    ).toBe(false);
  });

  it('stellt das Profil als JSON und die Stelle in eigenen Tags zusammen', () => {
    const prompt = fitUserPrompt({
      profile,
      posting: { company: 'Nordlicht Software', role: 'Senior Developer', description: POSTING },
    });

    expect(prompt).toContain('<profil>');
    expect(prompt).toContain(JSON.stringify(profile, null, 2));
    expect(prompt).toContain('Senior Developer bei Nordlicht Software');
    expect(prompt).toContain('Wie gut passt dieses Profil zu der Stelle?');
  });
});

describe('Profil-Check', () => {
  it('verlangt ein Profil ohne Kontaktdaten', () => {
    expect(reviewInputSchema.safeParse({ profile }).success).toBe(true);
    expect(reviewInputSchema.safeParse({}).success).toBe(false);
    // Ehrenamt bleibt optional, damit ältere Apps weiter funktionieren
    expect(profile).not.toHaveProperty('volunteering');
  });

  it('schreibt das heutige Datum in den Prompt', () => {
    expect(today(new Date('2026-11-23T10:00:00Z'))).toBe('23.11.2026');

    const prompt = reviewUserPrompt({ profile }, new Date('2026-11-23T10:00:00Z'));
    expect(prompt.startsWith('Heute ist der 23.11.2026.')).toBe(true);
    expect(prompt).toContain('<profil>');
    expect(prompt).toContain('Prüfe dieses Profil auf grobe inhaltliche Fehler.');
  });
});

describe('Anschreiben', () => {
  const letter = {
    mode: 'draft' as const,
    profile,
    posting: { company: 'Nordlicht Software', role: 'Senior Developer', description: POSTING },
    salutation: 'Sehr geehrte Damen und Herren,',
    tone: 'modern' as const,
    address: 'du' as const,
    length: 'short' as const,
    strengths: ['React'],
  };

  it('setzt die Sie-Form als Standard und lässt nur bekannte Tonalitäten zu', () => {
    expect(letterInputSchema.parse(letter).address).toBe('du');
    expect(letterInputSchema.parse({ ...letter, address: undefined }).address).toBe('sie');
    expect(letterInputSchema.safeParse({ ...letter, tone: 'locker' }).success).toBe(false);
    expect(letterInputSchema.safeParse({ ...letter, strengths: ['x'.repeat(301)] }).success).toBe(
      false,
    );
  });

  it('behält die fünf Abschnitte bei', () => {
    expect([...SECTION_KEYS]).toEqual(['intro', 'fit', 'strengths', 'motivation', 'closing']);
    expect(
      draftSchema.safeParse({
        subject: 'Bewerbung als Senior Developer',
        sections: SECTION_KEYS.map((key) => ({ key, text: 'Text' })),
      }).success,
    ).toBe(true);
    expect(
      draftSchema.safeParse({ subject: 'Bewerbung', sections: [{ key: 'intro', text: 'Text' }] })
        .success,
    ).toBe(true);
    expect(
      draftSchema.safeParse({ subject: 'Bewerbung', sections: [{ key: 'anrede', text: 'Text' }] })
        .success,
    ).toBe(false);
  });

  it('nennt Vorgaben nur im Entwurf und beim Neuschreiben eines Abschnitts', () => {
    const draft = letterUserPrompt(letter);
    expect(draft).toContain('Ansprache im Brief: Sehr geehrte Damen und Herren,');
    expect(draft).toContain('Anrede im Text: Du-Form');
    expect(draft).toContain('Schreibe Betreff und die fünf Abschnitte:');

    const section = letterUserPrompt({
      ...letter,
      mode: 'section',
      section: 'fit',
      sections: [{ key: 'intro', text: 'Bisheriger Einstieg' }],
      hint: 'kürzer',
    });
    expect(section).toContain('[intro] Bisheriger Einstieg');
    expect(section).toContain('Schreibe nur den Abschnitt „fit“ neu.');
    expect(section).toContain('Wunsch der Person: kürzer');
  });
});
