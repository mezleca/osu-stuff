#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

IndexTab::IndexTab(UI* ui) : UITab(ui) {
    m_id = "index";
}

void IndexTab::setup() {
    m_initialized = true;
}

void IndexTab::render() {
    if (!m_initialized) {
        return;
    }

    ImGui::TextUnformatted("osu-stuff");
}
