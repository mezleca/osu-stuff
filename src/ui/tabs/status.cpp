#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

StatusTab::StatusTab(UI* ui) : UITab(ui) {
    m_id = "status";
}

void StatusTab::render() {
    ImGui::TextUnformatted("status");
}
