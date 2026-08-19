#include "tabs.hpp"

void UITab::draw() {
    if (!visible()) {
        return;
    }

    if (!is_initialized()) {
        setup();
    }

    render();
}
