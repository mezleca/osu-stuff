#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

DiscoverTab::DiscoverTab() {
    m_id = "discover";
}

void DiscoverTab::render() {
    ImGui::TextUnformatted("discover");
}
