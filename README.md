<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">just another app to manage osu! stable collections and download beatmaps</p>
</div>

<p align="center">
  <img width="70%" height="70%" src="https://github.com/mezleca/osu-stuff/blob/main/build/images/menu.png">
</p>

## how to download
- **current app version (v1.2.7)**: [download here](https://github.com/mezleca/osu-stuff/releases/tag/v1.2.7)

if you find bugs, crashes, or anything weird:  
- hit `F12` to open devtools and grab the logs  
- send them to my [osu! profile](https://osu.ppy.sh/users/mzle) or open an issue here.  

## build the old version

### prerequisites
- [node.js](https://nodejs.org/)  
- git  

### steps
```bash
# clone repo
git clone https://github.com/mezleca/osu-stuff.git

# install dependencies
cd osu-stuff
npm install
npm install -g electron-builder

# run the app
npm start

# build it for your platform
npm run make

# or build for a specific platform
npm run make:win    # windows
npm run make:linux  # linux
```
