#pragma once

#include <cstdint>
#include <string_view>

namespace ui {
    enum class WidgetType : uint8_t {
        Unknown,
        Button,
        Text,
        TextInput,
        NumberInput,
        Range,
        Dropdown,
        Checkbox,
        Image,
        Line,
        ChildContainer,
        StackContainer,
        ResizableContainer,
        ModalPanel,
        TabButton,
        CollectionCard,
        Notification,
        LogNotification,
    };

    [[nodiscard]] inline constexpr std::string_view widget_type_to_string(WidgetType type) {
        switch (type) {
            case WidgetType::Button:
                return "Button";
            case WidgetType::Text:
                return "Text";
            case WidgetType::TextInput:
                return "TextInput";
            case WidgetType::NumberInput:
                return "NumberInput";
            case WidgetType::Range:
                return "Range";
            case WidgetType::Dropdown:
                return "Dropdown";
            case WidgetType::Checkbox:
                return "Checkbox";
            case WidgetType::Image:
                return "Image";
            case WidgetType::Line:
                return "Line";
            case WidgetType::ChildContainer:
                return "ChildContainer";
            case WidgetType::StackContainer:
                return "StackContainer";
            case WidgetType::ResizableContainer:
                return "ResizableContainer";
            case WidgetType::ModalPanel:
                return "ModalPanel";
            case WidgetType::TabButton:
                return "TabButton";
            case WidgetType::CollectionCard:
                return "CollectionCard";
            case WidgetType::Notification:
                return "Notification";
            case WidgetType::LogNotification:
                return "LogNotification";
            case WidgetType::Unknown:
                return "Unknown";
        }

        return "Unknown";
    }
} // namespace ui
