#pragma once

#include "base/widget.hpp"
#include "base/text.hpp"

#include <functional>
#include <cstdint>

enum class NotificationType : int32_t {
    DEFAULT,
    ALERT,
    ERROR,
    ACTION
};

class UINotification : public UIWidget {
public:
    UINotification() : UIWidget("notification") {
        m_current_offset.speed = 0.0f;
        m_offset.speed = 20.0f;
    }

    virtual ~UINotification() = default;
    virtual void show() = 0;

    [[nodiscard]] virtual NotificationType get_type() const = 0;

    const UIWidgetVec2& get_offset() {
        return m_offset;
    }

    void set_offset(ImVec2 value) {
        m_offset.set(value);
    }

protected:
    UIWidgetVec2 m_offset;
    UIWidgetVec2 m_current_offset;
};

class DefaultNotificationWidget : public UINotification {
public:
    explicit DefaultNotificationWidget(std::string text);

    void show() override;

    [[nodiscard]] NotificationType get_type() const override {
        return m_type;
    }

    std::function<void(UINotification*)> m_onconfirm = nullptr;
    std::function<void(UINotification*)> m_oncancel = nullptr;

private:
    UIText<std::string> m_text;
    NotificationType m_type = NotificationType::DEFAULT;
};
