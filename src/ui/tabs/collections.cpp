#include "detail.hpp"
#include "../theme.hpp"
#include "../ui.hpp"
#include "../widgets/text.hpp"
#include "../widgets/collection_card.hpp"
#include "../widgets/search.hpp"
#include "../widgets/button.hpp"

#include <string>
#include <iostream>

static constexpr float COLLECTION_PANEL_WIDTH_PERCENT = 25.0f;
static constexpr float PERCENT_DIVISOR = 100.0f;
static constexpr float MAX_COLLECTION_PANEL_WIDTH_FACTOR = 2.0f;

CollectionTab::CollectionTab() {
    m_id = "collections";
}

void CollectionTab::setup() {
    auto search_icon = ui::current().get_texture("search-icon");
    auto music_icon = ui::current().get_texture("music-icon");

    auto collection_input = std::make_unique<SearchInputWidget>(m_collection_search, search_icon);
    auto collection_card = std::make_unique<CollectionCardWidget>("Penis", music_icon);

    auto add_notification_button = std::make_unique<UIButtonWidget>("add notification");

    add_notification_button->on_click = []() { std::cout << "adding notification\n"; };

    CollectionCardWidget* collection_card_ptr = collection_card.get();

    collection_card_ptr->m_onclick = [collection_card_ptr]() {
        std::cout << "clicked on a card\n";

        collection_card_ptr->m_name.set("Penis 2");
        collection_card_ptr->m_count.set("999 maps");
        collection_card_ptr->toggle_selected();
    };

    collection_card_ptr->m_oncontext = []() { std::cout << "context on a card \n"; };
    collection_input->set_fit_width(true);

    m_collection_layout = std::make_unique<UIChildLayout>("##collections");

    m_collection_layout->set_resize(LAYOUT_RESIZE_X);

    m_collection_layout->style().border = UI_BORDER_RIGHT;
    m_collection_layout->style().border_color.value = ImColor(ui_theme::BORDER_COLOR);

    m_collection_layout->add(std::move(collection_input));
    m_collection_layout->add(std::move(collection_card));
    m_collection_layout->add(std::move(add_notification_button));

    m_beatmaps_layout = std::make_unique<UIChildLayout>("##collection-beatmaps");
    m_beatmaps_layout->add(std::make_unique<UITextWidget>("collection data"));

    mark_initialized();
}

void CollectionTab::render() {
    if (!is_initialized()) {
        return;
    }

    const ImVec2 available = ImGui::GetContentRegionAvail();

    float collection_width = m_collection_layout->get_size().x;

    if (collection_width <= 0.0f) {
        collection_width = COLLECTION_PANEL_WIDTH_PERCENT * available.x / PERCENT_DIVISOR;
    }

    if (collection_width > available.x / MAX_COLLECTION_PANEL_WIDTH_FACTOR) {
        collection_width = available.x / MAX_COLLECTION_PANEL_WIDTH_FACTOR;
    }

    m_collection_layout->set_size({collection_width, available.y});
    m_collection_layout->show();

    ImGui::SameLine(0.0f, 0.0f);

    m_beatmaps_layout->set_size({available.x - collection_width, available.y});
    m_beatmaps_layout->show();
}
