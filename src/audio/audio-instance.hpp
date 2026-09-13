#pragma once

#include <chrono>
#include <filesystem>
#include <optional>

struct MIX_Audio;
struct MIX_Mixer;
struct MIX_Track;

class AudioInstance final {
public:
    AudioInstance();
    explicit AudioInstance(const std::filesystem::path& location);
    ~AudioInstance();

    AudioInstance(const AudioInstance&) = delete;
    AudioInstance& operator=(const AudioInstance&) = delete;

    [[nodiscard]] bool ready() const;
    [[nodiscard]] bool loaded() const;
    bool load(const std::filesystem::path& location);
    void unload();

    bool play(int loops = 0);
    bool pause();
    bool resume();
    bool stop();

    [[nodiscard]] bool playing() const;
    [[nodiscard]] bool paused() const;

    bool set_volume(float value);
    [[nodiscard]] float volume() const;

    bool speed(float value);
    [[nodiscard]] float speed() const;

    bool seek(std::chrono::milliseconds position);
    [[nodiscard]] std::optional<std::chrono::milliseconds> position() const;
    [[nodiscard]] std::optional<std::chrono::milliseconds> duration() const;

private:
    MIX_Mixer* m_mixer = nullptr;
    MIX_Track* m_track = nullptr;
    MIX_Audio* m_audio = nullptr;
};
