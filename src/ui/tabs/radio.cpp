#include "tabs.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

RadioTab::RadioTab() {
    m_id = "radio";
}

RadioTab::~RadioTab() {
}

void RadioTab::render() {
    ImGui::TextUnformatted("radio");
}
