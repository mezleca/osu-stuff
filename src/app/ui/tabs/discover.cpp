#include "detail.hpp"

DiscoverTab::DiscoverTab() : UITab("discover") {
}

void DiscoverTab::setup() {
    mark_initialized();
}

void DiscoverTab::render() {
    if (!is_initialized()) {
        return;
    }

    ImGui::TextUnformatted("discover");
}
