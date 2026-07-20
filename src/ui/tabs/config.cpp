#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

ConfigTab::ConfigTab(UI* ui) : UITab(ui) {
    m_id = "config";
}

void ConfigTab::setup() {
    mark_initialized();
}

void ConfigTab::render() {
    if (!is_initialized()) {
        return;
    }

    ImGui::TextUnformatted("config");
}
