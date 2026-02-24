# Architektur & Datenfluss

## Übersicht

Monorepo mit drei Hauptbereichen:
- **client** – React SPA (Vite, Port 3002)
- **server** – Express API (Entwicklung: Port 3004, Produktion/Docker: 3003)
- **shared** – gemeinsame TypeScript-Typen und Utils

## Datenfluss

### 1. Upload → Sheet-Infos
```
User wählt Dateien → Validierung (MIME, Extension, Size)
→ POST /api/upload-file (Einzeldatei) oder Dateien direkt beim Merge
→ POST /api/sheets (FormData) → Sheet-Namen + Vorschau-Zeilen
→ Client: Zustand/API → Preview-Panel + Sheet-Auswahl
```

### 2. Merge (Tabellen)
```
Dateiliste + Merge-Optionen (mode: all_to_one_sheet | one_file_per_sheet | …) → POST /api/merge (FormData + JSON options)
→ Server: multer → MergeService (Strategy Pattern) → Excel/ODS Pipeline
→ Temp-Datei erstellen → Response: { downloadUrl } oder { mergeId } + SSE
→ Client: window.location / fetch blob → Download
→ Server: Cleanup temp nach Ablauf oder on-finish
```

## Backend-Schichten

| Schicht | Verantwortung |
|--------|----------------|
| **Routes** | HTTP, Validierung Request, Typed Response (Logik in Route-Handlern, kein separates Controller-Layer) |
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

Die Modi heißen im Code wie in `shared` (MergeMode) und in der UI z. B. „Alles in eine Tabelle“:

| Modus (Code) | Kurzbeschreibung |
|--------------|------------------|
| `all_to_one_sheet` | Alle Dateien → ein Sheet, Spalten-Union, Formatierung erhalten |
| `one_file_per_sheet` | Eine Datei = ein Sheet, Sheetname = Dateiname (bzw. Dateiname + Sheetname) |
| `all_with_source_column` | Wie all_to_one_sheet, mit Spalte „Herkunft“ (Datei/Sheet) |
| `consolidated_sheets` | Erstes Sheet = Konsolidierung (Summen), danach jedes Quell-Sheet einzeln |
| `row_per_file` | Jede Quelle = eine Zeile, Spalten = Zellreferenzen (Zeilenmatrix) |
| `row_per_file_no_sum` | Wie row_per_file, ohne Summenzeile |

Strategie-Registry im Backend: `getMergeStrategy(mode)` mit `MergeMode` → Handler.

## Erweiterbarkeit (vorbereitet)

- **Worker Queue**: Service-Interface für `processLargeMerge(jobId)` vorbereiten
- **Presets**: Options-Struktur serialisierbar, DB/Store später ergänzbar
- **Weitere Formate**: Export-Factory nach `outputType` (xlsx / ods)
- **Deployment**: Config über ENV, statische Client-Builds servierbar
