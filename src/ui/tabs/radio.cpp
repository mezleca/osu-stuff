#include "detail.hpp"

RadioTab::RadioTab() {
    m_id = "radio";
}

void RadioTab::setup() {
    mark_initialized();
}

void RadioTab::render() {
    if (!is_initialized()) {
        return;
    }

    ImGui::TextUnformatted("radio");
}
