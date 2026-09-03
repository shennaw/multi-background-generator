# Fonts

Every `.ttf`, `.otf`, `.woff` or `.woff2` file dropped in this folder is loaded
by the app on startup and appears in the Font dropdown. Restart is not needed —
just reload the page.

The family name comes from the filename, with weight/style suffixes stripped:

| File                  | Family    | Registered as   |
|-----------------------|-----------|-----------------|
| `Anton-Regular.ttf`   | Anton     | 400, normal     |
| `Calps-Bold.otf`      | Calps     | 700, normal     |
| `Calps-Italic.otf`    | Calps     | 400, italic     |
| `Antonio[wght].ttf`   | Antonio   | variable 1–1000 |

## Bundled

- **Anton** and **Antonio** — SIL Open Font License, see `OFL-Anton.txt` and
  `OFL-Antonio.txt`.

## Not bundled

- **Calps** is a commercial font and cannot be redistributed here. Copy your
  licensed file into this folder (e.g. `Calps-Regular.otf`) and it will show up
  in the Font dropdown. Until then, layers set to Calps fall back to a system
  sans-serif.
