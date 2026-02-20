# Plan: Merge großer Dateien (20 MB, viele Dateien) stabiler machen

## Ausgangslage

- **Aktuelle Limits:** 20 MB pro Datei, max. 40 Dateien (Server + Client).
- **Worker:** 2 GB Heap (`--max-old-space-size=2048`), Timeout 5 Minuten, max. 2 parallele Worker.
- **Problem:** Bei vielen großen Dateien (z. B. 20 MB × viele Dateien) kommt es zu Timeouts, OOM („Nicht genug Arbeitsspeicher“) oder sehr langen Laufzeiten.

---

## Analyse des aktuellen Codes

### 1. Wo die Limits liegen

| Stelle | Wert | Datei |
|--------|------|--------|
| Server Default | 20 MB, 40 Dateien | `server/src/config/index.ts` |
| Client (UI) | 20 MB, 40 Dateien (hardcoded) | `client/src/components/UploadArea.tsx` |
| Shared Default | 20 MB, 40 Dateien | `shared/src/types/config.ts` |
| Worker Heap | 2048 MB | `server/src/routes/mergeRoutes.ts` |
| Merge-Timeout | 5 Min | `server/src/routes/mergeRoutes.ts` |

### 2. Speicherverhalten pro Merge-Modus

| Modus | Speicherstrategie | Risiko bei vielen/großen Dateien |
|-------|-------------------|-----------------------------------|
| **Eine Datei = ein Sheet** | **Streaming.** Pro Datei: laden → in Stream schreiben → freigeben. Peak ≈ 1 Quelldatei. | **Gering** – nur eine Datei gleichzeitig im RAM. |
| **Alles in eine Tabelle** / **Mit Herkunftsspalte** | **Kein Streaming.** Ein großes Workbook im RAM; pro Datei laden, Zeilen reinkopieren, Quelle freigeben. **Das Ausgabe-Workbook wächst mit jeder Datei** (alle Zeilen im RAM). | **Hoch** – Ausgabe kann hunderte MB bis GB werden. |
| **Konsolidierung + Einzelne Sheets** | **Alle Workbooks gleichzeitig im RAM.** `loaded: LoadedFile[]` hält alle `wb`-Referenzen. | **Sehr hoch** – 40 × 20 MB Dateien → ExcelJS kann 40 × 100–300 MB = mehrere GB bedeuten. |
| **Zeilenmatrix** | Pro Datei laden, **vollständiges Grid** (2D-Array) in `loaded` speichern, Workbook verwerfen. Alle Grids bleiben im RAM. | **Hoch** – 40 große Sheets = 40 große Arrays im RAM. |

Kurz: Nur der Modus „Eine Datei = ein Sheet“ ist speicherarm (Streaming). Die anderen Modi bauen das Ergebnis vollständig im Speicher auf bzw. halten viele Daten gleichzeitig.

### 3. Weitere Engpässe

- **Timeout 5 Min:** Bei 40 × 20 MB kann Parsing + Merge länger dauern.
- **2 parallele Worker:** Zwei schwere Merges gleichzeitig verdoppeln den Speicherdruck auf dem Server.
- **ODS-Konvertierung im Worker:** Nach dem Merge wird bei Ausgabe ODS nochmal das komplette Workbook geladen und geschrieben → zusätzlicher Speicherpeak.

---

## Option A: Limits verschärfen (schnell umsetzbar)

**Idee:** Weniger große Dateien erlauben, damit OOM und Timeout seltener auftreten.

- **Variante 1 – kleinere Einzeldatei:**  
  - z. B. **10 MB** pro Datei, 40 Dateien bleiben.  
  - Server: `DEFAULT_FILE_LIMITS.maxFileSizeBytes = 10 * 1024 * 1024` (evtl. per Env `MAX_FILE_SIZE_BYTES`).  
  - Client: `MAX_SIZE` in `UploadArea.tsx` anpassen (oder später aus API holen).
- **Variante 2 – weniger Dateien:**  
  - z. B. 20 MB bleiben, **max. 20 Dateien** (`MAX_FILES_PER_REQUEST` / Client `MAX_FILES`).
- **Variante 3 – kombiniertes Limit:**  
  - z. B. „Max. 200 MB Gesamt-Upload“ oder „Bei Dateien > 10 MB max. 15 Stück“.  
  - Erfordert eine neue Prüfung (Gesamtgröße bzw. Kombination Größe/Anzahl) im Upload und ggf. in der API.

**Bewertung:** Stabilisiert schnell, begrenzt aber die Nutzung. Sinnvoll als **Sofortmaßnahme** zusätzlich zu B/C.

---

## Option B: Worker-Ressourcen anheben

- **Mehr Heap:** z. B. `--max-old-space-size=4096` (4 GB). Über Env steuerbar machen, z. B. `MERGE_WORKER_HEAP_MB=4096`.
- **Längerer Timeout:** z. B. 10 Minuten für große Merges. Konfigurierbar z. B. `MERGE_TIMEOUT_MS`.
- **Weniger Parallelität:** `MAX_WORKERS = 1`, damit nur ein schwerer Merge läuft → weniger OOM-Risiko, Warteschlange wird genutzt.

