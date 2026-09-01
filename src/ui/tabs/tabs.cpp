#include "tabs.hpp"

using namespace ui;

void UITab::initialize() {
    if (m_initialized) {
        return;
    }

    setup();
    m_initialized = true;
}

void UITab::on_update(float) {
    initialize();
}

void UITab::draw() {
    if (!visible()) {
        return;
    }

    initialize();
    const ImVec2 position = ImGui::GetCursorScreenPos();
    const ImVec2 size = ImGui::GetContentRegionAvail();
    assign_size(size);
    const Rect rect = Rect::from_position_size(position, size);
    set_layout_rect(rect);
    set_visual_rect(rect);
    render();
}
