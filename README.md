<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">yet another collection manager</p>
</div>

<p align="center">
  <img src="https://github.com/mezleca/osu-stuff/blob/main/build/images/menu.png">
</p>

## wtf is osu-stuff
a simple and useful app that gives you freedom to:
- manage your lazer/stable collections
- import collections from files/websites (osu!collector, osustats)
- export collections to legacy db files or osdb files (minimal)
- create collections from player's best performance, favorites maps, first place, etc.
- merge collections
- get missing beatmaps from collections
- delete beatmaps from collections
- delete beatmaps from your osu folder (still experimental)
- etc...

## found bugs or crashes?
- hit `F12` to open devtools and grab the logs
- if the issue is download related, the logs are in the osu-stuff folder (%APPDATA on windows / .local/share on linux)
- send them to my [osu! profile](https://osu.ppy.sh/users/mzle) or create an issue on this repo

> [!NOTE]  
> for now, all beatmaps downloaded using (lazer mode) will be placed in the exports folder

## download
- **latest version**: [download here](https://github.com/mezleca/osu-stuff/releases/latest)

## custom mirrors
| name         | url                                                      |
| ------------ | -------------------------------------------------------- |
| `beatconnect` | [https://beatconnect.io/d/](https://beatconnect.io/d/)   |
| `catboy`      | [https://catboy.best/d/](https://catboy.best/d/)         |
| `sayobot`     | [https://dl.sayobot.cn/beatmaps/download/](https://dl.sayobot.cn/beatmaps/download/) |

## linux dependencies

### debian/ubuntu
```bash
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libasound2 libxtst6 libdbus-1-3 libuuid1 libfuse2
```

### arch
```bash
sudo pacman -S gtk3 libnotify nss libxss alsa-lib libxtst dbus fuse
```

## build it yourself

### prerequisites
- [bun](https://bun.sh/)
- [node.js](https://nodejs.org/)  
- [git](https://git-scm.com/downloads)  

### steps
```bash
# clone repo
git clone https://github.com/mezleca/osu-stuff.git

# install dependencies
cd osu-stuff
bun install

# build for your platform
bun run build

# or build for specific platform
bun run build:win    # windows
bun run build:linux  # linux

# binaries location: /dist/...

# to run instead of building:
bun start
```

## credits
- [CollectionManager](https://github.com/Piotrekol/CollectionManager) - osdb
- [ctxmenu](https://github.com/nkappler/ctxmenu) - custom context menu
- [osu-cad](https://github.com/minetoblend/osu-cad) - used for beatmap preview
