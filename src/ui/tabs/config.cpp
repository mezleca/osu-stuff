#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

ConfigTab::ConfigTab(UI* ui) : UITab(ui) {
    m_id = "config";
}

void ConfigTab::setup() {
    m_initialized = true;
}

void ConfigTab::render() {
    if (!m_initialized) {
        return;
    }

    ImGui::TextUnformatted("config");
}
