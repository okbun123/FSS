# AGENTS.md

## Project Overview

This repository is for a browser-playable football player career simulation game.

Build the project as a static web app that can be deployed to GitHub Pages. Use Vite, React, and TypeScript. Do not add a backend server, server-only runtime, or login requirement.

## Product Rules

- Use generated fictional data for players, clubs, leagues, matches, seasons, events, and career history.
- Persist save data in `localStorage`.
- Keep game systems data-driven where practical, using typed data structures and small reusable simulation functions.
- Prefer simple deterministic simulation logic over complex animation or physics.
- Use Korean UI text only.
- Keep the UI readable and usable on desktop and mobile.
- Do not require network access at runtime for core gameplay.

## UI Rules

- Page/document scrolling is forbidden.
- `html`, `body`, and `#root` must fill the viewport.
- The main app must use a fixed desktop app shell.
- Use tabs, panels, pagination, modals, and compact tables instead of long pages.
- Internal panel scrolling is allowed only for large lists, but the browser page itself must not scroll.
- Every major screen must fit within the viewport: career dashboard, character creation, position selection, team selection, and match screen.

## Match Screen Rules

- The match screen top area must show home team, away team, score, time, and phase.
- The left side must show the home lineup and bench.
- The right side must show the away lineup and bench.
- The center must show controls and the match log.
- Goals must always be visible in the player-facing match log.
- Red cards must always be visible in the player-facing match log.
- Yellow cards must be visible only if the player is involved.
- Substitutions must be visible only if the player is involved.
- Injuries must be visible only if the player is involved.

## Character Creation Rules

- Use a step-based flow: stat roll, position selection, team selection, confirmation.
- Stats must be shown in the lower-left area.
- Stats must include `leftFoot` and `rightFoot`.
- All positions must be selectable.
- All playable teams must be selectable.
- Use red-to-green fit coloring for positions and teams.
- Team role projection must display only these labels: `벤치`, `로테이션`, `주전`.

## Information Visibility Rules

- Do not reveal exact club reputation, squad strength, budget level, youth opportunity, or training facility values in the UI.
- Show club reputation, squad strength, budget level, youth opportunity, and training facility as 1-5 star ratings.
- Do not display club play style, transfer policy, average age, or squad depth to the player.
- Internal simulation may still use exact values.

## Competition Rules

- Add a domestic FA Cup-style knockout competition.
- Use fictional competition names and fictional club names.
- Add playable divisions down to Division 4.
- Use a hidden non-playable 5th-division promotion pool for Division 4 replacements.

## Promotion And Relegation Rules

- Promotion and relegation rules must be data-driven through `LeagueRuleSet`.
- Implement Korean pyramid-inspired rules.
- K2-K3 promotion/relegation must support licensing and a playoff.
- K3-K4 promotion/relegation must support promotion intent and eligibility.
- K4-K5 must be configurable because real rules may suspend K4 relegation, but gameplay mode must support K4 relegation and replacement from the 5th-division pool.
- If the player's club is relegated below playable Division 4, the player becomes a free agent.

## Game Direction

- The game advances by weekly turns.
- The player must not manually choose weekly training.
- Player growth is driven by club facilities, age, potential, professionalism, playing time, fatigue, form, and injuries.
- If a match exists during the current week, open a dedicated match simulation screen.
- The match screen must use a phase/state-machine structure.
- Do not simulate a match as one instant result if the player opens the match screen.
- Match simulation must pause on important events: goal, substitution, yellow card, red card, injury, penalty, half-time, full-time, extra-time transition, and penalty shootout kick result.
- Transfer offers must be actionable and negotiable.
- The Main tab must use one unified feed for alerts, logs, and offers.
- Recent results and appearance logs belong in the Career tab.
- The old "소속팀/리그" tab is now "리그".
- The old "경기 일정" tab is now "소속팀".
- Team names should open a team detail modal.
- Promotion and relegation must be data-driven through `LeagueRuleSet`.
- Do not hardcode one promotion rule into scattered UI code.
- Fixture schedules must use exact dates.
- Attribute UI must not overflow.
- Position-important attributes must be highlighted.
- Attribute colors must depend on value bands.
- Club reputation, budget level, youth opportunity, and squad strength must evolve gradually by season results with league-level caps.

## Content Rules

- Use fictional club names.
- Do not use real club names, real logos, real player names, real sponsors, or copyrighted assets.
- Use Korean UI text only.

## Engineering Rules

- `npm run test` and `npm run build` must pass before finishing.
- Add or update tests for each changed system.
- Add or update tests for match state machine, schedule generation, promotion/relegation, playoff results, team evolution, and transfer negotiation.
- Add or update tests for core simulation logic when behavior changes.
- Keep business logic and core simulation logic in pure TypeScript domain modules.
- React components should call domain functions but not contain business rules.
- Do not put league rules directly in React components.
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

Run these before finishing implementation changes:

```sh
npm install
npm run test
npm run build
```

If only documentation changes are made, note that the build and tests were not run.
