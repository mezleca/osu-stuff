#include "tabs.hpp"
#include "../theme.hpp"

void tabs::render_index(ImFont* font) {
    ImGui::PushFont(font);
    ImGui::TextUnformatted("osu-stuff");
    ImGui::PopFont();
}
