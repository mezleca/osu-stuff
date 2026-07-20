#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

RadioTab::RadioTab(UI* ui) : UITab(ui) {
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
