#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

DiscoverTab::DiscoverTab(UI* ui) : UITab(ui) {
    m_id = "discover";
}

void DiscoverTab::setup() {
    m_initialized = true;
}

void DiscoverTab::render() {
    if (!m_initialized) {
        return;
    }

    ImGui::TextUnformatted("discover");
}
