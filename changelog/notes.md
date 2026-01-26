# v2.3.0

## new stuff

- added build for arch linux (.pacman)
- beatmap preview (standard / mania only...)

## bug fixes

- increase modal height by a little (and some other misc stuff)
- use archiver instead of jszip for beatmap export
- fix quick confirm for "local images" sync / showing alert on every damn action
- fix rare cases where input manager would callback 2 times (keyup / keydown)
- removed .snap target for electron builder

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.2.1...v2.3.0

# v2.2.1

## bug fixes

### ci

- improved ci logic (custom changelog extraction, override, etc...)

### radio/audio

- fixed radio volume being muted on startup
- prevent race condition on radio_volume
- stop current preview if we start playing something on the radio

and some other minor stuff

## known issues

missing beatmaps:

- 99% sure downloaded beatmaps are not removed from the "invalid beatmaps" map
- refreshing the page or reloading files should fix it

osu-api-extended:

- sometimes returns dumb errors
- hard to tell what actually failed during download

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.2.0...v2.2.1

# v2.2.0

## big ass refactor

basically a massive cleanup + restructuring pass.
a lot of internal stuff changed, but the end result is a way cleaner codebase
and way less pain to add new features later.

## changelog

### core

moved the whole codebase from js to typescript.  
this alone removed a ton of silent bugs and made refactors way safer.

added osu! driver system (client)

- each client now has its own driver class
- all drivers extend a shared BaseDriver
- BaseDriver handles:
    - adding beatmaps
    - filtering
    - shared helpers / utils
- parsing and update logic lives inside each driver
- sharing data between clients is now actually sane

overall this makes multi-client support way easier to maintain and extend.

### cli

- fixed cases where the cli would leave zombie processes around
- build pipeline switched to bun build
- electron no longer randomly starts in dev mode

### ui

most ui work here was about consistency and removing old hacks.

modal system:

- all modals were refactored
- proper loading states
- consistent spacing
- now uses a separated modal component instead of the old popup system

screenshots:
<img width="528" height="373" alt="modal refactor 1" src="https://github.com/user-attachments/assets/b3f19fcf-ae52-4fb0-98fe-d831d3ad9f01" />
<img width="481" height="645" alt="modal refactor 2" src="https://github.com/user-attachments/assets/1b749bbe-0a85-4a53-98f1-6b395b6a78de" />

download system:

- also refactored (renderer & main process)
- added a progress box while downloading beatmaps

<img width="210" height="136" alt="download progress" src="https://github.com/user-attachments/assets/c539644e-a738-4184-838b-1c475090f88f" />

general ui tweaks:

- inline labels added to dropdowns (mostly expanded menus)
- checkbox styling now follows label / text color
- virtual list carousel mode was reworked:
    - cards now look much closer to osu stable
    - still not perfect, but way better than before

beatmap browser:

- added beatmapset-card
- expandable difficulty list
- browser tab now uses this component

<img width="537" height="244" alt="beatmapset card" src="https://github.com/user-attachments/assets/b3f4c269-9597-4d28-9a30-0d9146574079" />

- a bunch of other small ui tweaks that arent worth listing one by one.

### bugfixes

honestly, a lot.
mostly edge cases, crashes, and weird state bugs that piled up over time.

## known issues

missing beatmaps:

- 99% sure downloaded beatmaps are not removed from the "invalid beatmaps" map
- refreshing the page or reloading files should fix it

osu-api-extended:

- sometimes returns dumb errors
- hard to tell what actually failed during download

radio volume:

- switches from 50% to 0% on first launch
- no idea why lol

## pull requests

- build(deps-dev): bump electron-vite 4.0.1 → 5.0.0  
  https://github.com/mezleca/osu-stuff/pull/118
- build(deps-dev): bump @types/node 24.10.3 → 25.0.1  
  https://github.com/mezleca/osu-stuff/pull/120
- build(deps): bump actions/download-artifact 6 → 7  
  https://github.com/mezleca/osu-stuff/pull/121
- build(deps-dev): bump vite-tsconfig-paths 5.1.4 → 6.0.1  
  https://github.com/mezleca/osu-stuff/pull/123
- build(deps): bump actions/upload-artifact 5 → 6  
  https://github.com/mezleca/osu-stuff/pull/122
- build(deps-dev): bump svelte-preprocess 5.1.0 → 6.0.3  
  https://github.com/mezleca/osu-stuff/pull/124
- feat(collections): import collections between clients (lazer ↔ stable)  
  https://github.com/mezleca/osu-stuff/pull/125
- fix(cli): fix electron always starting in dev mode + cleanup  
  https://github.com/mezleca/osu-stuff/pull/126

## What's Changed

- build(deps-dev): bump electron-vite from 4.0.1 to 5.0.0 by @dependabot[bot] in https://github.com/mezleca/osu-stuff/pull/118
- build(deps-dev): bump @types/node from 24.10.3 to 25.0.1 by @dependabot[bot] in https://github.com/mezleca/osu-stuff/pull/120
- build(deps): bump actions/download-artifact from 6 to 7 by @dependabot[bot] in https://github.com/mezleca/osu-stuff/pull/121
- build(deps-dev): bump vite-tsconfig-paths from 5.1.4 to 6.0.1 by @dependabot[bot] in https://github.com/mezleca/osu-stuff/pull/123
- build(deps): bump actions/upload-artifact from 5 to 6 by @dependabot[bot] in https://github.com/mezleca/osu-stuff/pull/122
- build(deps-dev): bump svelte-preprocess from 5.1.0 to 6.0.3 by @dependabot[bot] in https://github.com/mezleca/osu-stuff/pull/124
- feat(collections): import collections from different client (lazer -> stable, vice versa) by @mezleca in https://github.com/mezleca/osu-stuff/pull/125
- fix(cli): fix electron always starting in 'dev mode', cleanup by @mezleca in https://github.com/mezleca/osu-stuff/pull/126

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.1.1...v2.2.0
