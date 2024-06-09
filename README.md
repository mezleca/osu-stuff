<p align="center" style="font-size: 2em; font-weight: bold;">osu-stuff</p>
<p align="center" style="font-size: 1em; font-weight: bold;">a app created to do a bunch of osu related stuff</p>

<p align="center">
    <img width="70%" height="70%" src="https://github.com/mezleca/osu-stuff/blob/main/src/icon.png"></img>
</p>

terminal version: [osu-stuff-old](https://github.com/mezleca/osu-stuff-old)

# Setup Instructions
You can download the latest version for windows using the [releases](https://github.com/mezleca/osu-stuff/releases/) tab on this repository.
In case you wanna build yourself, use the Build instructions.

# Build Instructions
1. Install nodejs-lts and npm.

2. Clone the repository:
    ```
    git clone https://github.com/mezleca/osu-stuff.git
    ```

3. Open your terminal on osu-stuff folder and enter the following commands:
    ```
    npm install
    npm install -g electron-builder
    ```

4. Build the project for the current platform:
   ```
   npm run make
   or
   electron-builder build --platform=<platform>
   ```

    Replace `<platform>` with the desired platform (e.g., `win`, `mac`, `linux`).

5. In case you just wanna start without any build process, just run:
    ```
    npm run dev
    ```
