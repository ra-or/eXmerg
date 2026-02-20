# Vorschläge: Verbesserung, Optimierung & 1337-Features

---

## 1. Verbesserungen (UX & Robustheit)

| Thema | Vorschlag | Aufwand |
|-------|-----------|--------|
| **Fehlermeldungen** | Server-Fehler (OOM, Timeout) mit klarem Hinweis anzeigen (z. B. „Weniger Dateien wählen“ / „Dateien verkleinern“). Bereits teilweise da – einheitlich formulieren und ggf. i18n. | Gering |
| **Validierung vor Upload** | Beim Drag & Drop sofort prüfen: Format + Größe, und ungültige Dateien markieren oder ausfiltern, statt erst beim Merge zu scheitern. | Gering |
| **Abbrechen** | Merge-Job abbrechen können (SSE schließen + Worker killen + API zum Cancel). | Mittel |
| **Offline / Netzwerk** | Bei Netzwerkfehler klare Meldung + „Erneut versuchen“. Optional: Service Worker für Offline-Fallback-Seite. | Gering / Mittel |
| **Barrierefreiheit** | Fokus-Reihenfolge, ARIA-Labels für Buttons/Upload, Skip-Link, Kontrast prüfen. | Mittel |
| **Mobile** | Touch-freundlichere Ziele, evtl. vereinfachte Ansicht für kleine Screens (weniger Spalten in der Dateiliste). | Mittel |
| **Limits aus Backend** | Client holt max. Dateigröße und max. Dateianzahl von `/api/config` oder aus einem eingebetteten Endpoint – eine Quelle der Wahrheit, kein Hardcoding im Client. | Gering |

---

## 2. Optimierungen (Performance & Wartbarkeit)

| Thema | Vorschlag | Aufwand |
|-------|-----------|--------|
| **Große Merges** | Siehe `docs/PLAN-GROSSE-DATEIEN-MERGE.md`: Streaming für „Alles in eine Tabelle“, 2-Pass für Konsolidierung, weniger gleichzeitige Workbooks im RAM. | Hoch |
| **Worker-Ressourcen** | Heap, Timeout und ggf. `MAX_WORKERS` per ENV konfigurierbar (z. B. `MERGE_WORKER_HEAP_MB`, `MERGE_TIMEOUT_MS`). | Gering |
| **Client-Bundle** | Route-based oder lazy `React.lazy()` für schwere Komponenten (z. B. DownloadHistory/Templates nur bei Bedarf laden). Kann bei wachsendem Feature-Set sinnvoll werden. | Gering |
| **API-Versionierung** | Pfad wie `/api/v1/merge` oder Header `Accept: application/vnd.exmerg.v1+json` – erleichtert spätere Breaking Changes. | Gering |
| **Logging** | Strukturierte Logs (z. B. JSON) mit Request-ID, Dauer, Dateianzahl – hilft bei Debug und Monitoring. | Gering |
| **Health-Check** | `GET /api/health` (z. B. „OK“ + Versions- oder Build-Info) für Load-Balancer / Docker. | Gering |

---

## 3. 1337 / „Respect“-Features (coole Spielerei + Glaubwürdigkeit)

Ideen, die technisch Eindruck machen oder Power-User/Devs ansprechen – ohne den normalen Flow zu stören.

---

### 3.1 Tastatur-Steuerung (Power-User)

- **Shortcuts (global):**
  - `Ctrl/Cmd + Enter` → Merge starten (wenn Dateien da sind).
  - `Ctrl/Cmd + O` → Datei-Dialog öffnen.
  - `Escape` → Modals schließen / Fokus zurücksetzen.
- **Optional erweiterbar:** Fokus durch Bereiche springen (Tab-Reihenfolge), Nummern 1–5 für Merge-Modi (wie in vielen Profi-Tools).
- **Wirkung:** Zeigt, dass die App „für Leute gebaut ist, die nicht nur klicken wollen“.

---

### 3.2 Headless / CLI-freundliche API (Scripting & Automation)

- **Merge per JSON + Datei-IDs oder Base64:**  
  Ein Endpoint (z. B. `POST /api/merge-batch`) der nur JSON entgegennimmt: Optionen + Liste von `{ fileId }` (von vorherigen Uploads) oder `{ base64, filename }`. Kein Multipart nötig.
