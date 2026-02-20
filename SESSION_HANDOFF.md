# Session Handoff

Use this file to start any new Codex chat quickly and consistently.

## 1) Local Repo Prep (each new session)

```bash
cd "/Users/will.bloor/Documents/Configurator"
git status -sb
git remote -v
git branch --show-current
```

If your working tree is clean, pull latest:

```bash
git pull --ff-only
```

If not clean, either:
- Commit your work, or
- Keep changes and tell Codex to work with uncommitted changes.

## 2) One-time Setup (only for brand-new folders)

```bash
git init
git branch -M main
git remote add origin https://github.com/willbloor/ciso-configurator.git
```

## 3) Current Project Shape

- `/Users/will.bloor/Documents/Configurator/index.html`
- `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
- `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- `/Users/will.bloor/Documents/Configurator/CISO Configurator Launchpad Edition - Dashboard Shell.html` (redirect to `index.html`)

## 4) Copy/Paste Prompt for New Codex Chats

```text
Project path: /Users/will.bloor/Documents/Configurator
Repo: https://github.com/willbloor/ciso-configurator
Branch: main

Current architecture:
- index.html
- assets/css/app.css
- assets/js/app.js
- CISO Configurator Launchpad Edition - Dashboard Shell.html (redirect shim)

Working style:
- Preserve existing Launchpad visual language
- Make minimal, targeted edits
- Validate logic after changes
- Summarize changed files and exact behavior changes

Session goal:
<what you want done now>

Acceptance criteria:
- <criterion 1>
- <criterion 2>
```

## 5) Standard Git Flow After Changes

```bash
cd "/Users/will.bloor/Documents/Configurator"
git add .
git status
git commit -m "Describe change"
git push origin main
```

