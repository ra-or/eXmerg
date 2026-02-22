# Architektur & Datenfluss

## Übersicht

Monorepo mit drei Hauptbereichen:
- **client** – React SPA (Vite, Port 3002)
- **server** – Express API (Port 3002 oder 3003, konfigurierbar)
- **shared** – gemeinsame TypeScript-Typen und Utils

## Datenfluss

### 1. Upload → Preview
```
User wählt Dateien → Validierung (MIME, Extension, Size) → POST /preview (FormData)
→ Server: multer → FileProcessor.preview() → Sheet-Metadaten + Sample-Rows
→ Client: React Query cache → Preview-Panel + Sheet-Auswahl
```

### 2. Merge (Tabellen)
```
Dateiliste + Merge-Optionen (Mode A/B/C/D) → POST /merge (FormData + JSON options)
→ Server: multer → MergeService (Strategy Pattern) → Excel/ODS Pipeline
→ Temp-Datei erstellen → Response: { downloadUrl }
→ Client: window.location / fetch blob → Download
→ Server: Cleanup temp nach Ablauf oder on-finish
```

## Backend-Schichten

| Schicht | Verantwortung |
|--------|----------------|
| **Routes** | HTTP, Validierung Request, Typed Response |
| **Controllers** | Request/Response Mapping, async wrapper |
| **Services** | Business-Logik (Merge-Strategien, Koordination) |
| **File Processing** | exceljs, Temp-Files |
| **Config** | Limits, Port, Pfade, env-basiert |

## Frontend-Schichten

| Schicht | Verantwortung |
|--------|----------------|
| **Pages** | Layout, Zusammenspiel der Sektionen |
| **Components** | Wiederverwendbare UI (Upload, FileList, Preview, Options) |
| **Hooks / API** | React Query (preview, merge), Zustand (UI State) |
| **Types** | Aus shared, keine Duplikate |

## Merge-Strategien (erweiterbar)

- **Mode A**: Alle Dateien → eine Tabelle, Spalten-Union, leere Zellen
- **Mode B**: Eine Datei = ein Sheet, Sheetname = Dateiname
- **Mode C**: Alle in ein Sheet + Spalte `source_file`
- **Mode D**: Sheet-weises Mergen (gleiche Sheetnamen zusammen)

Strategie-Registry im Backend: `MergeStrategyRegistry` mit `strategyId` → Handler.

## Erweiterbarkeit (vorbereitet)

- **Worker Queue**: Service-Interface für `processLargeMerge(jobId)` vorbereiten
- **Presets**: Options-Struktur serialisierbar, DB/Store später ergänzbar
- **Weitere Formate**: Export-Factory nach `outputType` (xlsx / ods)
- **Deployment**: Config über ENV, statische Client-Builds servierbar
