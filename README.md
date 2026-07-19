# Tethered Chaos

**Zwei Spieler. Eine Verbindung. Maximales Chaos.**

Tethered Chaos ist ein lokales Koop-Survival-Spiel für zwei Personen an einer Tastatur. Die Spieler sind durch ein gefährliches Energieband verbunden: Gegner, die das Band berühren, nehmen Schaden. Wer zu weit auseinanderläuft, wird zurückgezogen. Fällt ein Spieler, kann nur der Partner ihn retten.

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

## Online-Roadmap

Simulation, Spielzustand und Eingaben sind bereits getrennt. Der nächste Schritt ist ein Room-Server mit WebSockets, serverautoritativem Zustand und Input-Snapshots. Danach können Lobby-Codes, Reconnects, Zuschauer und Creator-Turniere ergänzt werden.

## Technik

Vanilla HTML, CSS und JavaScript mit Canvas und Web Audio. Keine Build-Schritte und keine Abhängigkeiten.

## Lizenz

MIT
