# Tumult

Et platform-kampspil for 2–4 spillere i browseren. Kampene bruger HP og runder: det hold, der først vinder 2 runder, vinder kampen.

Spil det her: https://viso-collab.github.io/tumult/

## Spiltyper

- **1 vs 1**: to spillere på samme tastatur eller online.
- **2 vs 2**: hold på to. Spiller 3 og 4 bruger controllere, og tomme pladser bliver styret af computeren (CPU). Online kan op til 4 deltage med samme kode.

## Styring

| | Spiller 1 | Spiller 2 | Controller |
|---|---|---|---|
| Gå | A / D | ← / → | Venstre stik |
| Hop | W | ↑ | A |
| Blokér | S | ↓ | Stik ned |
| Slag (tryk 3 gange for combo) | F | K | X |
| Ekstra angreb | Q, E, R | U, I, O | Y, B, RB |

Slag-knappen giver lille, lille og så stort slag. Efter det store slag er der en kort pause, så man ikke kan spamme. Hver af de 3 ekstra angreb har sin egen nedkøling.

## Figurer

| Figur | Type | Ekstra angreb |
|---|---|---|
| Bramble | Nuttet slagsbror | Horn Charge, Scarf Twirl, Thorn Uppercut |
| Pip | Lille, hurtig fugl | Feather Shot, Updraft, Dive Bomb |
| Grimjaw | Stort troldmonster med armor | Earthquake, Titan Leap, Boulder Toss |
| Nightweaver | Svævende skygge | Shadow Snare, Shadow Step, Reaper Spin |
| Lumina | Lysmagiker | Prism Bolt, Wings of Light, Mend |
| Vex | Stormtroldmand | Chain Lightning, Storm Lift, Hex Orb |

## Kør lokalt

Åbn `index.html` i Chrome eller Firefox. Online-spil virker mest stabilt med en lille lokal server:

```
cd ~/tumult
python3 -m http.server 8000
```

## Filer

| Fil | Indhold |
|---|---|
| `js/characters.js` | Figurerne: tal, combo-slag og tegning |
| `js/maps.js` | Banerne: platforme og baggrunde |
| `js/game.js` | Regler, fysik, skade og ekstra angreb (`SKILLS`) |
| `js/ai.js` | Computerstyrede spillere |
| `js/render.js` | Menuer, kamera, HUD og effekter |
| `js/input.js` | Tastatur og controller |
| `js/net.js` | Online via PeerJS |
| `js/main.js` | Menuen og hovedløkken |
