#include "detail.hpp"

StatusTab::StatusTab() {
    m_id = "status";
}

void StatusTab::setup() {
    mark_initialized();
}

void StatusTab::render() {
    if (!is_initialized()) {
        return;
    }

    ImGui::TextUnformatted("status");
}
