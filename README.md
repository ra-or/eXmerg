# eXmerg

Lokale Webanwendung zum **Zusammenführen von Excel- und ODS-Dateien**. Mehrere Tabellendateien können in verschiedenen Modi zu einer Ausgabe zusammengeführt werden – inklusive Formatierung, Konsolidierung und optionaler Sheet-Auswahl bzw. Filterung.

## Tech-Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS, Zustand
- **Backend:** Node.js, Express, TypeScript
- **Gemeinsam:** Shared-Package mit Types und Utils

## Setup

```bash
# Im Projektroot (installiert alle Workspaces: client, server, shared)
npm install
```

## Entwicklung

Client und Server parallel starten (Client **3002**, Server **3003**):

```bash
npm run dev
```

Im Browser: **http://localhost:3002**

- Der Vite-Dev-Server proxied `/api` an den Backend-Server.

## Build (Produktion)

```bash
npm run build
```

- Baut nacheinander: `shared` → `server` → `client`
- Client-Build liegt in `client/dist/` und kann statisch (z. B. per Nginx) ausgeliefert werden.

## Projektstruktur

```
eXmerg/
├── client/              # React SPA (Vite, Port 3002)
│   ├── src/
│   │   ├── api/         # API-Client (Sheets, Merge)
│   │   ├── components/  # Upload, FileList, MergeOptions, ActionBar, …
│   │   ├── store/       # Zustand (Dateien, Merge-Optionen, UI-State)
│   │   └── utils/       # z. B. Sheet-Selection-Preview
│   └── dist/            # Statischer Build (nach npm run build)
├── server/              # Express API (Port 3003)
│   └── src/
│       ├── config/      # Limits, Port, Upload-Pfad
│       ├── processing/  # Excel/ODS parsen, copySheet, parseOds
│       ├── routes/      # /api/upload, /api/sheets, /api/merge, …
│       ├── services/    # mergeService (collectSheetSources, Merge-Modi)
│       └── workers/     # Merge-Worker (isoliert, OOM-sicher)
├── shared/              # Gemeinsame Types & Utils
│   └── src/
│       ├── types/       # MergeMode, MergeOptions, SheetNameFilter, …
│       └── utils/
├── docs/
│   └── ARCHITEKTUR.md
└── package.json         # Workspace-Root, Scripts: dev, build
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

Alle Modi verarbeiten **alle Sheets** jeder Datei (nicht nur das erste). Die Reihenfolge der Dateien entspricht der gewählten Sortierung (z. B. Upload-Reihenfolge oder nach Dateiname).

## Sheet-Auswahl & Filter

- **Modus:** „Alle Sheets“ oder „Nur erstes Sheet“ pro Datei.
- **Pro Datei:** In der Dateiliste können pro Datei einzelne Sheets an- oder abgewählt werden (leer = alle).
- **Filter nach Namen:** Optional nur bestimmte Sheets einbeziehen oder ausschließen (exact / contains / RegEx, optional case-sensitive).
- **Live-Vorschau:** Global „X von Y Sheets ausgewählt“ und pro Datei Badge (z. B. 6/7) mit Farbcodierung (grau / blau / grün).

## Ablauf

1. **Dateien:** Drag & Drop oder Auswahl (Validierung Format/Größe).
2. **Reihenfolge:** Sortierung z. B. nach Upload, Dateiname, Datum.
3. **Sheets:** Optional pro Datei Sheets auswählen; optional nur erstes Sheet oder Namenfilter.
4. **Merge-Optionen:** Modus und Ausgabeformat (.xlsx / .ods) wählen.
5. **Zusammenführen:** Merge starten → Fortschritt → Download der Ergebnisdatei.

## Konfiguration (Backend)

Über Umgebungsvariablen (optional):

- `PORT` – Server-Port (Standard: 3003)
- `UPLOAD_DIR` – Verzeichnis für Uploads/Temp
- `MAX_FILE_SIZE_BYTES` – Max. Dateigröße pro Datei
- `MAX_FILES_PER_REQUEST` – Max. Anzahl Dateien pro Request

## Deployment (z. B. Nginx)

- **Client:** Statische Dateien aus `client/dist/` ausliefern (Root oder Unterpfad).
- **API:** Proxy von `/api` auf den Node-Server (z. B. Port 3003).
- Backend mit `node server/dist/index.js` (oder PM2) starten; Umgebungsvariablen setzen.

## Weitere Hinweise

- **Worker:** Große Merges laufen in einem separaten Worker-Prozess (speicherbewusst).
- **ODG:** Zeichnungen (`.odg`) können in einer eigenen Pipeline zusammengeführt werden (siehe Architektur).
