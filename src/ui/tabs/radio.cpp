#include "tabs.hpp"
#include "../theme.hpp"

void tabs::render_radio(ImFont* font) {
    ImGui::PushFont(font);
    ImGui::TextUnformatted("radio");
    ImGui::PopFont();
}
