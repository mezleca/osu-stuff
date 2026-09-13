#include "detail.hpp"
#include "../widgets/collection-card.hpp"
#include <ui/ui.hpp>
#include <ui/widgets/text.hpp>
#include <ui/widgets/text-input.hpp>

using namespace ui;

CollectionTab::CollectionTab() : UITab("collections") {}

void CollectionTab::setup() {
    const Theme& theme = ui().theme();

    auto& content_layout = add<Container>("##collections-content", StackDirection::Horizontal);
    m_content_layout = &content_layout;
    content_layout.set_size({grow(), grow()});
    content_layout.set_spacing(10.0F);

    auto& collection_layout = content_layout.add<ResizableContainer>("##collections");
    m_collection_layout = &collection_layout;
    collection_layout.set_size({percent(25.0F), grow()});

    collection_layout.set_resize(ResizeAxes::X);
    collection_layout.set_spacing(8.0F);

    collection_layout.configure_all_styles([&theme](Style& style) {
        style.padding({12.0F, 12.0F}).border(BORDER_RIGHT).border_color(theme.border_color);
    });

    auto& collection_input = collection_layout.add<TextInputWidget>(m_collection_search, "##collection-search");
    collection_input.configure_all_styles([](Style& style) { style.padding({10.0F, 8.0F}); });
    collection_input.set_icon(ui().runtime().textures().find("search-icon"));

    auto& collection_card = collection_layout.add<CollectionCardWidget>("Collection");
    collection_card.set_on_event([&collection_card](UiEvent& event) {
        if (event.type == EventType::Click) {
            collection_card.set_text("Collection 2");
            collection_card.set_count("999 maps");
            collection_card.toggle_selected();
            event.mark_handled();
        } else if (event.type == EventType::ContextClick) {
            event.mark_handled();
        }
    });

    auto& beatmaps_layout = content_layout.add<Container>("##collection-beatmaps");
    beatmaps_layout.configure_all_styles([](Style& style) { style.padding({0.0F, 12.0F}); });
    beatmaps_layout.add<TextWidget>("collection data");
}
