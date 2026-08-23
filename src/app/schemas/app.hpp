#pragma once

#include <cpprealm/sdk.hpp>

namespace realm {
    struct AppOsuCredentials;
    struct AppOsuData;
    struct AppRadioData;

    struct AppConfig {
        primary_key<int64_t> _id = 0;
        AppOsuCredentials* credentials = nullptr;
        AppOsuData* osu_data = nullptr;
        AppRadioData* radio = nullptr;
    };

    REALM_SCHEMA(AppConfig, _id, credentials, osu_data, radio);

    struct AppOsuCredentials {
        std::string id;
        std::string secret;
    };

    REALM_EMBEDDED_SCHEMA(AppOsuCredentials, id, secret);

    struct AppProcessedBeatmap {
        primary_key<std::string> _id; // key created from: beatmap_id, audio file name
        std::string background;
        int64_t duration;
    };

    REALM_SCHEMA(AppProcessedBeatmap, _id, background, duration);

    struct AppOsuData {
        std::string location;
        bool lazer = false;
    };

    REALM_EMBEDDED_SCHEMA(AppOsuData, location, lazer);

    struct AppPlaylistSong {
        std::string title;
        std::string artist;
        std::string file; // audio file (relative to osu! path if is_from_osu == true)
        std::string background; // background (relative to osu! path if is_from_osu == true)
        std::string checksum; // checksum of the processed beatmap (.osu)
        bool is_from_osu = false;
    };

    REALM_EMBEDDED_SCHEMA(AppPlaylistSong, title, artist, file, background, checksum, is_from_osu);

    struct AppPlaylist {
        std::string name;
        std::vector<AppPlaylistSong*> songs;
    };

    REALM_SCHEMA(AppPlaylist, name, songs);

    struct AppRadioData {
        int64_t volume = 50;
        bool shuffle = false;
        bool repeat = false; // repeats the current track once
        std::vector<AppPlaylist*> playlists;
    };

    REALM_EMBEDDED_SCHEMA(AppRadioData, volume, shuffle, repeat, playlists);
} // namespace realm
