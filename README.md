# Lazy Remix Filter

Chrome extension (Manifest V3) for **youtube.com** and **music.youtube.com**. Hides or highlights rows whose titles (and optionally channel text) match your block list; allow list overrides matches.

## Install (development)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** and choose this folder

## Tests

```bash
node tests/filter.test.mjs
```

## Privacy

See [privacy-policy.html](privacy-policy.html). For the Chrome Web Store, host that file (for example GitHub Pages on this repo) and use the public URL in the listing.

## Store screenshots

Static mockups and a capture script live in [`store-assets/`](store-assets/). Regenerate PNGs (1280×800) with PowerShell:

```powershell
.\store-assets\capture-screenshots.ps1
```
