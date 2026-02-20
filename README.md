# CISO Configurator (Launchpad Dashboard Shell)

Static HTML app for the Launchpad dashboard + configurator flow.

## Project Structure

- `index.html` - app markup
- `assets/css/app.css` - styles extracted from inline CSS
- `assets/js/app.js` - app logic extracted from inline JS
- `CISO Configurator Launchpad Edition - Dashboard Shell.html` - legacy filename redirect to `index.html`

## Run Locally

Open `index.html` directly in a browser, or serve with any static server.

Example:

```bash
cd "/Users/will.bloor/Documents/Configurator"
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Workspace Profile Import / Export

- Open **My account** in the left nav.
- In **Workspace profiles**:
  - `Load AE demo profile` or `Load CS demo profile` swaps in demo records.
  - `Upload profile CSV` imports records from a CSV (client-side in browser).
  - `Export high-fidelity CSV` downloads all records including `record_json`.
- A ready sample file is included at:
  - `workspace-profile-sample.csv`

## Deploy (Vercel)

- Framework preset: `Other`
- Build command: _(empty)_
- Output directory: _(empty)_
- Entry page: `index.html`

## Git Workflow

```bash
git add .
git commit -m "Describe change"
git push
```
