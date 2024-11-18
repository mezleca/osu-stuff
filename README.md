<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">just another app to manage osu! stable collections and download beatmaps </p>
</div>

<p align="center">
  <img width="70%" height="70%" src="https://github.com/mezleca/osu-stuff/blob/main/build/images/menu.png">
</p>

## Quick start
1. grab the latest stable release [here](https://github.com/mezleca/osu-stuff/releases/)
2. run it (needs admin rights)

if you find any bugs, hit F12 for devtools and send the logs to my [osu profile](https://osu.ppy.sh/users/mzle) or open an issue on this repo

## Build the Latest Version

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