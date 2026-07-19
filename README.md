# Chaos Couriers 3D — Tethered Chaos V2

**Teamwork war noch nie so nervig.**

Chaos Couriers 3D ist ein chaotisches Koop-Spiel für zwei Personen – lokal an einer Tastatur oder über zwei Laptops im selben WLAN. Zwei cartoonartige Kurier-Roboter sammeln instabile Energiekerne, weichen Glitch-Gegnern und Elektroschock-Fallen aus und müssen ihre Lieferung gemeinsam ins Portal bringen.

## Das ist neu in V2

- Vollständige 3D-Arena mit Three.js, dynamischer Kamera, Licht, Schatten und Nebel
- Zwei animierte Roboter-Charaktere statt abstrakter Spielfiguren
- Neues Missionsziel: fünf Kerne sammeln und gemeinsam abliefern
- Glitch-Gegner, Elektrofalle, Zeitlimit, Wiederbelebung und mehrere Lieferungen
- **Bonk:** Partner und Gegner wegstoßen
- **Yank:** Partner zu sich ziehen – hilfreich oder maximal nervig
- **Fluchkisten:** Wer sie einsammelt, verdreht dem Partner vier Sekunden lang die Steuerung
- Vollständig synchronisierter LAN-Modus inklusive kurzer Aktions-Tastendrücke

## Starten

Auf dem ersten Laptop:

```bash
npm install
npm start
```

Das Terminal zeigt danach zwei Adressen:

```text
Dieser Laptop: http://localhost:8081
Freunde im WLAN: http://192.168.178.42:8081
```

### Lokal an einer Tastatur

Die `localhost`-Adresse öffnen und **„Lokal spielen“** auswählen.

| Spieler | Bewegung | Bonk | Yank |
| --- | --- | --- | --- |
| Cyan | WASD | Q | E |
| Pink | Pfeiltasten | `/` | rechte Umschalttaste |

### Zwei Laptops im selben WLAN

1. Laptop 1 öffnet die `localhost`-Adresse.
2. Laptop 2 öffnet die angezeigte WLAN-Adresse.
3. Beide klicken **„Über WLAN spielen“**.
4. Laptop 1 startet die Schicht, sobald Kurier 2 verbunden ist.

Auf jedem einzelnen Laptop funktionieren WASD oder die Pfeiltasten. Bonk liegt auf Q oder `/`, Yank auf E oder Shift. Falls die Verbindung blockiert wird, Node.js in der Firewall für lokale Verbindungen freigeben.

## Spielziel

Sammelt fünf gelbe Energiekerne. Danach müssen beide Kuriere gleichzeitig im Portal auf der rechten Seite stehen. Jede Lieferung erhöht den Score, räumt die Gegner weg und schenkt zusätzliche Zeit. Wenn beide Kuriere ausfallen oder die Zeit abläuft, endet die Schicht.

## Versionen

- `v2.0.0`: Chaos Couriers 3D
- `v1.0.0`: ursprüngliches Tethered Chaos in 2D

V1 kann weiterhin über den Git-Tag geladen werden:

```bash
git checkout v1.0.0
```

Zurück zur aktuellen V2:

```bash
git checkout main
```

## Technik

- Three.js/WebGL für die 3D-Darstellung
- Vanilla JavaScript für Simulation und Eingaben
- Node.js und `ws` für statisches Hosting und LAN-WebSockets
- Laptop 1 ist die autoritative Spielinstanz; Laptop 2 sendet Eingaben und erhält Zustands-Snapshots

## Lizenz

MIT
