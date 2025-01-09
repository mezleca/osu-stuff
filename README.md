<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">just another app to manage osu! stable collections and download beatmaps</p>
</div>

<p align="center">
  <img width="70%" height="70%" src="https://github.com/mezleca/osu-stuff/blob/main/build/images/menu.png">
</p>

## how to download
- **current app version (v1.3.0)**: [download here](https://github.com/mezleca/osu-stuff/releases/tag/v1.3.0)

## optional mirrors
- [catboy...](https://catboy.best)
- [beatconnect](https://beatconnect.io)

if you find bugs, crashes, or anything weird:  
- hit `F12` to open devtools and grab the logs  
- send them to my [osu! profile](https://osu.ppy.sh/users/mzle) or open an issue here.  

## build it yourself

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

# if you're on linux, you will need to install those dependencies
base-devel clang libdbus gtk2 libnotifylibgnome-keyring alsa-lib libcap libcups libxtst 
libxss nss gcc-multilib curl gperf bison python2 python-dbusmock jdk8-openjdk

# run the app
npm start

# build it for your platform
npm run make

# or build for a specific platform
npm run make:win    # windows
npm run make:linux  # linux
```
