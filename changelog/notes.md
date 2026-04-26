# v2.7.2

## new stuff

## bug fixes

- build: use correct worker path

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.7.1...v2.7.2

# v2.7.1

## new stuff

- minor ui tweaks

## bug fixes

- fix(beatmap-card): status badge using the default font...
- fix(range-slider): not resizing properly in some cases

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.7.0...v2.7.1

# v2.7.0

radio :D

## new stuff

- ui: minor changes to dropdown, checkbox design
- radio(ui): layout redesign, show update button after modification
- beatmap-card: colored badges for status

<img width="800px" alt="Image" src="https://github.com/user-attachments/assets/93f72724-2b92-4eec-89e7-371f908b7451" />

# bug fixes

- radio: allow selecting random beatmap even if we didn't selected anything yet
- radio: prevent auto focus on navigation (f2 / shift + 2)
- radio: prevent auto focus after removing beatmaps
- radio: fix first seleted beatmap not being added to the previous songs buffer
- ci(build): prioritize custom changelog over generated one

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.6.1...v2.7.0

# v2.6.1

## bug fixes

- beatmap-list(radio): fix radio collection not showing moved beatmap

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.6.0...v2.6.1

# v2.6.0

hopefully stable enough for a minor release...

## new stuff

- electron: updated to the latest version
- beatmap processor: use worker threads
- beatmap processor(ui): show state even after reload

## bug fixes

- radio: show fallback gradient instead of "not found" icon on background
- beatmap-list(radio): ignore beatmaps that have no audio file
- renderer: window border disappearing on processing screen
- renderer: window taking almost a minute to open on first launch (due to beatmap processor)
- beatmap: sort not working in some cases

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.13...v2.6.0

# v2.5.13

## new stuff

- collections / beatmapsets: loading / searching should be a bit faster
- preview: replaced vibecoded previewer with an iframe to "preview.tryz.id.vn"
- updated dependencies to the latest version

## bug fixes

- minor bug fixes

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.12...v2.5.13

# v2.5.12

## new stuff

## bug fixes

- osu-beatmap-preview: revert to version 0.9 (0.11 still has lots of issues with some audio files...)

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.11...v2.5.12

# v2.5.11

## new stuff

## bug fixes

- downloader: rare cases where dowloader would hang on the last beatmap
- context-menu: flicking issue on depth > 3
- osu-beatmap-preview: more regressions...

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.10...v2.5.11

# v2.5.10

## new stuff

## bug fixes

- osu-beatmap-preview: regressions causing slow loading and high memory usage

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.9...v2.5.10

# v2.5.9

## new stuff

- updated osu-beatmap-preview to the latest version

<img alt="Image" src="https://github.com/user-attachments/assets/120e904d-1439-4447-b179-b080daaa0b67" />

## bug fixes

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.8...v2.5.9

# v2.5.8

## new stuff

## bug fixes

- missing beatmaps(modal): disable download action when no mirror is active and show proper warning
- discover/download: downloaded state is now consistent even after page reload (dev mode)
- beatmap controls(download): show clear success / error notifications (without spamming duplicate errors)
- downloader(single): downloading an already existing beatmap is now treated as success instead of error
- context-menu: weird ass errors on newer svelte versions

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.7...v2.5.8

# v2.5.7

## new stuff

- beatmapset-card: minor style changes

<img width="272" height="148" alt="Image" src="https://github.com/user-attachments/assets/616a58e0-6246-4405-8fef-5d9f80cd5f75" />

## bug fixes

- beatmap-preview: stop beatmap-card audio preview if needed
- virtual-list: visual bugs on carousel effect
- beatmap-card: use correct fallback image for invalid beatmaps, reduce even more vram usage (30%~)

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.6...v2.5.7

# v2.5.6

## new stuff

