#pragma once

#include <cstdint>

namespace ui {
    // identifies a node dispatch layer and its position in the ui.
    enum class InputLayer : uint8_t {
        Content,
        Overlay,
        Modal,
        Notification,
        Count,
    };
} // namespace ui
