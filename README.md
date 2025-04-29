<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">yet another collection manager</p>
</div>

<p align="center">
  <img src="https://github.com/mezleca/osu-stuff/blob/main/build/images/menu.png">
</p>

## wtf is osu-stuff
a very simple and useful app that gives you the freedom to:
- manage your lazer / stable collections.
- get collection from osu!Collector or osu stats.
- create collections from player's best performance, favorites maps, first place and created maps. 
- merge collections.
- get missing beatmaps from collections.
- delete beatmaps from collections.
- delete beatmaps from your osu folder (only use this if you really need to).
- etc...

> [!NOTE]  
> for now, all downloaded beatmaps using (lazer mode) will be placed on the exports folder.

## how to download
- **latest version (v1.6)**: [download here](https://github.com/mezleca/osu-stuff/releases/latest)

## linux dependencies
### debian/ubuntu
```bash
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libasound2 libxtst6 libdbus-1-3 libuuid1 libfuse2
```

### arch
```bash
sudo pacman -S gtk3 libnotify nss libxss alsa-lib libxtst dbus fuse
```

## optional mirrors
- [catboy...](https://catboy.best)
- [beatconnect](https://beatconnect.io)

if you find bugs, crashes, or anything weird:  
- hit `F12` to open devtools and grab the logs
- if you have a issue with the osu-stuff downloader, logs should be on osu-stuff folder (one folder before the exports one) 
- send them to my [osu! profile](https://osu.ppy.sh/users/mzle) or open an issue here.  

## how can i manually build/test it?

### prerequisites
- [node.js](https://nodejs.org/)  
- [git](https://git-scm.com/downloads)  

### steps
```bash
# clone repo using your terminal
git clone https://github.com/mezleca/osu-stuff.git

# install all dependencies
cd osu-stuff
npm install

# build it for your platform
npm run build

# or build for a specific platform
npm run build:win    # windows
npm run build:linux  # linux

# binaries folder: /dist/...

# in case you wanna run instead of building it:

# (minified mode)
npm start
```

## big thanks to
- [CollectionManager](https://github.com/Piotrekol/CollectionManager) i stole a bunch of functions from that project
- [ctxmenu](https://github.com/nkappler/ctxmenu) used for custom context menu