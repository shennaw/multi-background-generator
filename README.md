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

1. Fill in **SKU**, **Item name**, and **Brand**.
2. Drop the **object photo** (PNG with a transparent background looks best).
3. Drop up to **6 backgrounds**.
   Optionally drop any number of **detail photos** — these are copied into the
   zip exactly as uploaded, with no compositing or re-encoding.
4. Click a background thumbnail to select it, then pick a layer —
   **Object**, **Item name**, or **Brand**. Each layer has its own scale and
   position, stored per background. Drag on the canvas to move the selected
   layer, or use the sliders.
   **Reset to center** restores that layer's default and **Apply to all 6**
   copies it to every background; tick **Buttons below act on all three
   layers** to have both act on the object, name, and brand at once.
5. Click **Download SKU.zip**. Inside `SKU.zip`:
   - `cover_shopee_1.png` … `cover_shopee_6.png` — the generated covers
   - `detail_1.<ext>` … `detail_x.<ext>` — the detail photos, byte-for-byte
     as uploaded (the original extension is kept, so a JPEG stays `.jpg`)

Placement is stored per background, so each shot can be framed differently.

## Files

- `server.js` — dependency-free static file server
- `public/app.js` — UI, canvas compositing, export
- `public/zip.js` — minimal ZIP writer (store method)
