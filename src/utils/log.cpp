#include "log.hpp"

#include <cstdio>
#include <mutex>
#include <string>

#ifdef _WIN32
#include <io.h>
#include <windows.h>
#else
#include <unistd.h>
#endif

using namespace app;

static bool is_error_terminal() {
#ifdef _WIN32
    return _isatty(_fileno(stderr)) != 0;
#else
    return ::isatty(fileno(stderr)) != 0;
#endif
}

#ifdef _WIN32
static void enable_windows_ansi() {
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

static std::string_view log_color(LogLevel level) {
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

void app::write_log(LogLevel level, std::string_view message) {
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
