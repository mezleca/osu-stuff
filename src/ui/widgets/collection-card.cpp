#include "collection-card.hpp"
#include <ui/ui.hpp>

using namespace app;

constexpr float ALPHA_ANIM_DURATION = 0.15F;
constexpr ImVec2 ICON_SIZE = {16.0f, 16.0f};

CollectionCardWidget::CollectionCardWidget(UI& ui, std::string name) : ui::ChildContainer({}, "CollectionCard"), m_ui(ui) {
    set_input_target();
    const ui::Theme& theme = m_ui.theme();

    auto music_icon = m_ui.find_texture("music-icon");

    set_font(m_ui.get_font(ui::FontType::SEMIBOLD).get(18));
    set_size({0.0F, 50.0F});

    configure_all_styles([&theme](ui::Style& style) {
        style.padding({theme.content_padding, 0.0F})
            .border(ui::BORDER_ALL)
            .border_thickness(1.0F)
            .border_color(ui::with_alpha(theme.accent_color, 0.0F), ALPHA_ANIM_DURATION)
            .background_color(ui::with_alpha(theme.button_active_color, 0.0F), ALPHA_ANIM_DURATION);
    });

    configure_style(ui::StyleType::ACTIVE, [&theme](ui::Style& style) {
        style.border_color(theme.accent_color, ALPHA_ANIM_DURATION)
            .background_color(theme.button_active_color, ALPHA_ANIM_DURATION);
    });

    configure_style(ui::StyleType::HOVER, [&theme](ui::Style& style) {
        style.border_color(theme.accent_color, ALPHA_ANIM_DURATION);
    });

    m_icon = &add_child<ui::ImageWidget>();
    m_icon->set_texture(music_icon).set_size(ICON_SIZE);
    m_icon->set_anchor(ui::Anchor::CenterLeft).set_origin(ui::Origin::CenterLeft);
    m_icon->configure_all_styles([&](ui::Style& style) { style.color(theme.accent_color); });

    m_title = &add_child<ui::TextWidget>(std::move(name));
    m_title->set_anchor(ui::Anchor::CenterLeft).set_origin(ui::Origin::CenterLeft).set_offset({ICON_SIZE.x + 10.0F, 0.0F});

    m_count_label = &add_child<ui::TextWidget>("0 maps");
    m_count_label->set_font(m_ui.get_font(ui::FontType::SEMIBOLD).get(14));
    m_count_label->set_anchor(ui::Anchor::CenterRight).set_origin(ui::Origin::CenterRight);
}

void CollectionCardWidget::set_selected(bool value) {
    if (m_selected == value) {
        return;
    }

    m_selected = value;
    if (m_selected) {
        set_visual_style(ui::StyleType::ACTIVE);
        return;
    }

    const ui::InputState& input = input_state();
    set_interaction_style(input.hovered, input.active, input.focused);
}

void CollectionCardWidget::toggle_selected() {
    set_selected(!m_selected);
}

bool CollectionCardWidget::is_selected() const {
    return m_selected;
}

void CollectionCardWidget::input_state_changed() {
    ui::ChildContainer::input_state_changed();
    if (m_selected) {
        set_visual_style(ui::StyleType::ACTIVE);
    }
}

void CollectionCardWidget::set_text(std::string text) {
    m_title->set_text(std::move(text));
}

void CollectionCardWidget::set_count(std::string count) {
    m_count_label->set_text(std::move(count));
}
