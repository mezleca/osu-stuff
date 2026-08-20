#include "profiler.hpp"

#include <SDL3/SDL_log.h>
#include <SDL3/SDL_timer.h>

#include <algorithm>
#include <chrono>
#include <fstream>
#include <functional>
#include <iomanip>
#include <thread>

#if defined(__linux__)
#include <unistd.h>
#else
#include <windows.h>
#include <psapi.h>
#endif

namespace ui {
    static uint64_t profile_timestamp() {
        return SDL_GetPerformanceCounter();
    }

    static double profile_milliseconds(uint64_t start, uint64_t end) {
        const uint64_t frequency = SDL_GetPerformanceFrequency();
        if (frequency == 0 || end < start) {
            return 0.0;
        }

        return static_cast<double>(end - start) * 1000.0 / static_cast<double>(frequency);
    }

    static uint32_t profile_thread_id() {
        thread_local const uint32_t id =
            static_cast<uint32_t>(std::hash<std::thread::id>{}(std::this_thread::get_id()));
        return id;
    }

    static std::filesystem::path default_profile_directory() {
        std::error_code error;
        const std::filesystem::path directory = std::filesystem::temp_directory_path(error);
        return error ? std::filesystem::current_path() : directory;
    }

    static uint64_t profile_session_timestamp() {
        return static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
                .count()
        );
    }

    static double process_memory_megabytes() {
#if defined(__linux__)
        std::ifstream statm("/proc/self/statm");
        uint64_t total_pages = 0;
        uint64_t resident_pages = 0;
        if (!(statm >> total_pages >> resident_pages)) {
            return 0.0;
        }

        const long page_size = sysconf(_SC_PAGESIZE);
        return page_size > 0
                   ? static_cast<double>(resident_pages * static_cast<uint64_t>(page_size)) / (1024.0 * 1024.0)
                   : 0.0;
#else
        PROCESS_MEMORY_COUNTERS counters{};
        if (!GetProcessMemoryInfo(GetCurrentProcess(), &counters, sizeof(counters))) {
            return 0.0;
        }

        return static_cast<double>(counters.WorkingSetSize) / (1024.0 * 1024.0);
#endif
    }

    Profiler::Profiler(std::filesystem::path output_directory) {
        if (output_directory.empty()) {
            output_directory = default_profile_directory();
        }

        m_output_path = output_directory / (std::to_string(profile_session_timestamp()) + "-osu-stuff-perf.txt");
    }

    void Profiler::MetricSummary::record(double value) {
        if (samples == 0) {
            minimum = value;
            maximum = value;
        }

        ++samples;
        total += value;
        minimum = std::min(minimum, value);
        maximum = std::max(maximum, value);
        last = value;
    }

    double Profiler::MetricSummary::average() const {
        return samples == 0 ? 0.0 : total / static_cast<double>(samples);
    }

    void Profiler::set_enabled(bool enabled) {
        m_enabled = enabled;
        if (!enabled) {
            m_frame_open = false;
            m_depth = 0;
        }
    }

    bool Profiler::enabled() const {
        return m_enabled;
    }

    void Profiler::begin_frame() {
        if (!m_enabled) {
            return;
        }

        FrameBuffer& frame = m_frames[m_write_index];
        frame.count = 0;
        frame.dropped = 0;
        frame.start = profile_timestamp();
        frame.end = frame.start;
        m_depth = 0;
        m_frame_open = true;
    }

    void Profiler::end_frame() {
        if (!m_enabled || !m_frame_open) {
            return;
        }

        FrameBuffer& frame = m_frames[m_write_index];
        frame.end = profile_timestamp();
        m_read_index = m_write_index;
        m_write_index = 1 - m_write_index;
        m_depth = 0;
        m_frame_open = false;

        m_frame_metric.record(profile_milliseconds(frame.start, frame.end));
        ++m_memory_sample_counter;
        if (m_memory_metric.samples == 0 || m_memory_sample_counter >= 60) {
            const double memory_megabytes = process_memory_megabytes();
            if (memory_megabytes > 0.0) m_memory_metric.record(memory_megabytes);
            m_memory_sample_counter = 0;
        }
    }

    std::span<const ProfileEvent> Profiler::latest_events() const {
        const FrameBuffer& frame = m_frames[m_read_index];
        return {frame.events.data(), frame.count};
    }

    double Profiler::latest_frame_ms() const {
        const FrameBuffer& frame = m_frames[m_read_index];
        return profile_milliseconds(frame.start, frame.end);
    }

    double Profiler::node_duration_ms(uint64_t node_identity) const {
        if (node_identity == 0) {
            return 0.0;
        }

        for (const ProfileEvent& event : latest_events()) {
            if (event.node_identity == node_identity) {
                return profile_milliseconds(event.start, event.end);
            }
        }

        return 0.0;
    }

    uint32_t Profiler::dropped_events() const {
        return m_frames[m_read_index].dropped;
    }

    void Profiler::clear_report() {
        m_frame_metric = {};
        m_memory_metric = {};
        m_memory_sample_counter = 0;
    }

    void Profiler::set_output_directory(std::filesystem::path output_directory) {
        if (output_directory.empty()) {
            output_directory = default_profile_directory();
        }

        m_output_path = output_directory / m_output_path.filename();
    }

    bool Profiler::has_report() const {
        return m_frame_metric.samples > 0;
    }

    bool Profiler::save_report() const {
        if (!has_report()) {
            return false;
        }

        std::error_code error;
        std::filesystem::create_directories(m_output_path.parent_path(), error);
        if (error) {
            return false;
        }

        std::ofstream output(m_output_path);
        output << std::fixed << std::setprecision(2);
        const auto write_metric = [&output](std::string_view name, const MetricSummary& metric, std::string_view unit) {
            if (metric.samples == 0) {
                return;
            }

            output << name << ".samples = " << metric.samples << '\n';
            output << name << ".average_" << unit << " = " << metric.average() << '\n';
            output << name << ".min_" << unit << " = " << metric.minimum << '\n';
            output << name << ".max_" << unit << " = " << metric.maximum << '\n';
            output << name << ".last_" << unit << " = " << metric.last << '\n';
        };

        write_metric("frame", m_frame_metric, "ms");
        write_metric("memory", m_memory_metric, "mb");

        if (!output.good()) {
            return false;
        }

        SDL_Log("[Profiler]: saved report to %s", m_output_path.string().c_str());
        return true;
    }

    const std::filesystem::path& Profiler::output_path() const {
        return m_output_path;
    }

    Profiler::ZoneToken Profiler::begin_zone(std::string_view name, uint64_t node_identity) {
        if (!m_enabled || !m_frame_open) {
            return {};
        }

        FrameBuffer& frame = m_frames[m_write_index];
        const uint16_t depth = m_depth++;
        if (frame.count >= frame.events.size()) {
            ++frame.dropped;
            return {};
        }

        const std::size_t index = frame.count++;
        frame.events[index] = {
            .name = name,
            .start = profile_timestamp(),
            .node_identity = node_identity,
            .thread_id = profile_thread_id(),
            .depth = depth,
        };
        return {.event_index = index, .recorded = true};
    }

    void Profiler::end_zone(ZoneToken token) {
        if (!m_enabled || !m_frame_open) {
            return;
        }

        if (m_depth > 0) {
            --m_depth;
        }

        if (token.recorded) {
            m_frames[m_write_index].events[token.event_index].end = profile_timestamp();
        }
    }

    ScopedProfileZone::ScopedProfileZone(Profiler* profiler, std::string_view name, uint64_t node_identity)
        : m_profiler(profiler) {
        if (m_profiler != nullptr) {
            m_token = m_profiler->begin_zone(name, node_identity);
        }
    }

    ScopedProfileZone::~ScopedProfileZone() {
        if (m_profiler != nullptr) {
            m_profiler->end_zone(m_token);
        }
    }
} // namespace ui
