#include "detail.hpp"

DiscoverTab::DiscoverTab() {
    m_id = "discover";
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
