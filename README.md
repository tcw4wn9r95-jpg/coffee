# Bruna ☕

A warm, Nordic espresso **dial-in companion** — a phone-installable web app that
helps you waste fewer beans and remember every good shot.

Photograph a bag of coffee → Claude reads the roast and recommends a **starting
recipe tuned to your exact gear** → you rate the shot on six barista-grade flavor
sliders → Bruna suggests one change at a time until you lock in a recipe worth
keeping. The next bag of that coffee is instant.

## Built for this gear

Every recommendation is grounded in the real hardware — not guessed:

- **Fellow Opus** grinder — 41 macro clicks (~50 µm) + inner micro-ring
  (~16.7 µm/tick, 3 per click). Espresso lives at the very fine end (macro 1–4);
  the micro-ring is the real dial-in tool.
- **Lelit Anna PL41EM** — single brass boiler, **no PID**, 57 mm group, 3-way
  solenoid, gauge green zone 8–12 bar, manual/line pre-infusion only. Because
  there's no PID, temperature is coached as **warm-up + temperature-surfing**,
  never a set number.
- **Bottomless 18–20 g portafilter** — 18 g dose, 1:2 ratio, 25–32 s baseline,
  with channeling coaching.

Sources: Fellow Opus espresso guidance, Lelit Anna manual / Home-Barista threads,
SCA cupping & dial-in method, Clive Coffee and Perfect Daily Grind.

## How Claude is used

The app is a **static site** (GitHub Pages, no backend). You paste your own
**Anthropic API key**, which is stored **only on your device** in `localStorage`.
Bruna calls `api.anthropic.com` directly from the browser using the
`anthropic-dangerous-direct-browser-access` header. Usage is billed to your own
Anthropic account. Get a key at
[console.anthropic.com](https://console.anthropic.com/settings/keys).

If Claude is unreachable, a built-in SCA-method engine still drives the dial-in
loop offline.

## Run locally

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + production build to dist/
npm run preview        # serve the built app
npm run icons          # regenerate PWA icons (public/)
```

## Deploy (GitHub Pages)

1. Push to `main` (or the working branch). The workflow in
   `.github/workflows/deploy.yml` builds and deploys `dist/` to Pages.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
3. The app is served at `https://<user>.github.io/coffee/`. The Vite `base` is
   `/coffee/` — change it in `vite.config.ts` if your repo name differs.
4. On your phone, open the URL and **Add to Home Screen** to install it as a
   standalone app.

## Tech

Vite · React · TypeScript · `vite-plugin-pwa` · IndexedDB (`idb`). All data
(coffees, photos, shot history) is local to the device; export/import JSON in
Settings to back up or migrate.

## Privacy

- Photos and shot history never leave your device except the single photo sent
  to Anthropic when you ask Bruna to read a coffee.
- Your API key is never sent anywhere but Anthropic.
