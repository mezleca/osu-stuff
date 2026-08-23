#include "notification.hpp"
#include "../../../ui/ui.hpp"
#include "../theme.hpp"

#include <algorithm>

static constexpr ImVec2 CLOSE_ICON_SIZE = {16, 16};

UINotification::UINotification(UI& ui) : ui::ChildContainer({}, ui::WidgetType::Notification), m_ui(ui) {
    m_offset.speed = 20.0F;
    layout().set_anchor(ui::Anchor::TopRight);
    layout().set_origin(ui::Origin::TopRight);
}

const ui::Vec2Value& UINotification::target_offset() const {
    return m_offset;
}

const ui::Vec2Value& UINotification::current_offset() const {
    return m_current_offset;
}

void UINotification::set_overlay_position(ui::OverlayPosition position) {
    if (m_position == position) {
        return;
    }

    m_position = position;
    const ui::Anchor anchor = position == ui::OverlayPosition::LEFT ? ui::Anchor::TopLeft : ui::Anchor::TopRight;
    layout().set_anchor(anchor);
    layout().set_origin(anchor == ui::Anchor::TopLeft ? ui::Origin::TopLeft : ui::Origin::TopRight);
    m_position_initialized = false;
}

UINotification& UINotification::set_offset(ImVec2 value, bool instant) {
    m_offset.set(value);

    if (instant) {
        m_current_offset.set(value);
        m_position_initialized = true;
    } else if (!m_position_initialized) {
        const float width = std::max(layout().size().x, 256.0F);
        const float direction = m_position == ui::OverlayPosition::LEFT ? -1.0F : 1.0F;
        m_current_offset.set({value.x + direction * (width + 16.0F), value.y});
        m_position_initialized = true;
    }

    return *this;
}

void UINotification::on_layout() {
    layout().set_offset(m_current_offset.value);
}

ImColor LogNotificationWidget::border_color(LogNotificationLevel level, ImColor accent_color) {
    switch (level) {
        case LogNotificationLevel::INFO:
            return app_theme::BLUE;
        case LogNotificationLevel::ERROR:
            return app_theme::RED;
        case LogNotificationLevel::WARN:
            return app_theme::YELLOW;
        case LogNotificationLevel::PLACEHOLDER:
            return accent_color;
    }

    return accent_color;
}

LogNotificationWidget::LogNotificationWidget(UI& ui, LogNotificationLevel level, std::string text)
    : UINotification(ui), m_level(level) {
    set_widget_type(ui::WidgetType::LogNotification);
    ui::Style& hover_style = state().style(ui::StyleType::HOVER);
    ui::Style& active_style = state().style(ui::StyleType::ACTIVE);

    const ui::Theme& theme = m_ui.theme();
    auto* close_icon = m_ui.get_texture("x-icon");
    ImFont* torus_semi = m_ui.get_font(ui::FontType::SEMIBOLD).get(16);

    state().configure_all_styles([&theme](ui::Style& style) {
        style.color(theme.text_color)
            .border_color(theme.border_color, 20.0F)
            .background_color(theme.background_color)
            .padding({8.0F, 16.0F})
            .border_radius(4.0F)
            .border_thickness(1.0F)
            .border(ui::BORDER_NONE);
    });

    set_font(torus_semi);
    state().fade_in();

    const ImColor level_border_color = border_color(m_level, theme.accent_color);

    active_style.border_color(level_border_color);
    hover_style.border_color(level_border_color);

    m_text_node = &add_child<ui::TextWidget>(std::move(text));
    m_text_node->set_font(torus_semi);

    m_icon = &add_child<ui::ImageWidget>();
    m_icon->set_texture(close_icon);
    m_icon->set_size(CLOSE_ICON_SIZE);
    m_icon->layout().set_anchor(ui::Anchor::CenterLeft);
    m_icon->layout().set_origin(ui::Origin::CenterLeft);

    m_icon->state().configure_all_styles([&theme](ui::Style& style) { style.color(theme.text_secondary_color); });

    m_icon->on_event = [this](ui::UiEvent& event) {
        if (event.type != ui::EventType::Click) {
            return;
        }

        if (m_onclose) {
            m_onclose();
        } else {
            close();
        }

        event.mark_handled();
    };
}

void LogNotificationWidget::close() {
    if (m_closing) {
        return;
    }

    m_closing = true;

    state().set_opacity(0.0f);
    m_icon->state().set_opacity(0.0f);
}

void LogNotificationWidget::set_text(std::string_view text) {
    static_cast<void>(m_text_node->try_set_content(std::string{text}));
}

void LogNotificationWidget::on_layout() {
    UINotification::on_layout();
    update_content_layout();
}

void LogNotificationWidget::update_content_layout() {
    const ui::Style& current_style = state().style();
    const ImVec2 padding = current_style.padding();
    const float wrap_pos_x = 256.0F - CLOSE_ICON_SIZE.x - 8.0F;

    m_text_node->set_wrap(wrap_pos_x);
    m_text_node->update_layout_size();
    m_icon->layout().set_offset({m_text_node->layout().size().x + 5.0F, 0.0F});

    const ImVec2 text_size = m_text_node->layout().size();
    const float icon_width = m_level == LogNotificationLevel::PLACEHOLDER ? 0.0F : CLOSE_ICON_SIZE.x + 5.0F;
    const float content_width = text_size.x + icon_width + padding.x * 2.0F;
    const float content_height =
        std::max(text_size.y, m_level == LogNotificationLevel::PLACEHOLDER ? 0.0F : CLOSE_ICON_SIZE.y) +
        padding.y * 2.0F;

    layout().set_size({
        std::clamp(content_width, 48.0F, 256.0F),
        std::clamp(content_height, 48.0F, 196.0F),
    });
}

bool LogNotificationWidget::on_draw() {
    if (m_closing && !state().is_visible()) {
        return false;
    }

    const ui::Style& style = state().style();

    ImGui::SetNextWindowSizeConstraints({48.0f, 48.0f}, {256.0f, 196.0f});
    ImGui::PushStyleColor(ImGuiCol_Text, style.color().get_col());
    const bool opened = ui::ChildContainer::on_draw();
    return opened;
}

void LogNotificationWidget::draw_children() {
    m_text_node->draw();

    if (m_level == LogNotificationLevel::PLACEHOLDER) {
        return;
    }

    m_icon->draw();

    const bool handled = m_ui.input().handle(*m_icon).handled;
    static_cast<void>(handled);
}

void LogNotificationWidget::on_draw_end() {
    const ui::Style& style = state().style();
    const float dt = ImGui::GetIO().DeltaTime;

    const ImVec2 child_position = ImGui::GetWindowPos();
    const ImVec2 child_window_size = ImGui::GetWindowSize();
    const ImVec2 child_max = {
        child_position.x + child_window_size.x,
        child_position.y + child_window_size.y,
    };

    ImGui::GetWindowDrawList()->AddRect(
        child_position, child_max, style.border_color().get_col(), style.border_radius(), 0, style.border_thickness()
    );

    ui::ChildContainer::on_draw_end();

    const ui::Rect child_rect = rect();
    const ImVec2 child_size = child_rect.size();

    ImGui::PopStyleColor();

    const ui::ItemInputState input = m_ui.input().handle(*this);

    if (m_closing) {
        state().set_item_state(false, false);
    } else {
        apply_input_state(input);
    }

    m_current_offset.tick(m_offset, dt);
    ImGui::Dummy(child_size);
}
