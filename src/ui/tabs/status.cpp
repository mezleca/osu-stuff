#include "tabs.hpp"
#include "../theme.hpp"

void tabs::render_status(ImFont* font) {
    ImGui::PushFont(font);
    ImGui::TextUnformatted("status");
    ImGui::PopFont();
}
