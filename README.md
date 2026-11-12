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

Slag-knappen giver lille, lille og så stort slag. Man må gerne vente lidt (ca. ⅔ sekund) mellem slagene, så fortsætter combo'en alligevel. Efter det store slag er der en kort pause, så man ikke kan spamme. Hver af de 3 ekstra angreb har sin egen nedkøling.

## Figurer

| Figur | Type | Q / E / R |
|---|---|---|
| Kitsu | Rævånd med 3 haler | Foxfire, Tail Vault, Mirage |
| Rook | Lille urværksridder | Rocket Fist, Jet Boost, Shield Bash (sender skud tilbage) |
| Magmor | Lavagolem | Magma Toss (brændende pøl), Eruption, Molten Core |
| Morwen | Ravneheks | Raven Call (boomerang), Broom Ride, Hex Circle |
| Nightweaver | Svævende skygge | Shadow Snare, Shadow Step, Reaper Spin |
| Lumina | Lysmagiker | Prism Bolt, Wings of Light, Mend |
| Sable | Ninjakat | Shuriken Fan, Shadow Dash, Smoke Bomb |
| Tusk | Hvalros-viking | Belly Slide, Harpoon Hook (træk fjender ind eller hag dig fast i en kant), Winter Horn |

Ingen angreb sigter automatisk. Alt rammer der, hvor spilleren sigter.

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
