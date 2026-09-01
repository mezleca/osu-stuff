#include "collection-card.hpp"
#include <ui/ui.hpp>

using namespace ui;

constexpr float ALPHA_ANIM_DURATION = 0.15F;
constexpr ImVec2 ICON_SIZE = {16.0f, 16.0f};

CollectionCardWidget::CollectionCardWidget(UI& ui, std::string name) : Container({}, "CollectionCard"), m_ui(ui) {
    set_input_mode(InputMode::Target);
    const Theme& theme = m_ui.theme();

    auto* music_icon = m_ui.runtime().textures().find("music-icon");

    set_font(m_ui.get_font("Torus SemiBold", 18));
    set_size({grow(), px(50.0F)});

    configure_all_styles([&theme](Style& style) {
        style.padding({theme.content_padding, 0.0F})
            .border(BORDER_ALL)
            .border_thickness(1.0F)
            .border_color(with_alpha(theme.accent_color, 0.0F), ALPHA_ANIM_DURATION)
            .background_color(with_alpha(theme.button_active_color, 0.0F), ALPHA_ANIM_DURATION);
    });

    configure_style(StyleType::ACTIVE, [&theme](Style& style) {
        style.border_color(theme.accent_color, ALPHA_ANIM_DURATION)
            .background_color(theme.button_active_color, ALPHA_ANIM_DURATION);
    });

    configure_style(StyleType::HOVER, [&theme](Style& style) { style.border_color(theme.accent_color, ALPHA_ANIM_DURATION); });

    m_icon = &add<ImageWidget>();
    m_icon->set_texture(music_icon)
        .set_layout({
            .size = {px(ICON_SIZE.x), px(ICON_SIZE.y)},
            .placement = {.anchor = Anchor::CenterLeft, .origin = Anchor::CenterLeft},
            .in_flow = false,
        });
    m_icon->configure_all_styles([&](Style& style) { style.color(theme.accent_color); });

    m_title = &add<TextWidget>(std::move(name));
    m_title->set_layout({
        .size = {fit(), fit()},
        .placement =
            {
                .anchor = Anchor::CenterLeft,
                .origin = Anchor::CenterLeft,
                .offset = {ICON_SIZE.x + 10.0F, 0.0F},
            },
        .in_flow = false,
    });

    m_count_label = &add<TextWidget>("0 maps");
    m_count_label->set_font(m_ui.get_font("Torus SemiBold", 14));
    m_count_label->set_layout({
        .size = {fit(), fit()},
        .placement = {.anchor = Anchor::CenterRight, .origin = Anchor::CenterRight},
        .in_flow = false,
    });
}

void CollectionCardWidget::set_selected(bool value) {
    if (m_selected == value) {
        return;
    }

    m_selected = value;
    if (m_selected) {
        set_visual_style(StyleType::ACTIVE);
        return;
    }

    const InputState& input = input_state();
    set_interaction_style(input.hovered, input.active, input.focused);
}

void CollectionCardWidget::toggle_selected() {
    set_selected(!m_selected);
}

bool CollectionCardWidget::is_selected() const {
    return m_selected;
}

void CollectionCardWidget::input_state_changed() {
    StyledNode::input_state_changed();
    if (m_selected) set_visual_style(StyleType::ACTIVE);
}

void CollectionCardWidget::set_text(std::string text) {
    m_title->set_text(std::move(text));
}

void CollectionCardWidget::set_count(std::string count) {
    m_count_label->set_text(std::move(count));
}
