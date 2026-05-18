#include "tabs.hpp"
#include "../theme.hpp"

void render_discover_tab(ImFont* font) {
    ImGui::SetCursorPos(ImVec2{ui_theme::CONTENT_PADDING, ui_theme::CONTENT_PADDING});
    ImGui::PushFont(font);
    ImGui::TextUnformatted("discover");
    ImGui::PopFont();
}
