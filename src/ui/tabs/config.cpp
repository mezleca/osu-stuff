#include "tabs.hpp"
#include "../theme.hpp"

void tabs::render_config(ImFont* font) {
    ImGui::PushFont(font);
    ImGui::TextUnformatted("config");
    ImGui::PopFont();
}
