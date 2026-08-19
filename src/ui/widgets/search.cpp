#include "search.hpp"
#include "../ui.hpp"
#include "../style/theme.hpp"

#include <imgui_stdlib.h>

static constexpr float ALPHA_ANIM_SPEED = 12.0f;

namespace ui {
    SearchInputWidget::SearchInputWidget(UI& ui, std::string& value) : ChildContainer({}), m_value(&value), m_ui(ui) {
        set_widget_type(WidgetType::SearchInput);

        set_font(ui.get_font(FontType::SEMIBOLD).get(18));
        set_accepts_focus(true);

        const Theme& theme = m_ui.theme();
        auto search_icon = ui.get_texture("search-icon");

        m_icon = &add_child<ImageWidget>();
        m_icon->set_texture(search_icon).set_size({18.0F, 18.0F});
        m_icon->set_anchor(Anchor::CenterLeft).set_origin(Origin::CenterLeft);

        m_icon->state().configure_all_styles([](Style& style) { style.color({120, 120, 120, 255}, ALPHA_ANIM_SPEED); });
        m_icon->state().configure_style(StyleType::HOVER, [](Style& style) { style.color({200, 200, 200, 255}); });
        m_icon->state().configure_style(StyleType::ACTIVE, [](Style& style) { style.color({200, 200, 200, 255}); });

        m_input = &add_child<TextInputWidget>(m_ui, *m_value, "##search-input-field");
        m_input->set_anchor(Anchor::TopLeft).set_origin(Origin::TopLeft).set_offset({m_icon->size().x + 10.0F, 0.0F});

        state().configure_all_styles([&theme](Style& style) {
            style.border_color(theme.border_color, ALPHA_ANIM_SPEED * 2.0F)
                .padding({12.0F, 14.0F})
                .background_color(theme.background_secondary_color)
                .border(BORDER_ALL)
                .border_radius(theme.box_rounding);
        });

        state().configure_style(StyleType::ACTIVE, [&theme](Style& style) { style.border_color(theme.accent_color); });
        state().configure_style(StyleType::HOVER, [&theme](Style& style) { style.border_color(theme.accent_color); });

        m_input->state().configure_all_styles([&theme](Style& style) { style.background_color(theme.transparent); });
    }

    void SearchInputWidget::set_fit_width(bool value) {
        m_fit_width = value;
    }

    std::optional<std::string> SearchInputWidget::get_content() const {
        return m_value == nullptr ? std::nullopt : std::optional<std::string>{*m_value};
    }

    bool SearchInputWidget::set_content(std::string content) {
        if (m_value == nullptr || *m_value == content) {
            return false;
        }

        *m_value = std::move(content);
        return true;
    }

    void SearchInputWidget::on_layout() {
        ImVec2 size = layout().size();

        if (m_fit_width || size.x <= 0.0F) {
            size.x = ImGui::GetContentRegionAvail().x;
        }

        layout().set_size(size);
    }

    void SearchInputWidget::on_draw_end() {
        const ItemInputState& input = m_input->input_state();
        apply_input_state(input);
        m_icon->state().set_item_state(input.hovered, input.active);
        ChildContainer::on_draw_end();
    }

} // namespace ui