**Bewertung:** Hilft bei Grenzfällen, löst das grundsätzliche Speicherproblem der Modi „Alles in eine Tabelle“ und „Konsolidierung“ nicht.

---

## Option C: Merge-Strategien speicherärmer machen (mittelfristig)

### C1 – „Alles in eine Tabelle“ / „Mit Herkunftsspalte“

- **Ziel:** Kein riesiges Workbook im RAM.
- **Ansatz:** ExcelJS-Stream-Writer nutzen (wie schon bei „Eine Datei = ein Sheet“).  
  - Pro Datei: Workbook laden → Zeilen nacheinander in den Stream schreiben (mit Zeilen-Offset + ggf. Herkunftsspalte) → Workbook freigeben.  
- **Aufwand:** Mittel (Layout/Merges/Spaltenbreiten pro Datei in den Stream übernehmen, dann nächste Datei).

### C2 – „Konsolidierung + Einzelne Sheets“

- **Problem:** Alle Workbooks gleichzeitig in `loaded` halten.
- **Ansatz (2-Pass ohne alle Workbooks im RAM):**  
  - **Pass 1:** Pro Datei nacheinander laden → nur die Werte, die für die Konsolidierung gebraucht werden (z. B. (row, col) → Zahl/Formel), in eine kompakte Struktur schreiben → Workbook sofort freigeben.  
  - **Pass 2:** Ein Zusammenfassungs-Sheet aus diesen Daten bauen.  
  - **Einzelne Sheets:** Weiterhin nacheinander: eine Datei laden → ein Sheet in den Stream schreiben (wie copyFilesToSheets) → freigeben.  
- **Aufwand:** Hoch (Konsolidierungs-Logik umbauen, ggf. zwei Ausgabedateien oder Stream + ein Summary-Sheet).

### C3 – „Zeilenmatrix“

- Statt alle Grids in `loaded` zu halten: Pro Datei laden → nur die für die Ausgabezeile nötigen Werte (eine Zeile + ggf. Summen) extrahieren → Workbook/Grid verwerfen.  
- Oder: Ausgabe streamen (eine Zeile pro Datei schreiben).  
- **Aufwand:** Mittel.

**Bewertung:** Deutliche Entlastung bei vielen/großen Dateien, erfordert gezielte Refactorings in `mergeService.ts`.

---

## Option D: Nutzer-Hinweise und dynamische Grenzen

- **Hinweis in der UI:** z. B. „Bei vielen oder sehr großen Dateien kann der Merge länger dauern oder an Speichergrenzen stoßen. Bitte ggf. weniger oder kleinere Dateien verwenden.“ (bei z. B. > 15 Dateien oder Gesamtgröße > 100 MB).
- **Dynamisches Limit:** Ab einer bestimmten Gesamtgröße (z. B. 200 MB) oder ab einer Dateigröße (z. B. 15 MB) die max. Dateianzahl reduzieren (z. B. max. 20 Dateien).  
  Dafür müssen Client und Server dieselbe Logik bzw. dieselben Grenzwerte kennen (z. B. Limits vom Server abrufen).

---

## Empfohlene Reihenfolge

1. **Sofort (Option A + B):**  
   - Limits etwas verschärfen (z. B. 10 MB oder max. 20 Dateien **oder** kombiniertes Limit).  
   - Worker: Timeout und Heap konfigurierbar machen, evtl. `MAX_WORKERS = 1` und Timeout 10 Min.  
   - Client-Limits an Server-Limits anpassen (oder aus API laden).

2. **Kurzfristig (Option D):**  
   - Hinweis bei vielen/großen Dateien anzeigen.  
   - Optional: dynamisches Limit (weniger Dateien bei großer Gesamtgröße).

3. **Mittelfristig (Option C):**  
   - Zuerst **C1** („Alles in eine Tabelle“ / „Mit Herkunftsspalte“) auf Streaming umstellen – großer Effekt, machbar.  
   - Dann **C2** (Konsolidierung) 2-Pass ohne alle Workbooks im RAM.  
   - Dann **C3** (Zeilenmatrix) speicherarm.

---

## Soll das Dateigrößen-Limit verkleinert werden?

- **Ja, als Teil einer Sofortmaßnahme:**  
  - z. B. auf **10 MB** zu gehen (oder 15 MB) reduziert das Risiko bei „vielen Dateien“ deutlich.  
  - Kombination „10 MB × 20 Dateien“ oder „20 MB × 15 Dateien“ ist oft stabiler als „20 MB × 40 Dateien“.

- **Limit nur verkleinern reicht nicht dauerhaft:**  
  - Die Modi „Alles in eine Tabelle“, „Konsolidierung“ und „Zeilenmatrix“ bleiben speicherintensiv; bei weiter steigenden Anforderungen treten Probleme wieder auf.  
  - Daher: Limits anpassen **plus** Option B (Ressourcen/Timeout) **plus** mittelfristig Option C (speicherarme Strategien).

Wenn du möchtest, kann als nächster Schritt eine konkrete Umsetzung für **Option A + B** (Limits + konfigurierbarer Worker/Timeout) vorgeschlagen werden, inkl. der genauen Änderungen in Config, Route und Client.
