# Audit: Was ist falsch, unbrauchbar oder überarbeitungswürdig?

Stand: Februar 2025. Dieses Dokument listet konkrete Punkte im Projekt, die **falsch/fehleranfällig**, **unbrauchbar/ungenutzt** oder **überarbeitungswürdig** sind.

---

## 1. Falsch / fehleranfällig (bereits behoben oder zu korrigieren)

| Wo | Problem | Status / Empfehlung |
|----|---------|----------------------|
| **README** | Entwicklung: Server-Port war als 3003 angegeben, läuft in Dev aber auf **3004** (siehe `server/package.json` Script `dev`). | **Behoben:** README nennt jetzt korrekt Port 3004 in Entwicklung und 3003 in Produktion/Docker. |
| **docs/ARCHITEKTUR.md** | Server-Port „3002 oder 3003“ – falsch; es sind **3004** (Dev) und **3003** (Prod). Außerdem: Datenfluss nennt **POST /preview**; tatsächlich heißen die Routen **POST /sheets** und **POST /upload-file**. | **Behoben:** Ports und Routen in ARCHITEKTUR.md angepasst. |
| **docs/ARCHITEKTUR.md** | Merge-Strategien als „Mode A/B/C/D“ beschrieben; im Code heißen die Modi z. B. `all_to_one_sheet`, … | **Behoben:** Tabelle mit Code-Namen und Kurzbeschreibung ergänzt. |

---

## 2. Unbrauchbar / Duplikate / eine Quelle fehlt

| Wo | Problem | Empfehlung |
|----|---------|------------|
| **Sheet-Name-Filter-Typ** | Derselbe Strukturtyp existiert dreifach: **shared** `SheetNameFilterOption` (merge.ts), **server** `SheetNameFilter` (mergeService.ts), **client** `SheetNameFilterOption` (sheetSelectionPreview.ts). Identische Felder: mode, values, match?, caseSensitive?. | **Überarbeitung:** Ein Typ in **shared** (z. B. `SheetNameFilterOption`) verwenden; Server und Client importieren ihn. Server-`SheetNameFilter` und Client-Duplikat entfernen. |
| **matchesSheetName** | Die gleiche Filterlogik (exact/contains/regex, caseSensitive) ist **zweimal** implementiert: in `server/services/mergeService.ts` und in `client/utils/sheetSelectionPreview.ts`. | **Überarbeitung:** Funktion in **shared** auslagern (z. B. `shared/utils/sheetFilter.ts`), von Client und Server importieren. So bleibt die Live-Vorschau im Client konsistent mit dem Backend. |
| **Vite-Proxy-Default** | Proxy-Default war 3003, Dev-Server läuft auf 3004. | **Behoben:** Default in vite.config.ts auf 3004 gesetzt. |

---

## 3. Überarbeitung nötig (Inkonsistenzen, Veraltetes, Klarheit)

| Wo | Problem | Empfehlung |
|----|---------|------------|
| **shared/types/merge.ts** | `outputType` vs. `outputFormat` wirkt redundant. | **Behoben:** Kommentare klären: outputType = Discriminator für Optionstyp, outputFormat = tatsächliches Dateiformat. |
| **docs/VORSCHLAEGE-VERBESSERUNG-OPTIMIERUNG-1337.md** | Health-Check als Vorschlag, existiert aber bereits. | **Behoben:** Als „bereits umgesetzt“ markiert. |
| **ARCHITEKTUR.md** | „Controllers“ in Backend-Tabelle, aber kein separates Controller-Layer. | **Behoben:** Tabelle angepasst (Logik in Route-Handlern erwähnt, Controllers entfernt). |
| **CI** | `.github/workflows/ci.yml` führt Client-Tests, dann Server-Tests, dann nochmal `npm run test:coverage` aus. Coverage läuft also ein zweites Mal (nach den normalen Client-Tests). | **Optional:** Nur einmal Coverage laufen lassen (z. B. nur `npm run test:coverage` für Client) oder Reihenfolge dokumentieren, wenn beabsichtigt. |

---

## 4. Kurzüberblick

- **Behoben:** README; ARCHITEKTUR (Ports, Routen, Merge-Modi, Backend-Schichten); Sheet-Filter + matchesSheetName in shared; shared outputType/outputFormat-Kommentare; VORSCHLAEGE (Health-Check); Vite-Proxy-Default 3004.
- **Optional offen:** CI-Coverage-Schritt (Client-Tests + Coverage evtl. zusammenführen).
