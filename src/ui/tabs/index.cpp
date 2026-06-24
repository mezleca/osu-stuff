#include "tabs.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

IndexTab::IndexTab() {
    m_id = "index";
}

IndexTab::~IndexTab() {
}

void IndexTab::render() {
    ImGui::TextUnformatted("osu-stuff");
}
