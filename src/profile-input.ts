import { z } from 'zod';

// Profil ohne Name und Kontaktdaten (nur, ob sie vorhanden sind) – Eingabe der KI-Funktionen
// `profile-review`, `job-fit` und `cover-letter`. Muss zu `reviewRequest` in
// `src/domain/profile-review.ts` der Apps passen.

const text = z.string().max(5000).optional();

const entry = z.object({
  id: z.string().max(100),
  title: z.string().max(500),
  organization: text,
  location: text,
  description: text,
  period: z.string().max(100),
});

export const profileInputSchema = z.object({
  headline: text,
  city: text,
  summary: text,
  contact: z.object({
    address: z.boolean(),
    phone: z.boolean(),
    email: z.boolean(),
    birthDate: z.boolean(),
  }),
  experience: z.array(entry).max(60),
  education: z.array(entry).max(60),
  /** Ehrenamt – optional, damit ältere Apps weiter funktionieren */
  volunteering: z.array(entry).max(60).optional(),
  skills: z
    .array(z.object({ id: z.string().max(100), category: text, items: z.string().max(5000) }))
    .max(60),
  languages: z.array(z.object({ language: z.string().max(100), level: text })).max(30),
});
