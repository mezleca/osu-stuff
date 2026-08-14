#include "detail.hpp"

ConfigTab::ConfigTab() : UITab("config") {
}

void ConfigTab::setup() {
    mark_initialized();
}

void ConfigTab::render() {
    if (!is_initialized()) {
        return;
    }

    ImGui::TextUnformatted("config");
}
