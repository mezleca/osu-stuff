#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <span>
#include <string_view>

namespace ui {
    struct ProfileEvent {
        std::string_view name;
        uint64_t start = 0;
        uint64_t end = 0;
        uint64_t node_identity = 0;
        uint32_t thread_id = 0;
        uint16_t depth = 0;
    };

    class Profiler {
    public:
        static constexpr std::size_t EVENT_CAPACITY = 8192;

        explicit Profiler(std::filesystem::path output_directory = {});

        void set_enabled(bool enabled);
        [[nodiscard]] bool enabled() const;

        void begin_frame();
        void end_frame();

        [[nodiscard]] std::span<const ProfileEvent> latest_events() const;
        [[nodiscard]] double latest_frame_ms() const;
        [[nodiscard]] double node_duration_ms(uint64_t node_identity) const;
        [[nodiscard]] uint32_t dropped_events() const;
        void clear_report();
        void set_output_directory(std::filesystem::path output_directory);
        [[nodiscard]] bool has_report() const;
        bool save_report() const;
        [[nodiscard]] const std::filesystem::path& output_path() const;

    private:
        friend class ScopedProfileZone;

        struct ZoneToken {
            std::size_t event_index = 0;
            bool recorded = false;
        };

        struct FrameBuffer {
            std::array<ProfileEvent, EVENT_CAPACITY> events{};
            std::size_t count = 0;
            uint64_t start = 0;
            uint64_t end = 0;
            uint32_t dropped = 0;
        };

        struct MetricSummary {
            uint64_t samples = 0;
            double total = 0.0;
            double minimum = 0.0;
            double maximum = 0.0;
            double last = 0.0;

            void record(double value);
            [[nodiscard]] double average() const;
        };

        [[nodiscard]] ZoneToken begin_zone(std::string_view name, uint64_t node_identity);
        void end_zone(ZoneToken token);

        std::array<FrameBuffer, 2> m_frames;
        std::filesystem::path m_output_path;
        MetricSummary m_frame_metric;
        MetricSummary m_memory_metric;
        std::size_t m_write_index = 0;
        std::size_t m_read_index = 1;
        uint16_t m_depth = 0;
        uint16_t m_memory_sample_counter = 0;
        bool m_enabled = false;
        bool m_frame_open = false;
    };

    class ScopedProfileZone {
    public:
        ScopedProfileZone(Profiler* profiler, std::string_view name, uint64_t node_identity = 0);
        ~ScopedProfileZone();

        ScopedProfileZone(const ScopedProfileZone&) = delete;
        ScopedProfileZone& operator=(const ScopedProfileZone&) = delete;

    private:
        Profiler* m_profiler = nullptr;
        Profiler::ZoneToken m_token;
    };
} // namespace ui

#define UI_PROFILE_JOIN_INNER(left, right) left##right
#define UI_PROFILE_JOIN(left, right) UI_PROFILE_JOIN_INNER(left, right)

#if OSU_STUFF_ENABLE_PROFILING
#define UI_PROFILE_SCOPE(profiler, name)                                                                               \
    ::ui::ScopedProfileZone UI_PROFILE_JOIN(profile_scope_, __LINE__) {                                                \
        profiler, name                                                                                                 \
    }
#define UI_PROFILE_NODE(profiler, name, node_identity)                                                                 \
    ::ui::ScopedProfileZone UI_PROFILE_JOIN(profile_scope_, __LINE__) {                                                \
        profiler, name, node_identity                                                                                  \
    }
#else
#define UI_PROFILE_SCOPE(profiler, name)
#define UI_PROFILE_NODE(profiler, name, node_identity)
#endif
