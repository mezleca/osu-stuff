#pragma once

#include "base/widget.hpp"
#include "base/text.hpp"
#include "image.hpp"

#include <functional>
#include <cstdint>

enum class UINotificationType : int32_t {
    LOG,
    ACTION
};

class UINotification : public UIWidget {
public:
    UINotification(UINotificationType type) : UIWidget("notification"), m_type(type) {
        m_current_offset.speed = 0.0f;
        m_offset.speed = 20.0f;
    }

    virtual ~UINotification() = default;
    virtual void show() = 0;
    virtual void close() = 0;

    [[nodiscard]] UINotificationType get_type() const {
        return m_type;
    };

    const UIWidgetVec2& get_offset() {
        return m_offset;
    }

    const UIWidgetVec2& get_target_offset() {
        return m_current_offset;
    }

    void set_offset(ImVec2 value, bool instant = false) {
        m_offset.set(value);

        if (instant) {
            m_current_offset.set(value);
        }
    }

protected:
    UIWidgetVec2 m_offset;
    UIWidgetVec2 m_current_offset;
    UINotificationType m_type;
    bool m_closing = false;
};

enum class LogNotificationLevel : int32_t {
    INFO = 0,
    WARN,
    ERROR,
    PLACEHOLDER
};

class LogNotificationWidget : public UINotification {
public:
    explicit LogNotificationWidget(LogNotificationLevel level, std::string text);

    void show() override;
    void close() override;
    void set_text(std::string_view text) {
        m_text.set(text.data());
    }

    std::function<void()> m_onclick = nullptr;
    std::function<void()> m_onclose = nullptr;

private:
    UIImageWidget m_icon;
    UIText<std::string> m_text;
    LogNotificationLevel m_level;
};
