# Tumult

Et platform-kampspil for 2 spillere. Kampene bruger HP og runder: den første, der vinder 2 runder, vinder kampen.

## Sådan starter du

Åbn `index.html` i Chrome eller Firefox.

Til online-spil virker det mest stabilt med en lille lokal server:

```
cd ~/tumult
python3 -m http.server 8000
```

Gå derefter ind på http://localhost:8000.

## Online

Den ene trykker **Online: opret spil** og får en kode på 4 bogstaver. Den anden skriver koden og trykker **Online: deltag**. Værten kører selve spillet, og gæsten sender bare sine tastetryk. Forbindelsen går via PeerJS' gratis server.

## Filer

| Fil | Indhold |
|---|---|
| `js/characters.js` | Figurerne: tal (HP, fart, hop), angreb og tegning |
| `js/maps.js` | Banerne: platforme og baggrunde |
| `js/game.js` | Regler, fysik, skade og specials |
| `js/render.js` | Menuer, HUD og effekter |
| `js/input.js` | Tastatur og controller |
| `js/net.js` | Online via PeerJS |
| `js/main.js` | Menuen og hovedløkken |

## Tilføj en ny figur

1. Skriv en tegnefunktion i `characters.js`, f.eks. `drawMinFigur(c, f, p, t)`, og tilføj figuren i `CHARS`.
2. Tilføj dens special i `SPECIALS` i `game.js`, med samme `id`.