- **Oder:** Dokumentierter Ablauf: `POST /api/upload-file` pro Datei → dann `POST /api/merge` mit `fileIds` + `options`. Das habt ihr schon – in der README oder in einer „API“-Sektion als „Scripting / curl / 1337“ hervorheben.
- **Response:** Neben `downloadUrl` optional einen `jobId` und einen Link zum Status (`GET /api/job/:id`) für lange Merges.
- **Wirkung:** „Ich kann den Merge aus einem Shell-Script / Python / GitHub Action triggern“ = großer Respekt bei Devs.

---

### 3.3 Konami-Code Easter Egg (Spielerei)

- Beim Fokus auf der Seite: **↑ ↑ ↓ ↓ ← → ← → B A** (oder vereinfacht: z. B. **↑ ↓ ↑ ↓**).
- **Effekt:** Wechsel in einen „Terminal-/Matrix-Modus“: dunkler Hintergrund, Monospace, dezente Scanline- oder Grün-on-Schwarz-Optik, evtl. Subtitle-Text wie „MERGE.EXE READY“.
- Optional: Konsole (DevTools) mit einem kleinen ASCII-Banner beim App-Start („eXmerg – merge spreadsheets like a pro“).
- **Wirkung:** Zeigt, dass ihr an Details und Spaß denkt – ohne die App zu überladen.

---

### 3.4 „Pro Mode“ / Terminal-Optik (opt-in)

- Ein Schalter in den Einstellungen oder per Query-Param: `?pro=1` oder „Pro-Modus“-Toggle.
- **Anzeige:** Monospace-Font, dunkles Theme, Fortschritt als Text/Progress-Bar im Terminal-Stil (z. B. `[############------] 62%`), Log-ähnliche Meldungen („Loading file 3/12…“, „Writing sheet Merged…“).
- Optional: Merge-Optionen als „Config-Block“ anzeigen (z. B. `mode: one_file_per_sheet`, `outputFormat: xlsx`) – fühlt sich wie ein Tool für Profis an.
- **Wirkung:** Sieht aus wie ein „seriöses“ Dev-Tool und spricht Leute an, die Terminal/CLI mögen.

---

### 3.5 Merge from URL („Load from link“)

- Zusätzlich zu Upload: **URL eingeben** (z. B. zu einer .xlsx auf einem Server oder S3-signed URL). Backend lädt die Datei per HTTP, speichert sie temporär und fügt sie zur Merge-Liste hinzu.
- Mit klarer Warnung: nur für vertrauenswürdige URLs, evtl. Limit (z. B. max. 5 URLs pro Merge, gleiche Größenlimits).
- **Wirkung:** „Ich muss nicht alles lokal haben“ – sehr praktisch und technisch anspruchsvoll (Fetch, Timeouts, Validierung).

---

### 3.6 Console-Banner (minimaler Aufwand, großer Effekt)

- Beim Start der App (z. B. in `main.tsx` oder einmal im Root-Component) in `console.log` ein kleines ASCII-Art-Banner ausgeben, z. B.:

```
  _____  __  ______  _____  ____  _____
 | ____| \ \/ /  _ \| ____|/ ___|| ____|_
 |  _|    \  /| |_) |  _|  \___ \|  _| (_)
 | |___   /  \|  _ <| |___  ___) | |___ _
 |_____| /_/\_\_| \_\_____||____/ |_____(_)
   Excel · ODS merge — no cloud, no track.
```

- **Wirkung:** Jeder, der die DevTools öffnet, sieht sofort: Hier steckt Liebe zum Detail drin. Eignet sich perfekt als „1337“-Geste ohne echten Feature-Aufwand.

---

## 4. Empfohlene Reihenfolge (wenn du priorisieren willst)

1. **Schnell & sichtbar:** Console-Banner (3.6) + Limits aus Backend (1) + Health-Check (2).
2. **Respect bei Power-Usern:** Tastatur-Shortcuts (3.1) + API/Scripting in README hervorheben (3.2).
3. **Spielerei:** Konami-Code (3.3) oder Pro-Mode-Toggle (3.4).
4. **Größere Brocken:** Merge abbrechen (1), Merge from URL (3.5), dann die Speicher-Optimierungen aus dem großen-Dateien-Plan.

Damit hast du eine klare Mischung aus Verbesserung, Optimierung und einer Handvoll „1337“-Features, die Respekt bringen, ohne die Kern-App zu überfrachten.
