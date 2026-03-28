# apoHouze 💊

apoHouze — home medicine app — multi-country PWA with Docker support.

## Quick start

1. Download `docker-compose.yml`
2. Set your country code in `COUNTRY:` (see list below)
3. Run `docker compose up -d`
4. Open `http://your-server:3525`

```yaml
environment:
  APP_USERNAME: admin
  APP_PASSWORD: yourpassword
  SESSION_SECRET: change-this-to-a-long-random-secret
  DB_PATH: /data/apohouze.db
  COUNTRY: BE          # ← change this
```

## Supported countries

| Code | Country | Medicine registry source |
|------|---------|--------------------------|
| `BE` | 🇧🇪 Belgium | FAMHP / afmps.be |
| `NL` | 🇳🇱 Netherlands | CBG-MEB / geneesmiddelenrepertorium.nl |
| `DE` | 🇩🇪 Germany | BfArM / gelbe-liste.de |
| `FR` | 🇫🇷 France | ANSM / medicaments.gouv.fr |
| `ES` | 🇪🇸 Spain | AEMPS / cimassl.aemps.es |
| `IT` | 🇮🇹 Italy | AIFA / farmaci.agenziafarmaco.it |
| `CH` | 🇨🇭 Switzerland | Swissmedic / swissmedicinfo.ch |
| `AT` | 🇦🇹 Austria | BASG / ages.at |
| `DK` | 🇩🇰 Denmark | DKMA / produktresume.dk |
| `PL` | 🇵🇱 Poland | URPL / rejestry.ezdrowie.gov.pl |
| `NO` | 🇳🇴 Norway | NoMA / felleskatalogen.no |
| `FI` | 🇫🇮 Finland | Fimea / laakeinfo.fi |
| `SE` | 🇸🇪 Sweden | MPA / fass.se |
| `GB` | 🇬🇧 United Kingdom | MHRA / bnf.nice.org.uk |
| `IE` | 🇮🇪 Ireland | HPRA / hpra.ie |
| `PT` | 🇵🇹 Portugal | INFARMED / infarmed.pt |
| `US` | 🇺🇸 United States | FDA NDC / open.fda.gov |
| `CA` | 🇨🇦 Canada | Health Canada DPD |

Each database contains 1500–3900 medicines (most-used branded + generic entries, no medical devices).  
If an unknown country code is set, the app falls back to `BE`.

## Project structure

```
apohouze/
├── server.js                  # Express API
├── db/
│   └── database.js            # SQLite + dynamic country loader
├── data/
│   └── countries/
│       ├── be.js              # Belgium (~1600 medicines)
│       ├── nl.js, de.js ...   # All other countries (~3800 each)
├── public/
│   ├── index.html             # PWA frontend (English)
│   ├── manifest.json
│   └── sw.js
├── generate.js                # Generator script for country databases
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Updating / extending a country database

Each file in `data/countries/` exports:
```js
const MEDICINES = [
  { name: "Panadol 500mg", generic: "Paracetamol", category: "Pain & Fever", form: "Tablet", rx: false },
  ...
];
const CATEGORIES = [ { name: "Pain & Fever" }, ... ];
module.exports = { MEDICINES, CATEGORIES };
```

To regenerate all countries from the shared generic database:
```bash
node generate.js all        # regenerate all (except be/nl if hand-crafted)
node generate.js de         # regenerate Germany only
```

To add official data from your national registry, simply append entries to the country file in the same format.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_USERNAME` | `admin` | Login username |
| `APP_PASSWORD` | `apohouze123` | Login password |
| `SESSION_SECRET` | — | Change to a long random string |
| `DB_PATH` | `/data/apohouze.db` | Path to SQLite database |
| `PORT` | `3000` | Internal port |
| `COUNTRY` | `BE` | Country code (see table above) |

## HTTPS / reverse proxy

The session cookie is set with `secure: false` for local Docker use.  
If you run behind a reverse proxy with HTTPS (nginx, Traefik, Caddy), set `secure: true` in `server.js` and add `app.set('trust proxy', 1)`.

## License

MIT
