#include "detail.hpp"
#include "../widgets/collection-card.hpp"
#include <ui/ui.hpp>
#include <ui/widgets/text.hpp>
#include <ui/widgets/text-input.hpp>

#include <algorithm>
#include <string>

using namespace ui;

class CollectionSplitLayout final : public StackContainer {
public:
    explicit CollectionSplitLayout(ResizableContainer& collection_layout)
        : StackContainer("##collections-content", StackDirection::Horizontal), m_collection_layout(collection_layout) {
        set_spacing(10.0f);
    }

private:
    void arrange_children() override {
        const ImVec2 available = layout().size();
        const float current_width = m_collection_layout.layout().size().x;
        const float desired_width = current_width > 0.0F ? current_width : available.x * 0.25F;
        const float collection_width = std::min(desired_width, available.x * 0.5F);

        m_collection_layout.set_size({px(collection_width), grow()});

        StackContainer::arrange_children();
    }

    ResizableContainer& m_collection_layout;
};

CollectionTab::CollectionTab(UI& ui) : UITab(ui, "collections") {}

void CollectionTab::setup() {
    const Theme& theme = ui().theme();

    auto collection_layout = std::make_unique<ResizableContainer>("##collections");
    m_collection_layout = collection_layout.get();

    m_collection_layout->set_resize(ResizeAxes::X);
    m_collection_layout->set_spacing(8.0F);

    m_collection_layout->configure_all_styles([&theme](Style& style) {
        style.padding({theme.content_padding, theme.content_padding}).border(BORDER_RIGHT).border_color(theme.border_color);
    });

    auto& collection_input = m_collection_layout->add<TextInputWidget>(ui(), m_collection_search, "##collection-search");
    collection_input.set_icon(ui().runtime().textures().find("search-icon"));

    auto& collection_card = m_collection_layout->add<CollectionCardWidget>(ui(), "Collection");
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

    auto beatmaps_layout = std::make_unique<Container>("##collection-beatmaps");
    beatmaps_layout->configure_all_styles([&theme](Style& style) { style.padding({0.0F, theme.content_padding}); });
    beatmaps_layout->add<TextWidget>("collection data");

    auto& content_layout = add<CollectionSplitLayout>(*m_collection_layout);
    m_content_layout = &content_layout;
    content_layout.attach(std::move(collection_layout));
    content_layout.attach(std::move(beatmaps_layout));
}

void CollectionTab::render() {
    m_content_layout->set_size({grow(), px(ImGui::GetContentRegionAvail().y)});
    m_content_layout->draw();
}
