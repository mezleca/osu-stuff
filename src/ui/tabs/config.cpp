#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

ConfigTab::ConfigTab(UI* ui) : UITab(ui) {
    m_id = "config";
}

void ConfigTab::render() {
    ImGui::TextUnformatted("config");
}
