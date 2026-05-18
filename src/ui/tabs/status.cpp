#include "tabs.hpp"
#include "../theme.hpp"

void render_status_tab(ImFont* font) {
    ImGui::SetCursorPos(ImVec2{ui_theme::CONTENT_PADDING, ui_theme::CONTENT_PADDING});
    ImGui::PushFont(font);
    ImGui::TextUnformatted("status");
    ImGui::PopFont();
}
