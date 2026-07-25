#include "detail.hpp"

IndexTab::IndexTab() {
    m_id = "index";
}

void IndexTab::setup() {
    mark_initialized();
}

void IndexTab::render() {
    if (!is_initialized()) {
        return;
    }

    ImGui::TextUnformatted("osu-stuff");
}
