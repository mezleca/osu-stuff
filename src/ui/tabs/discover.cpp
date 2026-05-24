#include "tabs.hpp"
#include "../theme.hpp"

void tabs::render_discover(ImFont* font) {
    ImGui::PushFont(font);
    ImGui::TextUnformatted("discover");
    ImGui::PopFont();
}
