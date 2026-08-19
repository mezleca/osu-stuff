#pragma once

#include <chrono>
#include <cstdint>
#include <filesystem>
#include <map>
#include <string>
#include <string_view>

namespace ui {
    struct PerformanceMetric {
        std::string unit;
        uint64_t samples = 0;
        double total = 0.0;
        double minimum = 0.0;
        double maximum = 0.0;
        double last = 0.0;

        [[nodiscard]] double average() const {
            return samples == 0 ? 0.0 : total / static_cast<double>(samples);
        }
    };

    class PerformanceRecorder {
    public:
        explicit PerformanceRecorder(std::filesystem::path output_directory = {});

        void set_enabled(bool enabled);
        [[nodiscard]] bool enabled() const;

        void begin_frame(std::string_view surface);
        void end_frame(std::string_view surface);
        void record(std::string_view name, double value, std::string_view unit);
        void clear();
        void set_output_directory(std::filesystem::path output_directory);

        [[nodiscard]] const std::filesystem::path& output_path() const;
        [[nodiscard]] bool save() const;
        [[nodiscard]] const std::map<std::string, PerformanceMetric>& metrics() const;

    private:
        bool m_enabled = false;
        std::filesystem::path m_output_path;
        std::map<std::string, PerformanceMetric> m_metrics;
        std::map<std::string, std::chrono::steady_clock::time_point> m_frame_starts;
    };
} // namespace ui
