#include "performance.hpp"
#include "../constants.hpp"

#include <SDL3/SDL_log.h>

#include <algorithm>
#include <fstream>
#include <iomanip>
#include <utility>

#if defined(__linux__)
#include <unistd.h>
#else
#include <windows.h>
#include <psapi.h>
#endif

namespace ui::performance_internal {
    uint64_t session_timestamp() {
        return static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
                .count()
        );
    }

    std::filesystem::path default_output_directory() {
        std::error_code error;
        const std::filesystem::path directory = std::filesystem::temp_directory_path(error);
        return error ? std::filesystem::current_path() : directory;
    }

    uint64_t process_memory_bytes() {
#if defined(__linux__)
        std::ifstream statm("/proc/self/statm");
        uint64_t total_pages = 0;
        uint64_t resident_pages = 0;
        if (!(statm >> total_pages >> resident_pages)) {
            return 0;
        }

        const long page_size = sysconf(_SC_PAGESIZE);
        return page_size > 0 ? resident_pages * static_cast<uint64_t>(page_size) : 0;
#else
        PROCESS_MEMORY_COUNTERS counters{};
        if (!GetProcessMemoryInfo(GetCurrentProcess(), &counters, sizeof(counters))) {
            return 0;
        }

        return static_cast<uint64_t>(counters.WorkingSetSize);
#endif
    }

    double process_memory_megabytes() {
        const uint64_t bytes = process_memory_bytes();
        return bytes == 0 ? 0.0 : static_cast<double>(bytes) / (1024.0 * 1024.0);
    }
} // namespace ui::performance_internal

namespace ui {
    PerformanceRecorder::PerformanceRecorder(std::filesystem::path output_directory) {
        if constexpr (!constants::IS_DEBUG_BUILD) {
            return;
        }

        const std::filesystem::path directory =
            output_directory.empty() ? performance_internal::default_output_directory() : std::move(output_directory);
        const uint64_t timestamp = performance_internal::session_timestamp();
        m_output_path = directory / (std::to_string(timestamp) + "-osu-stuff-perf.txt");
    }

    void PerformanceRecorder::set_enabled(bool enabled) {
        m_enabled = constants::IS_DEBUG_BUILD && enabled;
    }

    bool PerformanceRecorder::enabled() const {
        return constants::IS_DEBUG_BUILD && m_enabled;
    }

    void PerformanceRecorder::begin_frame(std::string_view surface) {
        if (!enabled()) {
            return;
        }

        m_frame_starts[std::string{surface}] = std::chrono::steady_clock::now();
    }

    void PerformanceRecorder::end_frame(std::string_view surface) {
        if (!enabled()) {
            return;
        }

        const std::string key{surface};
        const auto it = m_frame_starts.find(key);

        if (it == m_frame_starts.end()) {
            return;
        }

        const double elapsed =
            std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - it->second).count();
        m_frame_starts.erase(it);

        record("frame." + key, elapsed, "ms");

        const double memory_megabytes = performance_internal::process_memory_megabytes();
        if (memory_megabytes > 0.0) {
            record("memory." + key, memory_megabytes, "mb");
        }
    }

    void PerformanceRecorder::record(std::string_view name, double value, std::string_view unit) {
        if (!enabled() || name.empty()) {
            return;
        }

        PerformanceMetric& metric = m_metrics[std::string{name}];

        if (metric.samples == 0) {
            metric.unit = unit;
            metric.minimum = value;
            metric.maximum = value;
        }

        if (metric.unit != unit) {
            return;
        }

        ++metric.samples;
        metric.total += value;
        metric.minimum = std::min(metric.minimum, value);
        metric.maximum = std::max(metric.maximum, value);
        metric.last = value;
    }

    void PerformanceRecorder::clear() {
        m_metrics.clear();
        m_frame_starts.clear();
    }

    void PerformanceRecorder::set_output_directory(std::filesystem::path output_directory) {
        if constexpr (!constants::IS_DEBUG_BUILD) {
            return;
        }

        if (output_directory.empty()) {
            output_directory = performance_internal::default_output_directory();
        }

        m_output_path = output_directory / m_output_path.filename();
    }

    const std::filesystem::path& PerformanceRecorder::output_path() const {
        return m_output_path;
    }

    bool PerformanceRecorder::save() const {
        if (m_metrics.empty()) {
            return false;
        }

        std::error_code error;
        std::filesystem::create_directories(m_output_path.parent_path(), error);

        if (error) {
            return false;
        }

        std::ofstream output(m_output_path);
        output << std::fixed << std::setprecision(2);

        for (const auto& [name, metric] : m_metrics) {
            output << name << ".samples = " << metric.samples << '\n';
            output << name << ".average_" << metric.unit << " = " << metric.average() << '\n';
            output << name << ".min_" << metric.unit << " = " << metric.minimum << '\n';
            output << name << ".max_" << metric.unit << " = " << metric.maximum << '\n';
            output << name << ".last_" << metric.unit << " = " << metric.last << '\n';
        }

        if (!output.good()) {
            return false;
        }

        SDL_Log("[PerformanceRecorder]: saved report to %s", m_output_path.string().c_str());
        return true;
    }

    const std::map<std::string, PerformanceMetric>& PerformanceRecorder::metrics() const {
        return m_metrics;
    }
} // namespace ui
