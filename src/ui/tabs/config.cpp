#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

ConfigTab::ConfigTab() {
    m_id = "config";
}

void ConfigTab::render() {
    ImGui::TextUnformatted("config");
}