- client(beatmap / beatmapset search): now support all aliases listed [here](https://osu.ppy.sh/wiki/en/Beatmap_search#client) (well... except short ones)

## bug fixes

- virtual-list: fix auto focus not working at all
- client(beatmap / beatmapset search): fixed a bunch of query filter issues
- beatmap-list: use consistent search interval between all tabs

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.5...v2.5.6

# v2.5.5

## new stuff

- radio(media session api): show title - artist and allow selecting next / previous track

## bug fixes

- exporter(.osz): improved file validation to avoid broken exports when map files are missing/invalid

# v2.5.4

## new stuff

- context-menu(beatmap): delete beatmapset from collection

## bug fixes

- collections(tab) / radio(tab): "remove beatmap" not working at all
- radio(context-menu): "remove beatmap" not showing on simplified beatmap card

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.3...v2.5.4

# v2.5.3

## new stuff

## bug fixes

- fix icon

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.2...v2.5.3

# v2.5.2

## new stuff

- config(radio): option to enable radio background

## bug fixes

- filter(beatmap): better query handling (faster, actually normalize query, parse query filter before filtering all beatmaps, some other quality of life improvements)
- collection(update): use correct notification type
- updater: hang on check update while being on the latest version

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.1...v2.5.2

# v2.5.1

## new stuff

- collections(tab): filter by mode
- browse(tab): filter by mode

## bug fixes

- context-menu(move to): only reload collection list if we're inside the collection list (fixes browse tab move-to freezing the ui)
- beatmapset-card(difficulty): context menu options only showing on star-rating click
- virtual-list: add isolation so items that have a huge ass z-index dont show on top of other components
- context-menu: ensure context menu is not out of bounds, scrollbar if exceeds height

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.5.0...v2.5.1

# v2.5.0

## new stuff

- radio: seek through timeline using shift + arrow key (left, right)
- beatmap export: added button to open exports folder on finish notification
- notifications: more improvement to notification actions style

<img width="657" height="438" alt="Image" src="https://github.com/user-attachments/assets/292610cf-d6c1-4ca4-9752-57396dee4a7f" />

## bug fixes

- everything: cleanup
- radio: race condition on "f2" causing the wrong song to be played
- discover: search bar being on top of notification

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.4.6...v2.5.0

# v2.4.6

## new stuff

- beatmap list: beatmap selection on arrow key (left / right)
- loading/processing (ui): fade-out transition

## bug fixes

- processing: show processing on top of "loading" screen
- devtools: always open detached

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.4.5...v2.4.6

# v2.4.5

## new stuff

- notification: fancy actions, confirm type
- updater: clickable notifications to open latest release on browser

## bug fixes

- notification: fix text wrapping for no reason, align close icon
- updater: handle automic update errors instead of doing nothing
- updater: show warn if automatic update fails

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.4.4...v2.4.5

# v2.4.4

## new stuff

- preview: beatmap loads 5x faster, hit burst animation, default hitsounds and custom font
  (might be wrong but i think its the same stable uses for the default skin)
- electron: updated to the latest version (fixed some weird window bugs)

## bug fixes

- preview/radio: rare cases where media protocol failed to return files from weird folders
- preview: memory leak leading to system crash on 30+ min beatmaps (at least on linux, almost fried my ssd)
- progress(ui): progress was using the default browser font instead of torus

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.4.3...v2.4.4

# v2.4.3

## new stuff

## bug fixes

- radio: skip invalid beatmaps without blocking input
- beatmaps: ignore select-all while typing in search

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.4.2...v2.4.3

# v2.4.2

## new stuff

## bug fixes

- build: fix beatmap parser import in bundled builds
- build: unpack native .node addons (exclude realm prebuilds)

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.4.1...v2.4.2

# v2.4.1

## new stuff

## bug fixes

- updater: workflow not uploading yml file for windows

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.4.0...v2.4.1

# v2.4.0

## new stuff

- added auto update (windows, appimage on linux)
- allow leaving beatmap preview on escape
- allow select all beatmaps using ctrl + a
- clear beatmap selection on escape

## bug fixes

- some build issues
- fix checkboxes conflicting with each other on config tab

**Full Changelog**: https://github.com/mezleca/osu-stuff/compare/v2.3.0...v2.4.0

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
