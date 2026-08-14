#include "detail.hpp"

RadioTab::RadioTab() : UITab("radio") {
}

void RadioTab::setup() {
    mark_initialized();
}

void RadioTab::render() {
    if (!is_initialized()) {
        return;
    }

    ImGui::TextUnformatted("radio");
}
