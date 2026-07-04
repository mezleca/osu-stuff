#include "detail.hpp"
#include "../theme.hpp"
#include "../custom.hpp"
#include "../ui.hpp"

#include <string>
#include <iostream>

static constexpr float COLLECTION_PANEL_WIDTH_PERCENT = 25.0f;
static constexpr float PERCENT_DIVISOR = 100.0f;
static constexpr float MAX_COLLECTION_PANEL_WIDTH_FACTOR = 2.0f;

CollectionTab::CollectionTab(UI* ui) : UITab(ui) {
    m_id = "collections";

    m_collection_child_state.m_id = "##collections";
    m_collection_child_state.m_resize = CHILD_RESIZE_X;
    m_collection_child_state.m_border = BORDER_RIGHT;
    m_collection_child_state.m_border_color = ImColor(ui_theme::BORDER_COLOR);

    m_beatmaps_child_state.m_id = "##collection-beatmaps";

    auto search_icon = m_ui->get_texture("search-icon");
    auto music_icon = m_ui->get_texture("music-icon");

    m_collection_input = std::make_unique<SearchInputWidget>(m_ui, search_icon);
    m_beatmaps_input = std::make_unique<SearchInputWidget>(m_ui, search_icon);
    m_collection_card = std::make_unique<CollectionCardWidget>(m_ui, "Penis", music_icon);

    m_collection_card->on_click = [&]() {
        std::cout << "clicked on a card\n";

        m_collection_card->m_state.m_name = "Penis 2";
        m_collection_card->m_state.m_count = "999 maps";
        m_collection_card->m_state.m_selected = !m_collection_card->m_state.m_selected;
    };

    m_collection_card->on_context = []() { std::cout << "context on a card \n"; };

    m_collection_input->m_state.m_fit_width = true;
}

void CollectionTab::render() {
    static bool set_collection_child_x = false;
    static std::string collection_search;

    const ImVec2 available = ImGui::GetContentRegionAvail();

    if (!set_collection_child_x) {
        m_collection_child_state.m_size.x = COLLECTION_PANEL_WIDTH_PERCENT * available.x / PERCENT_DIVISOR;
        set_collection_child_x = true;
    }

    m_collection_child_state.m_size.y = available.y;

    // clamp child width
    if (m_collection_child_state.m_size.x > available.x / MAX_COLLECTION_PANEL_WIDTH_FACTOR) {
        m_collection_child_state.m_size.x = available.x / MAX_COLLECTION_PANEL_WIDTH_FACTOR;
    }

    m_beatmaps_child_state.m_size = {available.x - m_collection_child_state.m_size.x, available.y};

    custom_imgui::begin_child(m_collection_child_state, ImGuiChildFlags_None, ImGuiWindowFlags_NoBackground);
    {
        m_collection_input->show();
        m_collection_card->show();
    }
    custom_imgui::end_child(m_collection_child_state, 1.0f);

    ImGui::SameLine(0.0f, 0.0f);

    custom_imgui::begin_child(m_beatmaps_child_state, ImGuiChildFlags_None, ImGuiWindowFlags_NoBackground);
    {
        ImGui::Text("collection data");
    }
    custom_imgui::end_child(m_beatmaps_child_state, 1.0f);
}
