#include "context-menu.hpp"

#include <ui/style/theme.hpp>
#include <ui/ui.hpp>
#include <ui/widgets/button.hpp>
#include <ui/widgets/image.hpp>

#include <numbers>
#include <utility>

constexpr float MENU_WIDTH = 184.0F;
constexpr float MENU_ITEM_HEIGHT = 28.0F;
constexpr float MENU_PADDING = 4.0F;
constexpr float MENU_GAP = 6.0F;
constexpr float MENU_ARROW_WIDTH = 20.0F;
constexpr float MENU_ARROW_SIZE = 12.0F;
constexpr float SUBMENU_OPEN_DELAY = 0.1F;
constexpr float MENU_CLOSE_DELAY = 0.5F;

constexpr float menu_height(std::size_t item_count) {
    return MENU_PADDING * 2.0F + MENU_ITEM_HEIGHT * static_cast<float>(item_count);
}

class ContextMenuField final : public ui::StackContainer {
public:
    ContextMenuField(UI& ui, ContextMenuWidget& menu, std::string text, ContextMenuCallback callback, IconTexture* submenu_icon)
        : StackContainer({}, ui::StackDirection::Horizontal), m_menu(menu), m_callback(std::move(callback)) {
        const ui::Theme& theme = ui.theme();

        set_size({0.0F, MENU_ITEM_HEIGHT});

        configure_all_styles([&theme](ui::Style& style) {
            style.background_color(theme.transparent, 0.0F).padding({0.0F, 0.0F}).border(ui::BORDER_NONE).border_radius(2.0F);
        });

        configure_style(ui::StyleType::HOVER, [&theme](ui::Style& style) { style.background_color(theme.control_hover_color); });

        auto& label = add_child<ui::ButtonWidget>(ui, std::move(text), ImVec2{0.0F, MENU_ITEM_HEIGHT});

        label.set_text_alignment({0.0F, 0.5F});
        label.configure_all_styles([&theme](ui::Style& style) {
            style.color(theme.text_color).background_color(theme.transparent, 0.0F).padding({8.0F, 4.0F}).border(ui::BORDER_NONE);
        });

        on_event = [this](ui::UiEvent& event) {
            if (event.type != ui::EventType::Click) {
                return;
            }

            m_menu.activate_item(*this);
            event.mark_handled();
        };

        if (submenu_icon != nullptr) {
            auto& arrow = add_child<ui::ImageWidget>(submenu_icon);

            arrow.set_size({MENU_ARROW_WIDTH, MENU_ITEM_HEIGHT});
            arrow.set_rotation(std::numbers::pi_v<float> * 0.5F);
            arrow.set_enabled(false);
            arrow.configure_all_styles([&theme](ui::Style& style) {
                style.color(theme.text_color)
                    .background_color(theme.transparent, 0.0F)
                    .padding({(MENU_ARROW_WIDTH - MENU_ARROW_SIZE) * 0.5F, (MENU_ITEM_HEIGHT - MENU_ARROW_SIZE) * 0.5F})
                    .border(ui::BORDER_NONE);
            });
        }
    }

private:
    friend class ContextMenuWidget;

    ContextMenuWidget& m_menu;
    ContextMenuCallback m_callback;
    ContextMenuWidget* m_submenu = nullptr;
};

ContextMenuWidget::ContextMenuWidget(UI& ui, ContextMenuList items) : StackContainer({}, ui::StackDirection::Vertical), m_ui(ui) {
    set_size({MENU_WIDTH, menu_height(items.size())});
    set_visible(false);
    set_enabled(false);
    set_input_layer(ui::InputLayer::Overlay);
    set_opacity(0.0F);

    const ui::Theme& theme = m_ui.theme();
    configure_all_styles([&theme](ui::Style& style) {
        style.padding({MENU_PADDING, MENU_PADDING})
            .border(ui::BORDER_ALL)
            .border_thickness(1.0F)
            .border_radius(theme.box_rounding)
            .border_color(theme.border_color, 0.20F)
            .background_color(theme.background_color, 0.20F);
    });

    build(std::move(items));
}

bool ContextMenuWidget::build(ContextMenuList items) {
    m_fields.clear();
    clear();
    set_size({MENU_WIDTH, menu_height(items.size())});

    for (ContextMenuItem& item : items) {
        IconTexture* submenu_icon = item.children.empty() ? nullptr : m_ui.get_texture("chevron-icon");
        auto& field = add_child<ContextMenuField>(m_ui, *this, std::move(item.name), std::move(item.on_click), submenu_icon);
        m_fields.push_back(&field);

        if (item.children.empty()) {
            continue;
        }

        auto submenu = std::make_unique<ContextMenuWidget>(m_ui, std::move(item.children));
        submenu->m_parent_menu = this;
        submenu->set_placement(ui::Anchor::TopLeft, ui::Origin::TopLeft);
        field.m_submenu = submenu.get();
        add_child(std::move(submenu));
    }

    return !items.empty();
}

