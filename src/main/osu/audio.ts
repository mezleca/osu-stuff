import audio_util from "@rel-packages/audio-utils";
import fs from "fs";

export const get_audio_duration = (audio_location: string): number => {
    if (!audio_location || !fs.existsSync(audio_location)) {
        return -1;
    }

    try {
        const duration = Number(audio_util.get_duration(audio_location));

        if (!Number.isFinite(duration) || duration <= 0) {
            return -1;
        }

        return duration;
    } catch (err) {
        console.warn("failed to get audio duration:", audio_location, err);
        return -1;
    }
};
