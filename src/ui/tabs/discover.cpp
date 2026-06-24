#include "tabs.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

DiscoverTab::DiscoverTab() {
    m_id = "discover";
}

DiscoverTab::~DiscoverTab() {
}

void DiscoverTab::render() {
    ImGui::TextUnformatted("discover");
}
