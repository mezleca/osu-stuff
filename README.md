<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">yet another collection manager</p>
</div>

<p align="center">
  <img src="https://github.com/mezleca/osu-stuff/blob/main/build/images/menu.png">
</p>

## wtf is osu-stuff

a simple and useful app that gives you freedom to:

- manage your lazer/stable collections (import, export, merge, etc...)
- download beatmaps (missing beatmaps from collections, from players, etc...)
- listen to songs from your osu! folder (filtered from collections or idk, your query?)
- a lot more

## wanna help osu-manager development?

- bugs report and merge requests are always welcome
- just make sure to include what you're adding or the issue you're reporting.

> [!NOTE]  
> beatmaps download with lazer mode will be placed in the exports folder

## download

- **latest version**: [download here](https://github.com/mezleca/osu-stuff/releases/latest)

## custom mirrors

| name          | url                                                                                  |
| ------------- | ------------------------------------------------------------------------------------ |
| `beatconnect` | [https://beatconnect.io/d/](https://beatconnect.io/d/)                               |
| `catboy`      | [https://catboy.best/d/](https://catboy.best/d/)                                     |
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

- [node.js](https://nodejs.org/)
- [git](https://git-scm.com/downloads)
- [bun](https://bun.sh)

### steps

```bash
# clone repo
git clone https://github.com/mezleca/osu-stuff.git

# install dependencies
cd osu-stuff
bun install

# start without building
bun run dev

# build for your platform (win / linux)
bun run build && bun run build:the_platform
```

## credits

- [CollectionManager](https://github.com/Piotrekol/CollectionManager) osdb files
