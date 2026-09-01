#pragma once

#include <cstdio>
#include <format>
#include <mutex>
#include <string>
#include <string_view>
#include <utility>

#ifdef _WIN32
#include <io.h>
#include <windows.h>
#else
#include <unistd.h>
#endif

namespace app {
    enum class LogLevel {
        Default,
        Info,
        Warn,
        Error,
    };

    inline bool is_error_terminal() {
#ifdef _WIN32
        return _isatty(_fileno(stderr)) != 0;
#else
        return ::isatty(fileno(stderr)) != 0;
#endif
    }

#ifdef _WIN32
    inline void enable_windows_ansi() {
        static const bool enabled = [] {
            const HANDLE handle = GetStdHandle(STD_ERROR_HANDLE);
            if (handle == INVALID_HANDLE_VALUE || handle == nullptr) {
                return false;
            }

            DWORD mode = 0;
            if (!GetConsoleMode(handle, &mode)) {
                return false;
            }

            return SetConsoleMode(handle, mode | ENABLE_VIRTUAL_TERMINAL_PROCESSING) != 0;
        }();

        static_cast<void>(enabled);
    }
#endif

    inline std::string_view log_color(LogLevel level) {
        switch (level) {
            case LogLevel::Info:
                return "\x1b[38;2;110;165;215m";
            case LogLevel::Warn:
                return "\x1b[38;2;220;190;90m";
            case LogLevel::Error:
                return "\x1b[38;2;220;105;105m";
            case LogLevel::Default:
                return {};
        }

        return {};
    }

    inline void write_log(LogLevel level, std::string_view message) {
        static std::mutex mutex;
        const std::lock_guard lock(mutex);

        if (level != LogLevel::Default && is_error_terminal()) {
#ifdef _WIN32
            enable_windows_ansi();
#endif
            const auto colored_message = std::format("{}{}\x1b[0m\n", log_color(level), message);
            std::fwrite(colored_message.data(), sizeof(char), colored_message.size(), stderr);
        } else {
            std::fwrite(message.data(), sizeof(char), message.size(), stderr);
            std::fputc('\n', stderr);
        }

        std::fflush(stderr);
    }

    inline void log(LogLevel level, std::string_view message) {
        write_log(level, message);
    }

    template <typename... Args>
    void log(LogLevel level, std::format_string<Args...> format, Args&&... args) {
        write_log(level, std::format(format, std::forward<Args>(args)...));
    }
} // namespace app

#define LOG(message, ...) ::app::log(::app::LogLevel::Default, message __VA_OPT__(, ) __VA_ARGS__)
#define LOG_INFO(message, ...) ::app::log(::app::LogLevel::Info, message __VA_OPT__(, ) __VA_ARGS__)
#define LOG_WARN(message, ...) ::app::log(::app::LogLevel::Warn, message __VA_OPT__(, ) __VA_ARGS__)
#define LOG_ERROR(message, ...) ::app::log(::app::LogLevel::Error, message __VA_OPT__(, ) __VA_ARGS__)
