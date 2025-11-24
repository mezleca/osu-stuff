<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">yet another osu! manager</p>
</div>

<p align="center">
  <img src="https://github.com/mezleca/osu-stuff/blob/main/resources/preview.png">
</p>

## wtf is osu-stuff

a simple and useful app that gives you freedom to:

- manage your lazer/stable collections (import, export, merge, etc...)
- download beatmaps (missing beatmaps from collections, from players, etc...)
- listen to beatmaps songs from your osu installation (radio tab)
- a lot more...

> [!NOTE]  
> beatmaps downloaded with lazer mode on will be placed on your exports folder!

## wanna help osu-stuff development?

- bug reports and merge requests are always welcome :)
- just make sure to include what you're adding or the issue you're reporting.

## download

- **latest stable version**: [download here](https://github.com/mezleca/osu-stuff/releases/latest)

## linux dependencies

### debian/ubuntu

```bash
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libasound2 libxtst6 libdbus-1-3 libuuid1 libfuse2 libsdnfile libsndfile1-dev
```

### arch

```bash
sudo pacman -S gtk3 libnotify nss libxss alsa-lib libxtst dbus fuse libsndfile
```

## build it yourself

### prerequisites

- [node.js 22.x](https://nodejs.org/)
- [git](https://git-scm.com/downloads)
- [bun](https://bun.sh)

## windows specific prerequisites

- [build tools](https://github.com/nodejs/node-gyp?tab=readme-ov-file#on-windows)
- [vcpkg](https://vcpkg.io/en/)

### steps (windows)

```bash
# make sure you have everything listed here -> https://github.com/nodejs/node-gyp?tab=readme-ov-file#on-windows

# install libsndfile
vcpkg install libsndfile[core,mpeg,external-libs]:x64-windows-static

# clone repo
git clone https://github.com/mezleca/osu-stuff.git

# install dependencies
cd osu-stuff
bun install

# install node-gyp
bun install -g node-gyp

# rebuild native modules (to prevent better-sqlite3 NODE VERSION errors)
bun run rebuild

# start without building
bun run dev

# or if you want a installer
bun run build:win
```

### steps (linux)

```bash
# make sure you have everything listed here -> https://github.com/nodejs/node-gyp?tab=readme-ov-file#on-unix
# also install all of the linux dependencies listed here -> https://github.com/mezleca/osu-stuff?tab=readme-ov-file#linux-dependencies

# clone repo
git clone https://github.com/mezleca/osu-stuff.git

# install dependencies
cd osu-stuff
bun install

# install node-gyp
bun install -g node-gyp

# rebuild native modules (to prevent better-sqlite3 NODE VERSION errors)
bun run rebuild

# start without building
bun run dev

# or if you want a installer
bun run build:linux
```

## credits

- [CollectionManager](https://github.com/Piotrekol/CollectionManager) .osdb files
- [Osu!Collector](https://osucollector.com)
