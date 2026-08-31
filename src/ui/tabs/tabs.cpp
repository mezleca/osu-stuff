#include "tabs.hpp"

using namespace app;
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
    resolve_size(size);
    set_screen_rect(Rect::from_position_size(position, size));
    render();
}
