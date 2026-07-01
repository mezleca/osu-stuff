#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

IndexTab::IndexTab(UI* ui) : UITab(ui) {
    m_id = "index";
}

void IndexTab::render() {
    ImGui::TextUnformatted("osu-stuff");
}
