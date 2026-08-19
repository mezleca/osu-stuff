#pragma once

#include <cstdint>

namespace ui {
    enum class InputLayer : uint8_t {
        Content,
        Overlay,
        Modal,
        Notification,
        Count,
    };
} // namespace ui
