#pragma once

#include <ui/layout/container.hpp>
#include <ui/widgets/text.hpp>
#include <ui/widgets/image.hpp>

#include <functional>
#include <cstdint>
#include <string>
#include <string_view>

namespace ui {
    class UI;
}

enum class NotificationPosition {
    Left,
    Right,
};

class UINotification : public ui::Container {
public:
    explicit UINotification(ui::UI& ui);

    float duration = 5.0F;
    bool persistent = true;

    virtual void close() = 0;

    [[nodiscard]] const ui::Vec2Value& target_offset() const;
    [[nodiscard]] const ui::Vec2Value& current_offset() const;
    void set_overlay_position(NotificationPosition position);
    UINotification& set_target_offset(ImVec2 value, bool instant = false);

protected:
    void on_update(float dt) override;

    void update_layout_placement();

    ui::UI& m_ui;
    ui::Vec2Value m_offset;
    ui::Vec2Value m_current_offset;
    float m_elapsed = 0.0F;
    bool m_closing = false;
    NotificationPosition m_position = NotificationPosition::Right;
    bool m_position_initialized = false;
};

enum class LogNotificationLevel : int32_t {
    INFO = 0,
    WARN,
    ERROR,
    PLACEHOLDER
};

class LogNotificationWidget : public UINotification {
public:
    LogNotificationWidget(ui::UI& ui, LogNotificationLevel level, std::string text);

    void close() override;
    void set_text(std::string_view text);

    std::function<void()> m_onclose = nullptr;

private:
    static ImColor border_color(LogNotificationLevel level, ImColor accent_color);
    bool paint() override;
    void on_measure() override;
    void draw_children() override;
    void on_draw_end() override;

    ui::ImageWidget* m_icon = nullptr;
    ui::TextWidget* m_text_node = nullptr;
    LogNotificationLevel m_level;
};
