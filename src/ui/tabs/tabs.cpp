#include "tabs.hpp"

using namespace app;

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
    render();
}
