## osu-stuff

<p align="center">
    <img src="cat.png" style="width: 50%"> <br/>
    an app designed to give you more tools to interact with your osu! installation.<br/>
    below you’ll find some guides and useful info.
</p>

## authentication

in order to get player information, check beatmaps by md5, etc... osu-stuff needs your `osu! id` and `osu! secret`. <br/>
the process to configure this is pretty simple:

- create a new oauth application [here](https://osu.ppy.sh/home/account/edit#new-oauth-application)
- open the config tab in osu-stuff
- paste the 'client id' from osu! into the osu! id input
- click 'show client secret' on osu!'s website
- paste the 'client secret' into the osu! secret input
- done!

## mirrors

mirrors are used to download osu! beatmaps. <br/>
by default, no mirrors are set in the config. if you want to download beatmaps, make sure to check the 'adding mirrors' section. <br/>

| name          | url                                                                                  |
| ------------- | ------------------------------------------------------------------------------------ |
| `beatconnect` | [https://beatconnect.io/d/](https://beatconnect.io/d/)                               |
| `catboy`      | [https://catboy.best/d/](https://catboy.best/d/)                                     |
| `sayobot`     | [https://dl.sayobot.cn/beatmaps/download/](https://dl.sayobot.cn/beatmaps/download/) |

## adding mirrors

you can add custom mirrors in the config tab. <br/>
to add one, click the "+" popup, enter any name, and the url. <br/>
if the mirror you’re adding isn’t listed above, make sure the url ends with the download endpoint. <br/>

## quick tips

- turn on `lazer_mode` only if you use osu!lazer and want the app to work with its files.
- keep your `osu_id`/`osu_secret` private. they are used only to access osu!'s API.

## license

this project is licensed under the MIT License.
