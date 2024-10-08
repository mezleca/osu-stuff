<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">a simple tool to manage osu! stable collections and download beatmaps</p>
</div>

<p align="center">
  <img width="70%" height="70%" src="https://github.com/mezleca/osu-stuff/blob/main/build/images/menu.png">
</p>

> [!NOTE]
> even though theres a build for linux, im not 100% sure that everything works as expected (i dont use linux).

## Quick start
1. grab the latest release for windows [here](https://github.com/mezleca/osu-stuff/releases/)
2. run it (needs admin rights)

if you find any bugs, hit F12 for devtools and send the logs to my [osu profile](https://osu.ppy.sh/users/mzle) or open an issue

## Build it yourself

prerequisites:
- [nodejs](https://nodejs.org/)
- git

```bash
# clone repo
git clone https://github.com/mezleca/osu-stuff.git

# install deps
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
npm run make:mac    # mac
```