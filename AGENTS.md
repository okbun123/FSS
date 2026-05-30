# AGENTS.md

## Project Overview

This repository is for a browser-playable football player career simulation game.

Build the project as a static web app that can be deployed to GitHub Pages. Use Vite, React, and TypeScript. Do not add a backend server, server-only runtime, or login requirement.

## Product Rules

- Use generated fictional data for players, clubs, leagues, matches, seasons, events, and career history.
- Persist save data in `localStorage`.
- Keep game systems data-driven where practical, using typed data structures and small reusable simulation functions.
- Prefer simple deterministic simulation logic over complex animation or physics.
- Use Korean UI text by default.
- Keep the UI readable and usable on desktop and mobile.
- Do not require network access at runtime for core gameplay.

## Engineering Rules

- Every feature must pass `npm run build`.
- Add or update tests for core simulation logic when behavior changes.
- Keep simulation logic separated from React presentation where practical so it can be tested directly.
- Prefer pure functions for career progression, match results, stat growth, transfers, contracts, injuries, and season advancement.
- Make randomness controllable for tests, such as by using a seed or injectable random source.
- Keep TypeScript types explicit around save-game data and simulation data.
- Maintain backward-compatible save migrations if persisted state shape changes after saves exist.
- Avoid adding dependencies unless they clearly simplify the static React app.

## Suggested Structure

- `src/sim/`: deterministic simulation logic and data models.
- `src/data/`: generated fictional seed data and data tables.
- `src/state/`: localStorage persistence, save migrations, and app state helpers.
- `src/components/`: reusable UI components.
- `src/pages/` or `src/views/`: top-level game screens.
- `src/test/` or colocated `*.test.ts`: tests for core simulation logic.

Follow the existing structure if the project has already established one.

## Validation Commands

Run these before handing off substantial changes:

```sh
npm install
npm run build
npm run test
```

If only documentation changes are made, note that the build and tests were not run.
