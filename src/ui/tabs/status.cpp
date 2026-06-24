#include "tabs.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

StatusTab::StatusTab() {
    m_id = "status";
}

StatusTab::~StatusTab() {
}

void StatusTab::render() {
    ImGui::TextUnformatted("status");
}
