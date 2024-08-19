> [!WARNING]
> I don't plan to update this app anymore.
> If you find a bug or you know something that could improve the performance, feel free to report or make a pull request.

<h1 align="center">osu-stuff</h1>

<p align="center">
    <img width="70%" height="70%" src="https://github.com/mezleca/osu-stuff/blob/main/src/images/menu.png"></img>
</p>

> [!NOTE] 
> In case you find any errors, please open the devtools by pressing "F12" and share the logs on my [osu](https://osu.ppy.sh/users/mzle) dm or in a issue in this repo.

# Setup Instructions
You can download the stable version for windows using the [releases](https://github.com/mezleca/osu-stuff/releases/) tab on this repository.
In case you wanna use the latest version, follow the Build Instructions.

# Build Instructions
1. Install [nodejs](https://nodejs.org/en)

2. Clone the repository:
    ```
    git clone https://github.com/mezleca/osu-stuff.git
    ```

3. Open your terminal in the osu-stuff folder and enter the following commands:
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
    or
    npm run start
    ```
