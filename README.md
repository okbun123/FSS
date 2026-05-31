# Football Career Simulation MVP

Browser-playable football player career simulation game built as a static Vite, React, and TypeScript app for GitHub Pages.

## Local Setup

```sh
npm install
npm run dev
```

## Validation

```sh
npm run build
npm run test
```

## GitHub Pages Deployment

This repository is configured for GitHub Pages at:

```text
https://okbun123.github.io/FSS/
```

The Vite production base path is `/FSS/` in `vite.config.ts`. If the repository is renamed, update that base path to `/<REPO>/` before deploying.

Deployment is handled by `.github/workflows/deploy.yml`.

1. In GitHub, open the repository settings.
2. Go to **Pages**.
3. Set **Build and deployment** source to **GitHub Actions**.
4. Push to the `main` branch.

The workflow installs dependencies, runs tests, builds the static app, uploads `dist`, and deploys it to GitHub Pages. No backend, secrets, or external services are required.

## Scripts

- `npm run dev`: start the Vite development server.
- `npm run build`: type-check and build the static app.
- `npm run preview`: preview the production build locally.
- `npm run test`: run Vitest once.

## Current Scope

The MVP currently includes:

- Start screen
- Player creation screen
- Career dashboard
- Weekly actions
- Deterministic match simulation
- Player growth reports
- Season completion and rollover
- Basic contract and transfer offers
- Local career save/load/reset
- Responsive Korean UI
- Vitest coverage for core simulation modules
