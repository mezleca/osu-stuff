<h1 align="center">osu-stuff</h1>

<p align="center">
    <img width="70%" height="70%" src="https://cdn.discordapp.com/attachments/1197017157393989814/1256717362678333550/image.png?ex=6681c8bf&is=6680773f&hm=76184a1ca543bbb1c7a017cf37bd1a61d816687d3f8bf93b4901216f5ba8d2c1&"></img>
</p>

terminal version: [osu-stuff-old](https://github.com/mezleca/osu-stuff-old)

# Setup Instructions
You can download the stable version for windows using the [releases](https://github.com/mezleca/osu-stuff/releases/) tab on this repository.
In case you wanna use the latest version, follow the Build Instructions.

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
