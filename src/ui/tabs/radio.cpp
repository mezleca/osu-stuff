#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

RadioTab::RadioTab(UI* ui) : UITab(ui) {
    m_id = "radio";
}

void RadioTab::setup() {
    m_initialized = true;
}

void RadioTab::render() {
    if (!m_initialized) {
        return;
    }

    ImGui::TextUnformatted("radio");
}
