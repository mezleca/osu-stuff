#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

StatusTab::StatusTab(UI* ui) : UITab(ui) {
    m_id = "status";
}

void StatusTab::setup() {
    m_initialized = true;
}

void StatusTab::render() {
    if (!m_initialized) {
        return;
    }

    ImGui::TextUnformatted("status");
}
