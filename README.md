<div align="center">
    <h1 align="center" style="border: none; margin-bottom: none;">osu-stuff</h1>
    <p align="center">just another app to manage osu! stable collections and download beatmaps</p>
</div>

<p align="center">
  <img width="70%" height="70%" src="https://github.com/mezleca/osu-stuff/blob/main/build/images/menu.png">
</p>

## how to download
- **v2.0.0**: (wip)  
- **older version (v1.2.7)**: [download here](https://github.com/mezleca/osu-stuff/releases/tag/v1.2.7)

> [!NOTE]  
> v2.0.0 is a simple portable app (download and open), while v1.2.7 (electron-based) uses an installer. 

if you find bugs, crashes, or anything weird:  
- hit `F12` to open devtools and grab the logs  
- send them to my [osu! profile](https://osu.ppy.sh/users/mzle) or open an issue here.  

## build the 2.0 version  

> [!WARNING]  
> this version is still in wip, so there's a high chance that nothing will work.

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
## about 2.0
the first version of osu-stuff was a simple cli app with basic functionality like downloading missing maps from collections. <br>
but then it started getting buggy because the cli method sucks ass, so i rewrote it using electron (version 1.0)... and it worked! <br>
the problem? electron is bloated as hell. it's literally a whole browser just to render an app. <br>
so now, im gonna rewrite this again, but this time, using a simple approach: <br>
frontend opens in your browser and comunicates with the backend using websocket. <br>
backend will be made using bunjs for simplicity and thats it. <br>