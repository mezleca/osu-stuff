#include "audio-manager.hpp"

#include <SDL3/SDL.h>
#include <SDL3_mixer/SDL_mixer.h>

AudioManager::AudioManager() {
    m_initialized = MIX_Init();
    if (!m_initialized) {
        return;
    }

    m_mixer = MIX_CreateMixerDevice(SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK, nullptr);
}

AudioManager::~AudioManager() {
    if (m_mixer != nullptr) {
        MIX_DestroyMixer(m_mixer);
    }

    if (m_initialized) {
        MIX_Quit();
    }
}

AudioManager& AudioManager::instance() {
    static AudioManager manager;
    return manager;
}

bool AudioManager::ready() const {
    return m_mixer != nullptr;
}

MIX_Mixer* AudioManager::mixer() const {
    return m_mixer;
}
