#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

StatusTab::StatusTab(UI* ui) : UITab(ui) {
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
