#pragma once

#include <format>
#include <string>
#include <string_view>
#include <utility>

namespace app {
    enum class LogLevel {
        DEFAULT,
        INFO,
        WARN,
        ERROR,
    };

    void write_log(LogLevel level, std::string_view message);

    template <typename... Args>
    void log(LogLevel level, std::format_string<Args...> format, Args&&... args) {
        write_log(level, std::format(format, std::forward<Args>(args)...));
    }
} // namespace app

#define LOG(...) ::app::log(::app::LogLevel::DEFAULT, __VA_ARGS__)
#define LOG_INFO(...) ::app::log(::app::LogLevel::INFO, __VA_ARGS__)
#define LOG_WARN(...) ::app::log(::app::LogLevel::WARN, __VA_ARGS__)
#define LOG_ERROR(...) ::app::log(::app::LogLevel::ERROR, __VA_ARGS__)
