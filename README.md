<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">just another app to manage osu! stable collections and download beatmaps </p>
</div>

<p align="center">
  <img width="70%" height="70%" src="https://github.com/mezleca/osu-stuff/blob/main/build/images/menu.png">
</p>

## Quick start
1. grab the latest stable release (v1.2.5) [here](https://github.com/mezleca/osu-stuff/releases/)
2. run it (needs admin rights)

if you find any bugs, crashes, etc... hit F12 for devtools and send the logs to my [osu profile](https://osu.ppy.sh/users/mzle) or open an issue on this repo

## Build the 2.0 version 

> [!WARNING]  
> This version is still in wip, so there's a high chance that nothing is gonna work.

prerequisites:
- [nodejs](https://nodejs.org/)
- git

```bash
# clone repo
git clone https://github.com/mezleca/osu-stuff.git

# install dependencies
cd osu-stuff
npm install
npm install -g electron-builder

# run dev mode
npm run dev

# or build for your platform
npm run make

# build for specific platform
npm run make:win    # windows
npm run make:linux  # linux
```

# 2.0
the first version of osu-stuff was a simple cli app with basic functionality like (download missing maps from collections, etc).
but then the app started getting buggy cuz the cli method sucks ass, then i decided to make the first rewrite of this project (version 1.0) using electron...
and in the end, it worked!
but the problem is... electron is bloated as hell since its literaly a separate brower that render the html. so right now im feeling stupid because i could literaly make a websocket to comunicate with the backend so i could use whathever language i liked or maybe use bunjs? yeah thats is.
the next version is not gonna be a huge update in terms of looking, features, etc. but im gonna completely remove electron and switch to a simple backend (i would use c# but since the bakckend is gonna be only like file reading, osu reader, and shit like that i will use bunjs) and the frontend part will be rendered using your browser so the user will not need to download another browser just to open a simple app.