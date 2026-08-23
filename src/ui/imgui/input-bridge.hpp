#pragma once

#include "../input/router.hpp"

namespace ui {
    struct ItemInputState {
        bool hovered = false;
        bool active = false;
        bool focused = false;
        bool registered = false;
        bool handled = false;
    };

    class ImGuiInputBridge {
    public:
        explicit ImGuiInputBridge(InputRouter& router) : m_router(router) {}

        [[nodiscard]] ItemInputState observe(Node& node);

    private:
        InputRouter& m_router;
    };
} // namespace ui
