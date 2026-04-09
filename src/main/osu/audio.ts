import audio_util from "@rel-packages/audio-utils";

export const get_audio_duration = (audio_location: string): number => {
    try {
        const duration = Number(audio_util.get_duration(audio_location));
        if (!Number.isFinite(duration) || duration <= 0) {
            return 0;
        }

        return duration;
    } catch (err) {
        console.warn("failed to get audio duration:", audio_location, err);
        return 0;
    }
};
