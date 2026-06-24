#include "tabs.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

ConfigTab::ConfigTab() {
    m_id = "config";
}

ConfigTab::~ConfigTab() {
}

void ConfigTab::render() {
    ImGui::TextUnformatted("config");
}
