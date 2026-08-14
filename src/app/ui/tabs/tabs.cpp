#include "tabs.hpp"

UITab::~UITab() {
}

void UITab::draw() {
    [[maybe_unused]] const auto draw_scope = measure_draw();
    if (!visible()) {
        return;
    }

    if (!is_initialized()) {
        setup();
    }

    render();
}
