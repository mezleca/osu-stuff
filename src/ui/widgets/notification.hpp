#pragma once

#include "widget.hpp"

#include <functional>
#include <cstdint>

enum class NotificationType : int32_t {
    DEFAULT,
    ALERT,
    ERROR,
    ACTION
};

struct NotificationState : public WidgetState {
    explicit NotificationState();

    ImFont* m_font;
    ImVec2 m_size = {64.0f, 64.0f};
};

class UINotification {
public:
    virtual ~UINotification() = default;

    virtual void render() = 0;
    [[nodiscard]] virtual NotificationType get_type() const = 0;

    NotificationState m_state;
};

class DefaultNotification : public UINotification, public UIWidget {
public:
    explicit DefaultNotification(UI* ui, std::string text);

    void render() override;
    [[nodiscard]] NotificationType get_type() const override {
        return m_type;
    }

    std::function<void(UINotification*)> m_onconfirm = nullptr;
    std::function<void(UINotification*)> m_oncancel = nullptr;

private:
    UIText<std::string> m_text;
    NotificationType m_type = NotificationType::DEFAULT;
};
