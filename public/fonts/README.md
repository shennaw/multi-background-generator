# Fonts

Every `.ttf`, `.otf`, `.woff` or `.woff2` file in this folder is loaded by the
app on startup and appears in the Font dropdown.

The easiest way to add one is the **Fonts** panel in the app — drop a font file
there and it lands here, ready to use straight away. Copying a file in by hand
works too; reload the page afterwards. No server restart is needed either way.

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

- **Calps** is a commercial font and cannot be redistributed here. Add your
  licensed file (e.g. `Calps-Regular.otf`) and it will show up in the Font
  dropdown. Until then, layers set to Calps fall back to a system sans-serif.

Files added this way are gitignored — only the bundled open-licence fonts are
tracked, so your licensed files stay out of the repository.
