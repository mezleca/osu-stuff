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
