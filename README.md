# shared-ai

Gemeinsame KI-Logik für jobpilot: Verträge, Prompts, Provider-Aufrufe und Fehlercodes an einer Stelle. Genutzt von `mobile`, `web`, `desktop`, `extension` und den Supabase-Edge-Functions in `backend`; `admin` ist nicht beteiligt.

Das Paket liegt in der GitHub-Organisation `jobpilot-org` und wird ausschließlich über GitHub Packages veröffentlicht, nicht auf npmjs. Es ist öffentlich einsehbar, GitHub Packages verlangt beim npm-Client aber trotzdem ein Token – auch für öffentliche Pakete.

## Installation

In den Apps mit exakter Version, damit eine Änderung am Paket bewusst ankommt:

```bash
npm install @jobpilot-org/shared-ai@0.1.0 --save-exact
```

`.npmrc` im Consumer-Repo (kein Token im Klartext, die Umgebungsvariable setzt das Token):

```ini
@jobpilot-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

`NODE_AUTH_TOKEN` ist ein GitHub-Token mit `read:packages` (für Veröffentlichungen `write:packages`). In CI reicht `GITHUB_TOKEN` mit `packages: read`.

### Deno (Edge Functions)

Die Functions lesen das Paket über `npm:`-Specifier mit derselben Version wie die Apps. In `deno.json` der Function:

```json
{
  "imports": {
    "@jobpilot-org/shared-ai/": "npm:@jobpilot-org/shared-ai@0.1.0/"
  }
}
```

Dazu eine `.npmrc` im Ordner der Function (gleicher Inhalt wie oben); Deno liest sie beim Auflösen der npm-Pakete.

## Exporte

| Subpath                   | Inhalt                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `assistant`               | Aktionen, Anfrage- und Antwortschemas des Assistenten, Aufwand je Aktion (`EFFORT`), `AiService` |
| `prompts/assistant`       | Prompt-Builder für die vier Assistenten-Aktionen                                                 |
| `providers/anthropic`     | `runAnthropic` (Text oder PDF) und `createAnthropicService`, Modell `ANTHROPIC_MODEL`            |
| `providers/openai`        | `createOpenAiService`, Modell `OPENAI_MODEL`                                                     |
| `errors`                  | `AiRefusalError`, `AiIncompleteError`, `AiApiError`, `AI_ERROR_CODES`, `AiFunctionError`         |
| `profile-input`           | Profil ohne Name und Kontaktdaten als Eingabe der KI-Funktionen                                  |
| `features/cv-import`      | Schema und Prompts des Lebenslauf-Imports                                                        |
| `features/job-import`     | Eingabe- und Antwortschema sowie Prompts des Stellenanzeigen-Imports                             |
| `features/job-fit`        | Schemas und Prompts der Passung                                                                  |
| `features/profile-review` | Schemas und Prompts des Profil-Checks, `today`, `reviewUserPrompt`                               |
| `features/cover-letter`   | Schemas, Abschnitte und Prompts des Anschreibens                                                 |
| `client/supabase`         | `invokeAiFunction` für Edge-Function-Aufrufe samt Fehlercodes                                    |

```ts
import { runAnthropic } from '@jobpilot-org/shared-ai/providers/anthropic';
import { jobSchema, jobUserPrompt } from '@jobpilot-org/shared-ai/features/job-import';
import { AiRefusalError } from '@jobpilot-org/shared-ai/errors';
```

Die Provider bekommen ihren SDK-Client von außen. Schlüsselerzeugung, Supabase-Auth, Vault-Zugriff, Rate-Limits und Demo-Verhalten bleiben in den jeweiligen Servern – das Paket enthält keine Zugangsdaten.

## Entwicklung

```bash
npm ci                  # Abhängigkeiten (aus npmjs, package-lock.json)
npm run check           # Typecheck + Tests + Formatprüfung – vor "fertig" ausführen
npm test                # vitest
npm run typecheck       # tsc --noEmit
npm run format          # Prettier über alle Dateien
npm run build           # ESM + Deklarationen nach dist/
npm pack --dry-run      # zeigt, was veröffentlicht würde (dist/, README, LICENSE, CHANGELOG)
```

`src/**/__tests__/**` bleibt aus dem Build ausgenommen; `dist/` enthält nur JavaScript und Deklarationen.

## Veröffentlichen

1. `version` in `package.json` erhöhen (SemVer, unter 1.0 = noch nicht offiziell veröffentlicht) und `CHANGELOG.md` ergänzen.
2. Auf `develop` committen und pushen.
3. In GitHub unter _Actions → Publish → Run workflow_ auslösen. Der Workflow prüft, baut und veröffentlicht mit `packages: write`; `publishConfig.registry` zeigt auf `https://npm.pkg.github.com`.
4. Nach dem ersten Lauf die Sichtbarkeit des Pakets prüfen (öffentlich) und in den Consumern die exakte Version nachziehen.

Ein fehlerhaftes Paket wird nicht überschrieben: GitHub Packages erlaubt das Veröffentlichen einer Version nur einmal. Stattdessen eine neue Patch-Version veröffentlichen.
