#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

RadioTab::RadioTab(UI* ui) : UITab(ui) {
    m_id = "radio";
}

void RadioTab::render() {
    ImGui::TextUnformatted("radio");
}
