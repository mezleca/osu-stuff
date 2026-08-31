#pragma once

#include <format>
#include <string>
#include <string_view>
#include <utility>

namespace app {
    enum class LogLevel {
        Default,
        Info,
        Warn,
        Error,
    };

    void write_log(LogLevel level, std::string_view message);

    template <typename... Args>
    void log(LogLevel level, std::format_string<Args...> format, Args&&... args) {
        write_log(level, std::format(format, std::forward<Args>(args)...));
    }
} // namespace app

#define LOG(...) ::app::log(::app::LogLevel::Default, __VA_ARGS__)
#define LOG_INFO(...) ::app::log(::app::LogLevel::Info, __VA_ARGS__)
#define LOG_WARN(...) ::app::log(::app::LogLevel::Warn, __VA_ARGS__)
#define LOG_ERROR(...) ::app::log(::app::LogLevel::Error, __VA_ARGS__)
