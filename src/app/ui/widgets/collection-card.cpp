#include "collection-card.hpp"
#include "../../../ui/ui.hpp"

constexpr float ALPHA_ANIM_SPEED = 8.0f;
constexpr ImVec2 ICON_SIZE = {16.0f, 16.0f};

CollectionCardWidget::CollectionCardWidget(UI& ui, std::string name)
    : ui::ChildContainer({}, ui::WidgetType::CollectionCard), m_ui(ui) {
    const ui::Theme& theme = m_ui.theme();
    auto music_icon = m_ui.get_texture("music-icon");

    set_font(m_ui.get_font(ui::FontType::SEMIBOLD).get(18));

    state().configure_all_styles([&](ui::Style& style) {
        style.padding({theme.content_padding, 0.0F})
            .border(ui::BORDER_ALL)
            .border_thickness(1.0F)
            .border_color(theme.transparent, ALPHA_ANIM_SPEED)
            .background_color(theme.transparent, ALPHA_ANIM_SPEED);
    });

    state().configure_style(ui::StyleType::ACTIVE, [&theme](ui::Style& style) {
        style.border_color(theme.accent_color, ALPHA_ANIM_SPEED).background_color(theme.button_active_color);
    });

    state().configure_style(ui::StyleType::HOVER, [&theme](ui::Style& style) {
        style.border_color(theme.accent_color, ALPHA_ANIM_SPEED);
    });

    m_icon = &add_child<ui::ImageWidget>();
    m_icon->set_texture(music_icon).set_size(ICON_SIZE);
    m_icon->state().configure_all_styles([&](ui::Style& style) { style.color(theme.accent_color); });
    m_icon->set_anchor(ui::Anchor::CenterLeft).set_origin(ui::Origin::CenterLeft);

    m_title = &add_child<ui::TextWidget>(std::move(name));
    m_title->set_anchor(ui::Anchor::CenterLeft)
        .set_origin(ui::Origin::CenterLeft)
        .set_offset({ICON_SIZE.x + 10.0F, 0.0F});

    m_count_label = &add_child<ui::TextWidget>("0 maps");
    m_count_label->set_font(m_ui.get_font(ui::FontType::SEMIBOLD).get(14));
    m_count_label->set_anchor(ui::Anchor::CenterRight).set_origin(ui::Origin::CenterRight);
}

void CollectionCardWidget::set_selected(bool value) {
    m_selected = value;
}

void CollectionCardWidget::toggle_selected() {
    m_selected = !m_selected;
}

bool CollectionCardWidget::is_selected() const {
    return m_selected;
}

std::optional<std::string> CollectionCardWidget::content() const {
    return m_title->content();
}

bool CollectionCardWidget::try_set_content(std::string content) {
    return m_title->try_set_content(std::move(content));
}

void CollectionCardWidget::set_count(std::string count) {
    (void)m_count_label->try_set_content(std::move(count));
}

void CollectionCardWidget::on_layout() {
    ImVec2 size = m_size;

    // collection card will always use the full width
    const ImVec2 available = ImGui::GetContentRegionAvail();
    size.x = available.x;
    layout().set_size(size);
}

void CollectionCardWidget::on_draw_end() {
    ui::ChildContainer::on_draw_end();

    const ui::ItemInputState input = m_ui.input().observe(*this);

    if (m_selected) {
        state().set_style(ui::StyleType::ACTIVE);
    } else {
        state().set_item_state(input.hovered, false);
    }
}
