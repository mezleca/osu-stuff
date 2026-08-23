#pragma once

#include <imgui.h>

#include <string>

namespace ui {
    enum class EventType {
        PointerMove,
        PointerDown,
        PointerUp,
        Click,
        ContextClick,
        Scroll,
        KeyDown,
        KeyUp,
        TextInput,
        FocusGained,
        FocusLost,
        Cancel,
    };

    enum class PointerButton {
        None,
        Left,
        Right,
        Middle,
    };

    inline std::string event_type_to_string(EventType type) {
        switch (type) {
            case EventType::PointerMove:
                return "PointerMove";
            case EventType::PointerDown:
                return "PointerDown";
            case EventType::PointerUp:
                return "PointerUp";
            case EventType::Click:
                return "Click";
            case EventType::ContextClick:
                return "ContextClick";
            case EventType::Scroll:
                return "Scroll";
            case EventType::KeyDown:
                return "KeyDown";
            case EventType::KeyUp:
                return "KeyUp";
            case EventType::TextInput:
                return "TextInput";
            case EventType::FocusGained:
                return "FocusGained";
            case EventType::FocusLost:
                return "FocusLost";
            case EventType::Cancel:
                return "Cancel";
        }

        return "Unknown";
    }

    struct UiEvent {
        EventType type;
        ImVec2 position{};
        ImVec2 scroll{};
        PointerButton button = PointerButton::None;
        int key = 0;
        std::string text;
        bool handled = false;
        bool propagation_stopped = false;
        bool default_prevented = false;

        static UiEvent make(EventType type) {
            return {
                .type = type,
                .position = {},
                .scroll = {},
                .button = PointerButton::None,
                .key = 0,
                .text = {},
                .handled = false,
                .propagation_stopped = false,
                .default_prevented = false,
            };
        }

        void mark_handled() {
            handled = true;
        }

        void stop_propagation() {
            handled = true;
            propagation_stopped = true;
        }

        void prevent_default() {
            default_prevented = true;
        }
    };

} // namespace ui
