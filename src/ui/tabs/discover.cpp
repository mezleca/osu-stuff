#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

DiscoverTab::DiscoverTab(UI* ui) : UITab(ui) {
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
