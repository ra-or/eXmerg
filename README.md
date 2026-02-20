# eXmerg

Lokale Webanwendung zum **Mergen von Excel/ODS- und ODG-Dateien**. Skalierbares Grundgerüst für spätere Erweiterungen.

## Tech-Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS, React Query, Zustand
- **Backend:** Node.js, Express, TypeScript
- **Gemeinsam:** Shared-Package mit Types und Utils

## Setup

```bash
# Im Projektroot
npm install
```

## Dev-Start

Client und Server parallel starten (Client Port **3002**, Server Port **3003**):

```bash
npm run dev
```

Dann im Browser: **http://localhost:3002**

- Der Vite-Dev-Server proxied `/api` an den Backend-Server (Port 3003).

## Projektstruktur

```
eXmerg/
├── client/          # React SPA (Vite, Port 3002)
│   └── src/
│       ├── api/      # API-Client (preview, merge)
│       ├── components/
│       ├── pages/
│       └── store/    # Zustand (UI-State)
├── server/          # Express API (Port 3003)
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── processing/  # Excel/ODS Preview, Read, ODG Merge
│       ├── routes/
│       └── services/   # Merge-Strategien, MergeService
├── shared/          # Gemeinsame Types & Utils
│   └── src/
│       ├── types/
│       └── utils/
├── docs/
│   └── ARCHITEKTUR.md
└── package.json     # Workspace-Root, Script: dev
```

## Unterstützte Formate

- **Tabellen:** `.xlsx`, `.xls`, `.ods`
- **Zeichnungen:** `.odg`

## Merge-Modi (Excel/ODS)

| Modus | Beschreibung |
|-------|--------------|
| **A – Alle in eine Tabelle** | Alle Dateien werden in ein Sheet geschrieben. Spalten-Union; fehlende Werte leer. |
| **B – Eine Datei = ein Sheet** | Jede Datei wird zu einem eigenen Sheet. Sheetname = ursprünglicher Dateiname. |
| **C – Alle + Herkunftsspalte** | Wie A, mit zusätzlicher Spalte `source_file` pro Zeile. |
| **D – Sheet-weises Mergen** | Sheets mit gleichem Namen aus verschiedenen Dateien werden zusammengeführt. |

## ODG-Merge (MVP)

- Nur `.odg`-Dateien auswählen.
- Dokumente werden hintereinander zusammengeführt (Architektur für spätere Layout-Optionen vorbereitet).

## Ablauf

1. **Upload:** Drag & Drop oder Dateiauswahl (Multi-File, Validierung Format/Größe).
2. **Vorschau:** „Vorschau laden“ → Sheet-Metadaten und Tabellen-Sample (für .xlsx).
3. **Merge-Optionen:** Modus wählen (bei Tabellen).
4. **Zusammenführen:** Merge starten → Fortschritt/Disabled-State → Erfolg/Fehler.
5. **Download:** Ergebnis als `.xlsx` (Tabellen) oder `.odg` (Zeichnungen) herunterladen.

## Konfiguration (Backend)

Über Umgebungsvariablen (optional):

- `PORT` – Server-Port (Standard: 3003)
- `UPLOAD_DIR` – Verzeichnis für Uploads/Temp
- `MAX_FILE_SIZE_BYTES` – Max. Dateigröße pro Datei
- `MAX_FILES_PER_REQUEST` – Max. Anzahl Dateien pro Request

## Erweiterbarkeit (vorbereitet)

- **Worker-Queue:** Service-Layer so angelegt, dass große Merges später in eine Job-Queue ausgelagert werden können.
- **Presets:** Merge-Optionen sind serialisierbar; Persistenz (z. B. DB) kann ergänzt werden.
- **Weitere Ausgabeformate:** Export über `outputType` erweiterbar.
- **Deployment:** ENV-basierte Config; Client-Build statisch auslieferbar.
