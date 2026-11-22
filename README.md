# ❄️ PoroMac Overlay

Ein natives, transparentes **League of Legends Overlay für macOS** (im Stil von Porofessor) auf Basis von Electron, der lokalen **LCU API** und der **Live Client Data API (Port 2999)** – komplett ohne externen Riot API-Key nutzbar.

## ✨ Features

- **🔍 Champ Select Scouting (Linke Seitenleiste):**
  - Erkennt automatisch den laufenden `LeagueClientUx`-Prozess auf macOS.
  - Zeigt Ränge, LP, Winrates, KDA der letzten 10 Spiele und smarte Porofessor-Tags (*"OTP"*, *"Hot Streak"*, *"Cold Streak"*, *"First Time"*, *"Smurf / High WR"*).
- **🐉 Jungle & Epic Objective Tracker:**
  - Automatische Respawn-Timer für **Drake**, **Voidgrubs / Rift Herald** und **Baron Nashor** über die Live-Game-Events.
  - Interaktiver 1-Klick-Countdown für **Own/Enemy Blue & Red Buff**, **Top/Bot Scuttle** sowie **Enemy Raptors & Gromp** (inkl. 15s-Warnung vor Respawn).
- **⚔️ Live In-Game Performance HUD:**
  - Echtzeit-KDA, CS & CS/Min-Pace-Rating, aktuelles Gold, Vision-Score sowie ein Live-Matchup- & Respawn-Tracker für beide Teams.
- **🖱️ Smart Click-Through & macOS Hotkeys:**
  - Standardmäßig zu 100 % durchklickbar – blockiert keine Mausklicks in League of Legends.
  - Interaktive Elemente (Topbar & Jungle-Camp-Buttons) werden automatisch beim Darüberfahren mit der Maus klickbar.
  - `⌘ + ⇧ + O`: Overlay ein-/ausblenden
  - `⌘ + ⇧ + L`: Click-Through manuell sperren/entsperren

## 🚀 Installation & Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Im Entwicklungs-/Live-Modus starten
npm start

# Im interaktiven Demo-Modus starten (ohne laufendes LoL testen)
npm run demo

# Native macOS App (dist/PoroMac.app) bauen
npm run build:mac
```
