#pragma once

struct MIX_Mixer;

class AudioInstance;

class AudioManager final {
public:
    static AudioManager& instance();

    [[nodiscard]] bool ready() const;

private:
    friend class AudioInstance;

    AudioManager();
    ~AudioManager();

    AudioManager(const AudioManager&) = delete;
    AudioManager& operator=(const AudioManager&) = delete;
    AudioManager(AudioManager&&) = delete;
    AudioManager& operator=(AudioManager&&) = delete;

    [[nodiscard]] MIX_Mixer* mixer() const;

    bool m_initialized = false;
    MIX_Mixer* m_mixer = nullptr;
};
