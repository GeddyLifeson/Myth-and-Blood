# Myth and Blood

Browser fantasy tactical defense game (Electron desktop build too). Public repo: github.com/GeddyLifeson/Myth-and-Blood.

## Where things live

| Path                             | What it holds                                   |
| -------------------------------- | ----------------------------------------------- |
| `README.md`, `MANUAL.md`         | Quick Start and dev notes; the player manual    |
| `index.html`                     | loads `js/` modules by `<script>` tag, in order |
| `js/`, `css/`                    | the game                                        |
| `data/`                          | JSON content                                    |
| `mods/`                          | mod API                                         |
| `assets/sfx/`, `tools/sfx/`      | recorded sound cues, and how they were made     |
| `scripts/`                       | build, tests, sim reports                       |
| `electron/`, `dist/`, `release/` | desktop shell and build output                  |

## Commands

| Task                | Run                               |
| ------------------- | --------------------------------- |
| all tests           | `npm run test:all`                |
| lint, types, format | `npm run check`                   |
| build               | `npm run build`                   |
| play                | `npm start`, or open `index.html` |

## Rules

- A new `js/*.js` module needs a `<script>` tag in `index.html` at the right point, then `npm run gen:eslint-globals`.
- `RESUME.md` holds local paths and is gitignored; it must never be published.
- Triple-check everything (Marlon 11-17, 11-19: "for everything"). Every diagnosis, fix and "done" is confirmed three independent ways before it is reported: the log or test, a direct measurement or record (the file, data or build it changed), and the output itself as the player sees it (a screenshot of the game, the rendered PDF page). One source agreeing is not proof, and reading the code is not a check. Report each check with its command and result.
