<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">yet another osu! manager</p>
</div>

<p align="center">
    <table>
        <tr>
            <td><img src="https://github.com/user-attachments/assets/970774ed-b71c-4e16-b722-edfa60994890" width="400"/></td>
            <td><img src="https://github.com/user-attachments/assets/c8e897b4-ca7b-41f6-9a44-aca5a6820c71" width="400"/></td>
        </tr>
        <tr>
            <td><img src="https://github.com/user-attachments/assets/48093539-a48e-45c0-97ec-a9a8ca625c2c" width="400"/></td>
            <td><img src="https://github.com/user-attachments/assets/6b00de17-1f4a-4068-8cad-07f08b4f9f37" width="400"/></td>
        </tr>
    </table>
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

- [node.js 25.x](https://nodejs.org/)
- [git](https://git-scm.com/downloads)
- [bun](https://bun.sh)

### steps

```bash
# clone repo
git clone https://github.com/mezleca/osu-stuff.git && cd osu-stuff

# install dependencies
bun install

# start without building
bun run dev

# or if you want a installer
bun run build:win
or
bun run build:linux
```

## credits

- [CollectionManager](https://github.com/Piotrekol/CollectionManager) .osdb files
- [Osu!Collector](https://osucollector.com)
- [osu-api-extended](https://github.com/cyperdark/osu-api-extended)
