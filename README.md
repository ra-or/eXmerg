# eXmerg

[![CI](https://github.com/ra-or/eXmerg/actions/workflows/ci.yml/badge.svg)](https://github.com/ra-or/eXmerg/actions/workflows/ci.yml)

Lokale Webanwendung zum **Zusammenführen von Excel- und ODS-Dateien**. Mehrere Tabellendateien können in verschiedenen Modi zu einer Ausgabe zusammengeführt werden – inklusive Formatierung, Konsolidierung und optionaler Sheet-Auswahl bzw. Filterung.

## Tech-Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS, Zustand
- **Backend:** Node.js, Express, TypeScript
- **Gemeinsam:** Shared-Package mit Types und Utils
- **Testing:** Vitest, React Testing Library, Playwright (E2E), Supertest
- **Code-Qualität:** ESLint, Prettier, Husky + lint-staged

## Setup

```bash
# Im Projektroot (installiert alle Workspaces: client, server, shared)
npm install
```

**Nach einem `git pull`** empfohlen: erneut `npm install`, damit Abhängigkeiten aktuell sind.

## Entwicklung

Client und Server parallel starten:

```bash
npm run dev
```

- **Client (Vite):** [http://localhost:3002](http://localhost:3002)  
- **Server (Express):** Port **3004** (nur in der Entwicklung; in Produktion/Docker: 3003)

Der Vite-Dev-Server proxied alle Anfragen unter `/api` an den Backend-Server. Beim Aufruf von `npm run dev` wird automatisch `VITE_PROXY_TARGET=http://localhost:3004` gesetzt, sodass Client und Server ohne weitere Konfiguration zusammenarbeiten.

**Backend auf anderem Rechner (z. B. Linux-Server):**  
`VITE_PROXY_TARGET=http://<Server-IP>:3003 npm run dev` – dann läuft der Client lokal (Windows) und die API auf dem Server (z. B. Port 3003).

## Tests

| Befehl | Beschreibung |
|--------|-------------|
| `npm test` | Alle Unit-Tests (Client + Server, 84 Tests) |
| `npm run test:coverage` | Client-Tests mit Coverage |
| `npm run test:e2e` | Playwright E2E-Tests (11 Tests, benötigt `npx playwright install chromium`) |
| `npm run test --prefix server` | Nur Server-Tests (20 Tests inkl. Route-Tests) |

**CI:** Bei Push/PR auf `main`/`master` laufen Lint, Build, Unit-Tests und E2E-Tests automatisch (GitHub Actions).

## Code-Qualität

| Befehl | Beschreibung |
|--------|-------------|
| `npm run lint` | ESLint ausführen |
| `npm run lint:fix` | ESLint mit Auto-Fix |
| `npm run format` | Prettier auf alle Dateien anwenden |
| `npm run format:check` | Prettier-Konformität prüfen |

Pre-Commit-Hooks (Husky + lint-staged) laufen automatisch bei jedem Commit.

## Build (Produktion)

```bash
npm run build
```

- Baut nacheinander: `shared` → `server` → `client`
- Client-Build liegt in `client/dist/` und kann statisch (z. B. per Nginx) ausgeliefert werden.

## Projektstruktur

```
eXmerg/
├── client/              # React SPA (Vite, Port 3002)
│   ├── src/
│   │   ├── api/         # API-Client (Sheets, Merge, Upload)
│   │   ├── components/  # Upload, FileList, MergeOptions, ActionBar, …
│   │   ├── store/       # Zustand (Dateien, Merge-Optionen, UI-State)
│   │   └── utils/       # z. B. Sheet-Selection-Preview
│   └── dist/            # Statischer Build (nach npm run build)
├── server/              # Express API (Dev: 3004, Prod/Docker: 3003)
│   └── src/
│       ├── config/      # Limits, Port, Upload-Pfad
│       ├── processing/  # Excel/ODS parsen, copySheet, parseOds
│       ├── routes/      # /api/upload-file, /api/sheets, /api/merge, …
│       ├── services/    # mergeService (collectSheetSources, Merge-Modi)
│       └── workers/     # Merge-Worker (isoliert, OOM-sicher)
├── shared/              # Gemeinsame Types & Utils
│   └── src/
│       ├── types/       # MergeMode, MergeOptions, SheetNameFilter, …
│       └── utils/
├── e2e/                 # Playwright E2E-Tests
│   ├── fixtures/files/  # Test-Excel-Dateien
│   └── merge-flow.spec.ts
├── docs/
│   └── ARCHITEKTUR.md
└── package.json         # Workspace-Root, Scripts: dev, build, test, lint
```

## Unterstützte Formate

- **Tabellen:** `.xlsx`, `.xls`, `.ods` (Ein- und Ausgabe)
- Ausgabeformat wählbar: **.xlsx** oder **.ods**

## Merge-Modi (Tabellen)

| Modus | Kurzbeschreibung |
|-------|-------------------|
| **Eine Datei = ein Sheet** | Jede Quelldatei wird zu einem eigenen Sheet; Sheetname = Dateiname (bzw. Dateiname + Sheetname bei mehreren Sheets). |
| **Konsolidierung + Einzelne Sheets** | Erstes Sheet = Zusammenfassung (Zelladressgenau summiert), danach jedes Quell-Sheet als eigenes Sheet. |
| **Alles in eine Tabelle** | Alle Quell-Sheets werden untereinander in ein einziges Sheet gestapelt (Formatierung erhalten). |
| **Mit Herkunftsspalte** | Wie „Alles in eine Tabelle“, mit zusätzlicher Spalte links mit Datei-/Sheet-Herkunft. |
| **Zeilenmatrix** | Jede Quelle = eine Zeile, Spalten = Zellreferenzen (A1, B1, …). |
| **Zeilenmatrix mit Summen** | Wie Zeilenmatrix, plus Gesamt-Zeile mit Spaltensummen. |

Alle Modi verarbeiten **alle Sheets** jeder Datei (nicht nur das erste). Die Reihenfolge der Dateien entspricht der gewählten Sortierung (z. B. Upload-Reihenfolge oder nach Dateiname).

## Sheet-Auswahl & Filter

- **Modus:** „Alle Sheets“ oder „Nur erstes Sheet“ pro Datei.
- **Pro Datei:** In der Dateiliste können pro Datei einzelne Sheets an- oder abgewählt werden (leer = alle).
- **Filter nach Namen:** Optional nur bestimmte Sheets einbeziehen oder ausschließen (exact / contains / RegEx, optional case-sensitive).
- **Live-Vorschau:** Global „X von Y Sheets ausgewählt“ und pro Datei Badge (z. B. 6/7) mit Farbcodierung (grau / blau / grün).

## Ablauf

1. **Dateien:** Drag & Drop oder Auswahl (Validierung Format/Größe).
2. **Reihenfolge:** Sortierung z. B. nach Upload, Dateiname, Datum.
3. **Sheets:** Optional pro Datei Sheets auswählen; optional nur erstes Sheet oder Namenfilter.
4. **Merge-Optionen:** Modus und Ausgabeformat (.xlsx / .ods) wählen.
5. **Zusammenführen:** Merge starten → Fortschritt → Download der Ergebnisdatei.

## Konfiguration (Backend)

Über Umgebungsvariablen (optional):

- `PORT` – Server-Port (Standard: **3003**; in der Entwicklung setzt das Script **3004**)
- `UPLOAD_DIR` – Verzeichnis für Uploads und temporäre Merge-Ergebnisse (Standard: **Projektroot/uploads**, z. B. `/var/www/exmerg/uploads` bei Deployment unter `/var/www/exmerg`)
- `TEMP_FILE_TTL_SECONDS` – Nach welchem Alter (Sekunden) noch vorhandene Temp-Dateien vom Fallback-Cleanup gelöscht werden (Standard: 3600 = 1 Stunde). Gemergte Dateien werden in der Regel direkt nach erfolgreichem Download gelöscht; dieser Wert betrifft z. B. abgebrochene Downloads oder nicht abgeholte Dateien.
- `MAX_FILE_SIZE_BYTES` – Max. Dateigröße pro Datei
- `MAX_FILES_PER_REQUEST` – Max. Anzahl Dateien pro Request

**Bei „Upload fehlgeschlagen“:** Schreibrechte für das Upload-Verzeichnis prüfen, Dateigröße unter dem Limit, Format .xlsx/.xls/.ods. Der Server liefert eine konkrete Fehlermeldung in der roten Leiste.

### Backend in Produktion (Docker, kein systemd)

Das Backend wird **nicht mehr über systemd** gestartet. Stattdessen läuft es im Container:

```bash
docker compose up -d
```

Siehe Abschnitt **Deployment (Docker)** unten für Erstdeploy und Updates.

*(Falls du weiterhin systemd nutzen willst: Der Backend-Service sollte aus Sicherheitsgründen **nicht** als root laufen – z. B. `User=www-data` und `Group=www-data` in der Unit. Das Upload-Verzeichnis muss dann `www-data` gehören.)*

## Deployment (z. B. Nginx)

- **Client:** Statische Dateien aus `client/dist/` ausliefern (Root oder Unterpfad).
- **API:** **Alle** Anfragen unter `/api` an den Node-Server weiterleiten (z. B. Port 3003).  
  Bei **HTTP 404** und „Antwort ist kein JSON“ leitet der Proxy die Anfrage oft nicht weiter oder nur für einzelne Pfade – dann fehlt z. B. `POST /api/upload-file`.

**Benötigte API-Routen (alles unter `/api`):**

| Methode | Pfad | Beschreibung |
|--------|------|--------------|
| POST   | `/api/upload-file` | Einzeldatei-Upload (für Merge) |
| POST   | `/api/sheets`      | Sheet-Namen + Vorschau |
| POST   | `/api/merge`       | Merge starten (fileIds oder Dateien) |
| GET    | `/api/progress/:mergeId` | SSE-Fortschritt |
| DELETE | `/api/merge/:mergeId/cancel` | Merge abbrechen |
| GET    | `/api/download`    | Ergebnis-Download |

**Nginx – gesamtes `/api` an Node weiterleiten:**

```nginx
server {
  listen 80;
  server_name exmerg.de;
  root /pfad/zu/eXmerg/client/dist;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
  location /api {
    proxy_pass http://127.0.0.1:3003;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    client_max_body_size 100M;
  }
}
```

Backend per **Docker** starten (siehe unten). Nginx bleibt unverändert und proxyt weiterhin auf `127.0.0.1:3003`.

### Deployment (Docker)

- **Upload-Verzeichnis** ist persistent: Host-Pfad `/var/www/exmerg/uploads` wird per Volume in den Container gemountet (`/uploads`), `UPLOAD_DIR=/uploads` wird per Umgebung gesetzt.
- Der Container lauscht nur auf **127.0.0.1:3003**; Nginx auf dem Host proxyt wie bisher auf diesen Port.

**Erstdeploy:**

```bash
docker compose build
docker compose up -d
```

**Update (nach z. B. git pull):**

```bash
git pull
npm install
docker compose build
docker compose up -d
```

`docker compose up -d` baut bei Bedarf neu und startet den Container mit `restart: always`. Nginx-Konfiguration muss nicht angepasst werden.

## Weitere Hinweise

- **Worker:** Große Merges laufen in einem separaten Worker-Prozess (speicherbewusst).
