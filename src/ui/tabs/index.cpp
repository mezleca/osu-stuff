#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

IndexTab::IndexTab(UI* ui) : UITab(ui) {
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
