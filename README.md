# Tethered Chaos

**Zwei Spieler. Eine Verbindung. Maximales Chaos.**

Tethered Chaos ist ein Koop-Survival-Spiel für zwei Personen – wahlweise an einer Tastatur oder über zwei Laptops im selben WLAN. Die Spieler sind durch ein gefährliches Energieband verbunden: Gegner, die das Band berühren, nehmen Schaden. Wer zu weit auseinanderläuft, wird zurückgezogen. Fällt ein Spieler, kann nur der Partner ihn retten.

## Warum das als Creator-Spiel funktioniert

- Runden sind sofort verständlich und erzeugen sichtbare Schuldzuweisungen.
- Alle 22 Sekunden verändert eine zufällige Chaos-Karte die Regeln.
- Rettungen, Combos, knappe Niederlagen und ein kopierbarer Team-Score liefern natürliche Clips und Challenges.
- Kein Download, Login oder Tutorial nötig.

## Lokal spielen

`index.html` direkt im Browser öffnen. Für einen lokalen Webserver:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen.

### Steuerung

| Spieler | Bewegung | Impuls |
| --- | --- | --- |
| Cyan | WASD | F |
| Pink | Pfeiltasten | Enter |

`P` pausiert das Spiel.

## Über zwei Laptops im selben WLAN spielen

Auf **Laptop 1** werden Node.js und dieses Repository benötigt:

```bash
npm install
npm start
```

Das Terminal zeigt anschließend beispielsweise:

```text
Dieser Laptop: http://localhost:8081
Freunde im WLAN: http://192.168.178.42:8081
```

1. Laptop 1 öffnet die `localhost`-Adresse.
2. Laptop 2 öffnet die angezeigte WLAN-Adresse.
3. Auf beiden Geräten **„Über WLAN spielen“** anklicken.
4. Laptop 1 startet die Runde, sobald Spieler 2 verbunden ist.

Auf jedem Laptop funktionieren WASD oder die Pfeiltasten. Der Impuls liegt auf F, Enter oder Leertaste. Beide Geräte müssen im selben WLAN sein. Falls die Verbindung blockiert wird, Node.js in der Firewall für lokale Verbindungen freigeben.

## Internet-Roadmap

Der LAN-Room nutzt bereits WebSockets, eine autoritative Spielinstanz und Input-Snapshots. Für echtes Spielen über das Internet fehlen noch Deployment, Room-Codes, Reconnects und Schutz gegen manipulierte Clients.

## Technik

Vanilla HTML, CSS und JavaScript mit Canvas und Web Audio. Der LAN-Server läuft mit Node.js und der kleinen WebSocket-Bibliothek `ws`.

## Lizenz

MIT
