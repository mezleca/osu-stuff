#pragma once

#include "../../../ui/widgets/base/widget.hpp"
#include "../../../ui/widgets/base/text.hpp"
#include "../../../ui/widgets/cached-text.hpp"
#include "../../../ui/widgets/image.hpp"

#include <functional>
#include <cstdint>

enum class UINotificationType : int32_t {
    LOG,
    ACTION
};

class UINotification : public ui::Widget {
public:
    UINotification(UINotificationType type) : ui::Widget("notification"), m_type(type) {
        m_current_offset.speed = 0.0f;
        m_offset.speed = 20.0f;
        layout().set_anchor(ui::Anchor::TopRight);
        layout().set_origin(ui::Origin::TopRight);
    }

    virtual ~UINotification() = default;
    void on_draw() override = 0;
    virtual void close() = 0;

    [[nodiscard]] UINotificationType get_type() const {
        return m_type;
    };

    const ui::Vec2Value& get_offset() {
        return m_offset;
    }

    const ui::Vec2Value& get_target_offset() {
        return m_current_offset;
    }

    void set_offset(ImVec2 value, bool instant = false) {
        m_offset.set(value);

        if (instant) {
            m_current_offset.set(value);
        }
    }

protected:
    void on_layout() override;

    ui::Vec2Value m_offset;
    ui::Vec2Value m_current_offset;
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

    void on_draw() override;
    void close() override;
    void set_text(std::string_view text) {
        m_text.set(std::string{text});
    }

    std::function<void()> m_onclose = nullptr;

private:
    void on_layout() override;
    void draw_children() override;
    void on_draw_end() override;

    ui::ImageWidget* m_icon = nullptr;
    ui::CachedTextNode* m_text_node = nullptr;
    ui::TextValue<std::string> m_text;
    LogNotificationLevel m_level;
};
