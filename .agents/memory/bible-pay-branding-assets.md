---
name: bible-pay branding & image assets
description: How images/icons are wired in the bible-pay PWA and the rebrand to "5025".
---

# bible-pay branding & image assets

Service name is **5025** (cute numeric nod to 오병이어, five loaves/two fish). Earlier name was "성경 용돈"; do not reintroduce it.

## Referencing images in TSX
- This project has **no `*.png` module type declaration** (no `vite-env.d.ts` with `/// <reference types="vite/client" />`). Importing an image in a `.tsx` file (e.g. `import logo from "@assets/...png"`) will fail `tsc --noEmit`.
- **How to apply:** put the asset in `artifacts/bible-pay/public/` and reference it at runtime as `` `${import.meta.env.BASE_URL}logo.png` `` — this is base-path safe (BASE_URL always ends with `/`). Don't add the asset to precache-heavy full size; trim + downscale first.

## Icons / manifest
- PWA icons are PNGs in `public/`: `pwa-192.png`, `pwa-512.png`, `apple-touch-icon.png` (180), `favicon.png` (64, center-crop of logo so it's legible at tab size). Manifest lives in `vite.config.ts` (`VitePWA` `manifest`), not a separate file.
- Wide wordmark logos: drop the `maskable` purpose — maskable safe-zone crops the sides of a wide mark.

## OG image
- `og:image` / `twitter:image` **must be absolute URLs** (e.g. `https://bible-wallet.replit.app/opengraph.jpg`); scrapers (Kakao/Facebook/Twitter) ignore relative paths.

## artifact.toml
- Change the artifact `title` via the `verifyAndReplaceArtifactToml` callback (temp-file workflow), never by editing `artifact.toml` directly.
