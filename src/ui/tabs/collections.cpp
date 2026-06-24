#include "imgui.h"
#include "tabs.hpp"
#include "../theme.hpp"
#include "../custom.hpp"

#include <string>

CollectionTab::CollectionTab() : UITab() {
    m_id = "collections";

    m_collection_child_state = new ChildState();
    m_collection_child_state->m_id = "##collections";
    m_collection_child_state->m_resize = CHILD_RESIZE_X;

    m_beatmaps_child_state = new ChildState();
    m_beatmaps_child_state->m_id = "##collection-beatmaps";
}

CollectionTab::~CollectionTab() {
    delete m_collection_child_state;
    delete m_beatmaps_child_state;
}

void CollectionTab::render() {
    static std::string shit = "0";

    const ImVec2 available = ImGui::GetContentRegionAvail();

    if (m_collection_child_state->m_size.x == 0 && m_collection_child_state->m_size.y == 0) {
        m_collection_child_state->m_size = {25.0f * available.x / 100.f, available.y};
    }

    m_beatmaps_child_state->m_size = {available.x - m_collection_child_state->m_size.x, available.y};

    custom_imgui::begin_child(m_collection_child_state, ImGuiChildFlags_None, ImGuiWindowFlags_NoBackground);
    {
        custom_imgui::search_input("penis", shit);
        ImGui::Text("a");
    }
    custom_imgui::end_child(m_collection_child_state, BORDER_RIGHT, ImColor(ui_theme::BORDER_COLOR), 1.0f);

    ImGui::SameLine(0.0f, 0.0f);

    custom_imgui::begin_child(m_beatmaps_child_state, ImGuiChildFlags_None, ImGuiWindowFlags_NoBackground);
    {
        ImGui::Text("collection data");
    }
    custom_imgui::end_child(m_beatmaps_child_state, BORDER_NONE, ImColor(ui_theme::BORDER_COLOR), 1.0f);
}
