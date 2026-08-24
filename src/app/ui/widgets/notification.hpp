#pragma once

#include <ui/layout/child-container.hpp>
#include <ui/layout/overlay-container.hpp>
#include <ui/widgets/text.hpp>
#include <ui/widgets/image.hpp>

#include <functional>
#include <cstdint>
#include <string>
#include <string_view>

class UI;

class UINotification : public ui::ChildContainer {
public:
    explicit UINotification(UI& ui);

    float duration = 5.0F;
    bool persistent = true;

    [[nodiscard]] bool on_draw() override = 0;
    virtual void close() = 0;

    [[nodiscard]] const ui::Vec2Value& target_offset() const;
    [[nodiscard]] const ui::Vec2Value& current_offset() const;
    void set_overlay_position(ui::OverlayPosition position);
    UINotification& set_target_offset(ImVec2 value, bool instant = false);

protected:
    void on_update(float dt) override;
    void on_layout() override;

    UI& m_ui;
    ui::Vec2Value m_offset;
    ui::Vec2Value m_current_offset;
    float m_elapsed = 0.0F;
    bool m_closing = false;
    ui::OverlayPosition m_position = ui::OverlayPosition::RIGHT;
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
    LogNotificationWidget(UI& ui, LogNotificationLevel level, std::string text);

    [[nodiscard]] bool on_draw() override;
    void close() override;
    void set_text(std::string_view text);

    std::function<void()> m_onclose = nullptr;

private:
    static ImColor border_color(LogNotificationLevel level, ImColor accent_color);
    void on_measure() override;
    void draw_children() override;
    void on_draw_end() override;

    ui::ImageWidget* m_icon = nullptr;
    ui::TextWidget* m_text_node = nullptr;
    LogNotificationLevel m_level;
};
