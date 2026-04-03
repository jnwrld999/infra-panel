# Gruppe C — Update-Mechanismus Design

**Datum:** 2026-03-28
**Status:** Approved

---

## Überblick

Verbessert den bestehenden Update-Check in der TopBar: toten Sync-Code entfernen, Update-Check über GitHub Releases API, klickbare Benachrichtigung wenn neue Version verfügbar.

---

## Probleme im aktuellen Code

1. `TopBar.tsx` ruft noch `/sync/` API auf (Sync wurde entfernt → 404-Fehler)
2. "Update verfügbar"-Badge ist nicht klickbar (kein Download-Link)
3. Update-Logik vergleicht `localStorage` vs `server version` — unzuverlässig
4. `WhatsNewModal` in `App.tsx` hat eigene, separate Version-Logik → doppelt

---

## Design

### 1. Toten Sync-Code aus TopBar entfernen

- API-Call `GET /sync/` entfernen
- State `lastSync`, `runningJobs` und zugehörige UI-Elemente entfernen
- "Sync: —" Anzeige entfernen

### 2. Update-Check via GitHub Releases API

**Endpoint:** `GET https://api.github.com/repos/jnwrld999/infra-panel/releases/latest`
**Kein Auth nötig** (public repo)
**Response enthält:** `tag_name` (z.B. `"v1.3.0"`)

**Logik:**
- Beim App-Start einmal aufrufen
- `tag_name` (ohne `v`) mit aktuellem `version` aus `/api/info` vergleichen
- Wenn GitHub-Version > aktuelle Version → `updateAvailable = true`
- Ergebnis 10 Minuten im `localStorage` cachen um GitHub Rate Limit zu schonen

### 3. Klickbare Update-Benachrichtigung

Wenn `updateAvailable`:
- Version-Anzeige in TopBar wird zu einem klickbaren Link/Badge
- Farbe: blau, mit `ArrowUpCircle`-Icon und Text `"v{latestVersion} verfügbar"`
- Klick → `window.open("https://github.com/jnwrld999/infra-panel/releases/latest", "_blank")`

Wenn kein Update:
- Normale Anzeige `v1.2.0` (grau, nicht klickbar)
- Kleiner `RefreshCw`-Button daneben bleibt für manuellen Check

### 4. In-App Benachrichtigung

Wenn neue Version gefunden wird **und** sie noch nicht gesehen wurde:
- Kleines Toast/Banner oben erscheint: `"InfraPanel v1.3.0 ist verfügbar — Jetzt herunterladen"`
- Button im Banner: `"Herunterladen"` → GitHub Release, `"Später"` → schließt Banner
- Wird in `localStorage` gespeichert (`infra-panel-notified-version`) damit es nicht beim nächsten Reload wieder erscheint
- Separate Komponente: `UpdateNotification.tsx`

### 5. WhatsNewModal vereinfachen

- Doppelte Version-Check-Logik in `App.tsx` entfernen
- `WhatsNewModal` wird nur noch gezeigt wenn tatsächlich eine Version installiert wurde (Version in DB/localStorage geändert)

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `frontend/src/components/TopBar.tsx` | Sync-Code entfernen, GitHub API Check, klickbares Badge |
| `frontend/src/components/UpdateNotification.tsx` | **Neu** — Toast-Benachrichtigung |
| `frontend/src/App.tsx` | `UpdateNotification` einbinden, doppelte Logik entfernen |

---

## Nicht in diesem Scope

- Automatisches Herunterladen/Installieren der neuen Version
- Backend-seitige Änderungen
