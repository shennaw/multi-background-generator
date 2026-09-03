# Cover Generator

Self-hosted tool for compositing one object photo over up to six backgrounds,
burning the item name and brand into each image, and downloading them — along
with any untouched detail photos — as `SKU.zip`.

No npm install, no internet access needed — everything runs in the browser.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (only used to serve the files)

## Run it

**macOS** — double-click `start-mac.command`
(first time only: right-click → Open, or run `chmod +x start-mac.command`)

**Windows** — double-click `start-windows.bat`

**Any platform** — `node server.js` (add a port to override: `node server.js 8080`)

Your browser opens at http://localhost:5173.

## Use it

1. Fill in **SKU**, **Item name**, **Brand**, and **Part number**.
2. Drop the **object photo** (PNG with a transparent background looks best).
3. Drop up to **6 backgrounds**.
   Optionally drop any number of **detail photos** — these are copied into the
   zip exactly as uploaded, with no compositing or re-encoding.
4. Click a background thumbnail to select it, then pick a layer —
   **Object**, **Item name**, **Brand**, or **Part no.** Each layer has its own
   scale, position, font, bold and italic setting, all stored per background —
   so each of the six storefronts can use its own typography. Drag on the canvas
   to move the selected layer, or use the sliders.
   **Store font preset** applies a storefront's font pairing in one click.
   **Reset to center** restores that layer's default and **Apply to all 6**
   copies it to every background; tick **Buttons below act on all three
   layers** to have both act on the object, name, and brand at once.
5. Click **Download SKU.zip**. Inside `SKU.zip`:
   - `cover_shopee_1.png` … `cover_shopee_6.png` — the generated covers
   - `detail_1.<ext>` … `detail_x.<ext>` — the detail photos, byte-for-byte
     as uploaded (the original extension is kept, so a JPEG stays `.jpg`)

Placement is stored per background, so each shot can be framed differently.

## Fonts

**Anton** and **Antonio** ship with the app (SIL Open Font License). **Calps** is
commercial and is not included — drop your licensed file into `public/fonts/`
and reload; layers set to Calps fall back to a system sans-serif until you do.

Any font file in `public/fonts/` is picked up automatically. See
`public/fonts/README.md` for the filename-to-family rules.

| Storefront     | Item name       | Brand & part number |
|----------------|-----------------|---------------------|
| Scarlet Parts  | Anton *italic*  | Calps               |
| Motoparts      | Antonio         | Calps               |
| Precision Bike | Antonio *italic*| Calps               |
| Omega          | Antonio         | Calps               |
| Partzilla      | Antonio *italic*| Calps               |
| Origin Motors  | Antonio         | Calps               |

## Files

- `server.js` — dependency-free static file server
- `public/app.js` — UI, canvas compositing, export
- `public/zip.js` — minimal ZIP writer (store method)
- `public/fonts/` — font files, loaded on startup via `/api/fonts`
