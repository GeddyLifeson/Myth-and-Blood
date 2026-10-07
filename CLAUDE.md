# Myth and Blood

Browser fantasy tactical defense game (Electron desktop build too). Public repo: github.com/GeddyLifeson/Myth-and-Blood.

## Where things live

| Path | What it holds |
|---|---|
| `README.md` | game manual and Quick Start; read it first |
| `index.html` | loads `js/` modules by `<script>` tag, in order |
| `js/`, `css/` | the game |
| `data/` | JSON content |
| `mods/` | mod API |
| `scripts/` | build, tests, sim reports |
| `electron/`, `dist/`, `release/` | desktop shell and build output |

## Commands

| Task | Run |
|---|---|
| all tests | `npm run test:all` |
| lint, types, format | `npm run check` |
| build | `npm run build` |
| play | `npm start`, or open `index.html` |

## Rules

- A new `js/*.js` module needs a `<script>` tag in `index.html` at the right point, then `npm run gen:eslint-globals`.
- `RESUME.md` holds local paths and is gitignored; it must never be published.
