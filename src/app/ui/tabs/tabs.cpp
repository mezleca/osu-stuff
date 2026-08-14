#include "tabs.hpp"

UITab::~UITab() {}

void UITab::draw() {
    const auto draw_measurement = measure_draw();
    if (!visible()) {
        return;
    }

    if (!is_initialized()) {
        setup();
    }

    render();
}
