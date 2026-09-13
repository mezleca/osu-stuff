#include "audio-instance.hpp"
#include "audio-manager.hpp"

#include <SDL3_mixer/SDL_mixer.h>

#include <cmath>

AudioInstance::AudioInstance() {
    auto& manager = AudioManager::instance();
    if (!manager.ready()) {
        return;
    }

    m_mixer = manager.mixer();
    m_track = MIX_CreateTrack(m_mixer);
}

AudioInstance::AudioInstance(const std::filesystem::path& location) : AudioInstance() {
    load(location);
}

AudioInstance::~AudioInstance() {
    unload();
    if (m_track != nullptr) {
        MIX_DestroyTrack(m_track);
    }
}

bool AudioInstance::ready() const {
    return m_track != nullptr;
}

bool AudioInstance::loaded() const {
    return m_audio != nullptr;
}

bool AudioInstance::load(const std::filesystem::path& location) {
    if (!ready() || location.empty()) {
        return false;
    }

    const auto utf8_location = location.u8string();
    auto* audio = MIX_LoadAudio(m_mixer, reinterpret_cast<const char*>(utf8_location.c_str()), false);
    if (audio == nullptr) {
        return false;
    }

    if (!MIX_SetTrackAudio(m_track, audio)) {
        MIX_DestroyAudio(audio);
        return false;
    }

    MIX_DestroyAudio(m_audio);
    m_audio = audio;
    return true;
}

void AudioInstance::unload() {
    if (!loaded()) {
        return;
    }

    MIX_StopTrack(m_track, 0);
    MIX_SetTrackAudio(m_track, nullptr);
    MIX_DestroyAudio(m_audio);
    m_audio = nullptr;
}

bool AudioInstance::play(int loops) {
    if (!loaded() || loops < -1 || !MIX_SetTrackLoops(m_track, loops)) {
        return false;
    }

    return MIX_PlayTrack(m_track, 0);
}

bool AudioInstance::pause() {
    if (!playing()) {
        return false;
    }

    return MIX_PauseTrack(m_track);
}

bool AudioInstance::resume() {
    if (!paused()) {
        return false;
    }

    return MIX_ResumeTrack(m_track);
}

bool AudioInstance::stop() {
    if (!playing() && !paused()) {
        return false;
    }

    return MIX_StopTrack(m_track, 0);
}

bool AudioInstance::playing() const {
    return ready() && MIX_TrackPlaying(m_track);
}

bool AudioInstance::paused() const {
    return ready() && MIX_TrackPaused(m_track);
}

bool AudioInstance::set_volume(float value) {
    if (!ready() || !std::isfinite(value) || value < 0.0F) {
        return false;
    }

    return MIX_SetTrackGain(m_track, value);
}

float AudioInstance::volume() const {
    return ready() ? MIX_GetTrackGain(m_track) : 0.0F;
}

bool AudioInstance::speed(float value) {
    if (!ready() || !std::isfinite(value) || value < 0.01F || value > 100.0F) {
        return false;
    }

    return MIX_SetTrackFrequencyRatio(m_track, value);
}

float AudioInstance::speed() const {
    return ready() ? MIX_GetTrackFrequencyRatio(m_track) : 0.0F;
}

bool AudioInstance::seek(std::chrono::milliseconds value) {
    if (!loaded() || value.count() < 0) {
        return false;
    }

    const auto frames = MIX_AudioMSToFrames(m_audio, value.count());
    return frames >= 0 && MIX_SetTrackPlaybackPosition(m_track, frames);
}

std::optional<std::chrono::milliseconds> AudioInstance::position() const {
    if (!loaded()) {
        return std::nullopt;
    }

    const auto frames = MIX_GetTrackPlaybackPosition(m_track);
    if (frames < 0) {
        return std::nullopt;
    }

    const auto milliseconds = MIX_AudioFramesToMS(m_audio, frames);
    if (milliseconds < 0) {
        return std::nullopt;
    }

    return std::chrono::milliseconds(milliseconds);
}

std::optional<std::chrono::milliseconds> AudioInstance::duration() const {
    if (!loaded()) {
        return std::nullopt;
    }

    const auto frames = MIX_GetAudioDuration(m_audio);
    if (frames < 0) {
        return std::nullopt;
    }

    const auto milliseconds = MIX_AudioFramesToMS(m_audio, frames);
    if (milliseconds < 0) {
        return std::nullopt;
    }

    return std::chrono::milliseconds(milliseconds);
}
