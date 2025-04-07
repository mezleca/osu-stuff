<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">your least favorite collection manager</p>
</div>

<p align="center">
  <img width="90%" height="90%" src="https://github.com/mezleca/osu-stuff/blob/main/build/images/menu.png">
</p>

## wtf is osu-stuff
collection manager app with a bunch of features like:
- lazer and stable support
- download collections from osu!collector / osustats
- create collections from player's top 100, first place and shit like that
- merge collections
- get missing beatmaps from collections
- delete beatmaps from collections
- etc...

> [!NOTE]  
> for now, all downloaded beatmaps using (lazer mode) will be placed on the exports folder.

## how to download
- **current app version (v1.6)**: [download here](https://github.com/mezleca/osu-stuff/releases/latest)

## linux dependencies
### ubuntu
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
- send them to my [osu! profile](https://osu.ppy.sh/users/mzle) or open an issue here.  

## how can i build this thing?

### prerequisites
- [node.js](https://nodejs.org/)  
- [git](https://git-scm.com/downloads)  

### steps
```bash
# clone repo
git clone https://github.com/mezleca/osu-stuff.git

# install dependencies
cd osu-stuff
npm install && npm install -g electron-builder

# run the app
npm start

# build it for your platform
npm run make

# or build for a specific platform
npm run make:win    # windows
npm run make:linux  # linux
```

## big thanks to
- [CollectionManager](https://github.com/Piotrekol/CollectionManager) i stole a bunch of functions from that project
