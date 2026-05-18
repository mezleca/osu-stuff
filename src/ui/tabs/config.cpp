#include "tabs.hpp"
#include "../theme.hpp"

void tabs::render_config(ImFont* font) {
    ImGui::SetCursorPos(ImVec2{ui_theme::CONTENT_PADDING, ui_theme::CONTENT_PADDING});
    ImGui::PushFont(font);
    ImGui::TextUnformatted("config");
    ImGui::PopFont();
}
