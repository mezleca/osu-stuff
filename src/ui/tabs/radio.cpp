#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

RadioTab::RadioTab() {
    m_id = "radio";
}

void RadioTab::render() {
    ImGui::TextUnformatted("radio");
}
