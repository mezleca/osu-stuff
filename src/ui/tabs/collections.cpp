#include "imgui.h"
#include "tabs.hpp"
#include "../ui.hpp"
#include "../theme.hpp"

#include <string>

void tabs::render_collections(ImFont* font) {
    ImGui::PushFont(font);

    static std::string shit = "0";

    const ImVec2 available = ImGui::GetContentRegionAvail();

    static ChildState* collection_child_state;
    static ChildState* beatmaps_child_state;

    if (collection_child_state == nullptr) {
        collection_child_state = new ChildState();
        collection_child_state->m_id = "##collections";
        collection_child_state->m_size = {25.0f * available.x / 100.f, available.y};
    }

    if (beatmaps_child_state == nullptr) {
        beatmaps_child_state = new ChildState();
        beatmaps_child_state->m_id = "##collection-beatmaps";
    }

    beatmaps_child_state->m_size = {available.x - collection_child_state->m_size.x, available.y};

    custom_imgui::begin_child(collection_child_state, ImGuiChildFlags_None, ImGuiWindowFlags_NoBackground);
    {
        custom_imgui::search_input("penis", shit);
        ImGui::Text("a");
    }
    custom_imgui::end_child(collection_child_state, BORDER_RIGHT, ImColor(ui_theme::BORDER_COLOR), 1.0f);

    ImGui::SameLine(0.0f, 0.0f);

    custom_imgui::begin_child(beatmaps_child_state, ImGuiChildFlags_None, ImGuiWindowFlags_NoBackground);
    {
        ImGui::Text("collection data");
    }
    custom_imgui::end_child(beatmaps_child_state, BORDER_NONE, ImColor(ui_theme::BORDER_COLOR), 1.0f);

    ImGui::PopFont();
}