void ContextMenuWidget::show() {
    if (m_parent_menu == nullptr) {
        show(m_ui.mouse_position());
        return;
    }

    open();
}

void ContextMenuWidget::show(ImVec2 screen_position) {
    const ui::Rect work_area = m_ui.work_area();
    const ImVec2 position = ui::clamp_position(work_area, requested_size(), screen_position);

    set_placement(ui::Anchor::TopLeft, ui::Origin::TopLeft, {position.x - work_area.min.x, position.y - work_area.min.y});
    open();
}

void ContextMenuWidget::open() {
    if (m_open) {
        return;
    }

    m_close_requested = false;
    m_outside_duration = 0.0F;
    m_open = true;

    set_visible(true);
    set_enabled(true);
    fade_in();
}

void ContextMenuWidget::hide() {
    if (!m_open || m_close_requested) {
        return;
    }

    m_open = false;
    m_close_requested = true;
    m_hovered_field = nullptr;
    m_hover_target = nullptr;
    m_hover_duration = 0.0F;

    set_enabled(false);
    fade_out();
    close_children();
}

void ContextMenuWidget::cancel_close_request() {
    ContextMenuWidget& root = root_menu();
    if (!root.m_close_requested) {
        return;
    }

    root.open();
}

void ContextMenuWidget::on_update(float dt) {
    if (m_close_requested && opacity() <= ui::VISIBILITY_OPACITY_THRESHOLD) {
        m_close_requested = false;
        set_visible(false);
        set_opacity(0.0F);
    }

    if (m_hovered_field != m_hover_target) {
        m_hover_target = m_hovered_field;
        m_hover_duration = 0.0F;
    }

    if (m_hover_target != nullptr && m_hover_duration < SUBMENU_OPEN_DELAY) {
        m_hover_duration += dt;
        if (m_hover_duration >= SUBMENU_OPEN_DELAY) {
            open_submenu(*m_hover_target);
        }
    }

    if (m_parent_menu != nullptr || !m_open) {
        return;
    }

    if (contains(m_ui.mouse_position())) {
        m_outside_duration = 0.0F;
        return;
    }

    m_outside_duration += dt;
    if (m_outside_duration >= MENU_CLOSE_DELAY) {
        hide();
    }
}

void ContextMenuWidget::draw_children() {
    m_hovered_field = nullptr;
    const ImVec2 mouse_position = m_ui.mouse_position();

    for (ContextMenuField* field : m_fields) {
        field->draw();
        const bool hovered = field->layout().screen_rect().contains(mouse_position);
        field->set_interaction_style(hovered, false);
        if (hovered) m_hovered_field = field;
    }
}

void ContextMenuWidget::on_draw_end() {
    ui::ChildContainer::on_draw_end();

    for (ContextMenuField* field : m_fields) {
        if (field->m_submenu == nullptr) {
            continue;
        }

        ContextMenuWidget& submenu = *field->m_submenu;
        if (!submenu.visible()) {
            continue;
        }

        position_submenu(submenu, *field);
        submenu.draw();
    }
}

void ContextMenuWidget::activate_item(ContextMenuField& field) {
    if (field.m_submenu != nullptr) {
        open_submenu(field);
        return;
    }

    ContextMenuWidget& root = root_menu();
    root.hide();
    if (field.m_callback) field.m_callback(root);
}

void ContextMenuWidget::open_submenu(ContextMenuField& field) {
    for (ContextMenuField* sibling : m_fields) {
        if (sibling != &field && sibling->m_submenu != nullptr) {
            sibling->m_submenu->hide();
        }
    }

    if (field.m_submenu != nullptr) {
        field.m_submenu->show();
    }
}

void ContextMenuWidget::position_submenu(ContextMenuWidget& submenu, const ui::Node& field) {
    const ui::Rect field_rect = field.layout().screen_rect();
    const ui::Rect work_area = m_ui.work_area();
    const ImVec2 submenu_size = submenu.requested_size();

    float screen_x = field_rect.max.x + MENU_GAP;
    if (screen_x + submenu_size.x > work_area.max.x) {
        screen_x = field_rect.min.x - submenu_size.x - MENU_GAP;
    }

    const ImVec2 position = ui::clamp_position(work_area, submenu_size, {screen_x, field_rect.min.y});

    arrange_child_at_screen(submenu, submenu_size, position);
}

ContextMenuWidget& ContextMenuWidget::root_menu() {
    ContextMenuWidget* root = this;
    while (root->m_parent_menu != nullptr) {
        root = root->m_parent_menu;
    }

    return *root;
}

bool ContextMenuWidget::contains(ImVec2 position) const {
    if (layout().screen_rect().contains(position)) {
        return true;
    }

    for (const ContextMenuField* field : m_fields) {
        if (field->m_submenu != nullptr && field->m_submenu->visible() && field->m_submenu->contains(position)) {
            return true;
        }
    }

    return false;
}

void ContextMenuWidget::close_children() {
    for (ContextMenuField* field : m_fields) {
        if (field->m_submenu != nullptr) {
            field->m_submenu->hide();
        }
    }
}
