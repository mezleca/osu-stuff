#include "notification.hpp"
#include "../theme.hpp"

#include <imgui-ui/runtime.hpp>
#include <imgui-ui/surface.hpp>
#include <algorithm>

using namespace ui;

static constexpr ImVec2 CLOSE_ICON_SIZE = {16, 16};

UINotification::UINotification() : Container({}, "Notification") {
    set_size({fit(), fit()});
    set_input_mode(InputMode::Target);
    m_offset.duration = 0.2F;
    update_layout_placement();
}

const Vec2Value& UINotification::target_offset() const {
    return m_offset;
}

const Vec2Value& UINotification::current_offset() const {
    return m_current_offset;
}

void UINotification::set_overlay_position(NotificationPosition position) {
    if (m_position == position) {
        return;
    }

    m_position = position;
    update_layout_placement();
    m_position_initialized = false;
}

UINotification& UINotification::set_target_offset(ImVec2 value, bool instant) {
    m_offset.set(value);

    if (instant) {
        m_current_offset.set(value);
        m_position_initialized = true;
    } else if (!m_position_initialized) {
        const float width = std::max(layout().size().x, 256.0F);
        const float direction = m_position == NotificationPosition::Left ? -1.0F : 1.0F;
        m_current_offset.set({value.x + (direction * (width + 16.0F)), value.y});
        m_position_initialized = true;
    }

    update_layout_placement();

    return *this;
}

void UINotification::on_update(float dt) {
    m_current_offset.tick(m_offset, dt);
    update_layout_placement();

    if (persistent || m_closing) {
        return;
    }

    m_elapsed += dt;
    if (m_elapsed >= duration) {
        close();
    }
}

void UINotification::update_layout_placement() {
    const ImVec2 anchor = m_position == NotificationPosition::Left ? Anchor::TopLeft : Anchor::TopRight;
    const ImVec2 origin = anchor;
    const LayoutConfig& current = layout().config();
    const Placement& placement = current.placement;
    if (!current.in_flow && placement.anchor.x == anchor.x && placement.anchor.y == anchor.y &&
        placement.origin.x == origin.x && placement.origin.y == origin.y && placement.offset.x == m_current_offset.value.x &&
        placement.offset.y == m_current_offset.value.y) {
        return;
    }

    LayoutConfig config = current;
    config.in_flow = false;
    config.placement = {.anchor = anchor, .origin = origin, .offset = m_current_offset.value};
    set_layout(config);
}

void UINotification::on_draw_end() {
    Container::on_draw_end();

    // block pointer targets behind this notification without restricting keyboard input to its subtree.
    if (accepts_input()) surface().input_router().register_blocker(*this, layout().visual_rect());
}

Color LogNotificationWidget::border_color(LogNotificationLevel level, const Color& accent_color) {
    switch (level) {
        case LogNotificationLevel::INFO:
            return COLOR_BLUE;
        case LogNotificationLevel::ERROR:
            return COLOR_RED;
        case LogNotificationLevel::WARN:
            return COLOR_YELLOW;
        case LogNotificationLevel::PLACEHOLDER:
            return accent_color;
    }

    return accent_color;
}

LogNotificationWidget::LogNotificationWidget(LogNotificationLevel level, std::string text) : m_level(level) {
    set_type_name("LogNotification");

    m_text_node = &add<TextWidget>(std::move(text));

    m_icon = &add<ImageWidget>();
    m_icon->set_input_mode(InputMode::Target);
    m_icon->set_layout({
        .size = {px(CLOSE_ICON_SIZE.x), px(CLOSE_ICON_SIZE.y)},
        .placement = {.anchor = Anchor::CenterLeft, .origin = Anchor::CenterLeft},
        .in_flow = false,
    });

    m_icon->on_event([this](UiEvent& event) {
        if (event.type != EventType::Click) {
            return;
        }

        if (m_onclose) {
            m_onclose();
        } else {
            close();
        }

        event.mark_handled();
    });
}

void LogNotificationWidget::apply_theme_defaults(const Theme& theme) {
    Surface& ui = surface();
    ImFont* font = ui.get_font("Torus SemiBold");
    const Color level_border_color = border_color(m_level, theme.accent_color);

    configure_all_styles([&theme](Style& style) {
        style.color(theme.text_color)
            .border_color(theme.border_color, 0.15F)
            .background_color(theme.background_color)
            .padding({8.0F, 16.0F})
            .border_radius(4.0F)
            .border(BorderEdge{1.0F, BorderType::Solid});
    });
    style(StyleType::HOVER).border_color(level_border_color);
    style(StyleType::ACTIVE).border_color(level_border_color);

    set_font(font, 16.0F);
    m_text_node->set_font(font, 16.0F);
    // reserve the frame insets and close icon before measuring wrapped text.
    const float icon_width = m_level == LogNotificationLevel::PLACEHOLDER ? 0.0F : CLOSE_ICON_SIZE.x + 5.0F;
    const float frame_inset = (computed_style().padding().left + computed_style().border_thickness()) * 2.0F;
    m_text_node->set_wrap(256.0F - frame_inset - icon_width);
    m_icon->set_texture(ui.runtime().textures().find("x-icon"));
    m_icon->configure_all_styles([&theme](Style& style) { style.color(theme.text_secondary_color); });
}

void LogNotificationWidget::close() {
    if (m_closing) {
        return;
    }

    m_closing = true;

    set_opacity(0.0f);
    m_icon->set_opacity(0.0f);
}

void LogNotificationWidget::set_text(std::string_view text) {
    m_text_node->set_text(std::string{text});
}

void LogNotificationWidget::on_measure() {
    const ImVec2 text_size = m_text_node->layout().intrinsic_size();
    auto icon_layout = m_icon->layout().config();
    icon_layout.placement.offset = {text_size.x + 5.0F, 0.0F};
    m_icon->set_layout(icon_layout);

    const float icon_width = m_level == LogNotificationLevel::PLACEHOLDER ? 0.0F : CLOSE_ICON_SIZE.x + 5.0F;
    const ImVec2 size = outer_size(
        {text_size.x + icon_width, std::max(text_size.y, m_level == LogNotificationLevel::PLACEHOLDER ? 0.0F : CLOSE_ICON_SIZE.y)}
    );
    set_measured_size({std::clamp(size.x, 48.0F, 256.0F), std::clamp(size.y, 48.0F, 196.0F)});
}

bool LogNotificationWidget::paint() {
    return Container::paint();
}

void LogNotificationWidget::draw_children() {
    m_text_node->draw();

    if (m_level == LogNotificationLevel::PLACEHOLDER) {
        return;
    }

    m_icon->draw();
}

void LogNotificationWidget::on_draw_end() {
    UINotification::on_draw_end();

    if (m_closing) {
        set_enabled(false);
        set_interaction_style(false, false);
    }
}
