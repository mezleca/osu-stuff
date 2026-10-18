#include "modal.hpp"

#include <imgui-ui/style/theme.hpp>
#include <imgui-ui/surface.hpp>

#include <utility>

using namespace ui;

UIModalManager::UIModalManager()
    : LayerContainer("modal-layer"), m_panel(add<Container>("modal-panel", StackDirection::Vertical)) {

    set_type_name("ModalManager");
    set_visible(false);
    set_input_mode(InputMode::Blocker);

    configure_all_styles([](Style& style) {
        style.padding({}).background_color(rgba(0.0F, 0.0F, 0.0F, 0.42F)).border(BorderEdge{0.0F, BorderType::None});
    });

    m_panel.set_visible(false);
    m_panel.set_spacing(10.0F);
    m_panel.set_layout({
        .size = {px(480.0F), px(220.0F)},
        .placement = {.anchor = Anchor::Center, .origin = Anchor::Center},
        .in_flow = false,
    });
}

void UIModalManager::apply_theme_defaults(const Theme& theme) {
    LayerContainer::apply_theme_defaults(theme);
    m_panel.configure_all_styles([&theme](Style& style) {
        style.padding({24.0F, 24.0F})
            .background_color(theme.background_color)
            .border(BorderEdge{1.0F, BorderType::Solid})
            .border_color(theme.accent_color)
            .border_radius(8.0F);
    });
}

Container& UIModalManager::open(std::string id) {
    m_panel.clear();
    m_panel.set_id(std::move(id));
    m_panel.set_visible(true);
    set_visible(true);
    surface().input_router().set_focus(this);
    return m_panel;
}

void UIModalManager::close() {
    if (!is_open()) {
        return;
    }

    m_panel.set_visible(false);
    set_visible(false);
    surface().input_router().set_focus(nullptr);
    surface().input_router().release_pointer(*this);
}

bool UIModalManager::is_open() const {
    return visible() && m_panel.visible();
}

void UIModalManager::event(UiEvent& event) {
    if (!is_open()) {
        return;
    }

    const bool escape = event.type == EventType::Cancel || (event.type == EventType::KeyDown && event.key == Key::Escape);
    const bool pointer = event.type == EventType::PointerDown || event.type == EventType::Click;
    const bool outside = pointer && !m_panel.layout().visual_rect().contains(event.position);

    if (escape || outside) {
        close();
        event.block_native_input();
        event.stop_propagation();
        return;
    }

    if (ui::contains(EventMask::Pointer, event_mask(event.type))) {
        event.mark_handled();
    }
}
