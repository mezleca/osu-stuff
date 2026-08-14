#include "detail.hpp"
#include "../app.hpp"
#include "../theme.hpp"
#include "../managers/notifications.hpp"
#include "../../../ui/ui.hpp"
#include "../../../ui/widgets/text.hpp"
#include "../widgets/notification.hpp"
#include "../widgets/collection-card.hpp"
#include "../../../ui/widgets/search.hpp"
#include "../../../ui/widgets/button.hpp"

#include <string>
#include <iostream>

static constexpr float PANEL_WIDTH_PERCENT = 25.0f;
static constexpr float PERCENT_DIVISOR = 100.0f;
static constexpr float MAX_PANEL_WIDTH_FACTOR = 2.0f;

static constexpr const char* text_small = "somethingf";
static constexpr const char* text_big = "somethingfdsjmkkkkkkkkkkkkkkkkkkkkkkkkkefjsnfdsnjkfdsnj ndjflsdfnlj";

CollectionTab::CollectionTab() : UITab("collections") {
}

void CollectionTab::setup() {
    auto* notification_manager = app::current().notification_manager();

    auto collection_input = std::make_unique<ui::SearchInputWidget>(m_collection_search);
    auto collection_card = std::make_unique<CollectionCardWidget>("Collection");

    auto add_notification_button = std::make_unique<ui::ButtonWidget>("add notification");

    add_notification_button->on_event = [notification_manager](ui::UiEvent& event) {
        if (event.type != ui::EventType::Click || notification_manager == nullptr) {
            return;
        }

        auto text = notification_manager->count() == 0 ? text_small : text_big;
        auto notification = std::make_unique<LogNotificationWidget>(LogNotificationLevel::INFO, text);

        if (notification_manager->add(std::move(notification))) {
            std::cout << "added notification\n";
        }
        event.mark_handled();
    };

    CollectionCardWidget* collection_card_ptr = collection_card.get();

    collection_card_ptr->on_event = [collection_card_ptr](ui::UiEvent& event) {
        if (event.type == ui::EventType::Click) {
            std::cout << "clicked on a card\n";
            collection_card_ptr->m_name.set("Collection 2");
            collection_card_ptr->m_count.set("999 maps");
            collection_card_ptr->toggle_selected();
            event.mark_handled();
        } else if (event.type == ui::EventType::ContextClick) {
            std::cout << "context on a card\n";
            event.mark_handled();
        }
    };
    collection_input->set_fit_width(true);

    auto collection_layout = std::make_unique<ui::ChildLayout>("##collections");
    m_collection_layout = collection_layout.get();
    add(std::move(collection_layout));

    m_collection_layout->set_resize(ui::LAYOUT_RESIZE_X);

    m_collection_layout->style().border = ui::BORDER_RIGHT;
    m_collection_layout->style().border_color.value = ImColor(app_theme::BORDER_COLOR);

    m_collection_layout->add(std::move(collection_input));
    m_collection_layout->add(std::move(collection_card));
    m_collection_layout->add(std::move(add_notification_button));

    auto beatmaps_layout = std::make_unique<ui::ChildLayout>("##collection-beatmaps");
    m_beatmaps_layout = beatmaps_layout.get();
    beatmaps_layout->add(std::make_unique<ui::TextWidget>("collection data"));
    add(std::move(beatmaps_layout));

    mark_initialized();
}

void CollectionTab::render() {
    if (!is_initialized()) {
        return;
    }

    const ImVec2 available = ImGui::GetContentRegionAvail();

    float collection_width = m_collection_layout->get_size().x;

    if (collection_width <= 0.0f) {
        collection_width = PANEL_WIDTH_PERCENT * available.x / PERCENT_DIVISOR;
    }

    if (collection_width > available.x / MAX_PANEL_WIDTH_FACTOR) {
        collection_width = available.x / MAX_PANEL_WIDTH_FACTOR;
    }

    m_collection_layout->set_size({collection_width, available.y});
    m_collection_layout->draw();

    ImGui::SameLine(0.0f, 0.0f);

    m_beatmaps_layout->set_size({available.x - collection_width, available.y});
    m_beatmaps_layout->draw();
}
