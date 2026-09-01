#include "detail.hpp"
#include "../widgets/collection-card.hpp"
#include <ui/ui.hpp>
#include <ui/widgets/text.hpp>
#include <ui/widgets/text-input.hpp>

#include <algorithm>
#include <string>

using namespace app;

class CollectionSplitLayout final : public ui::StackContainer {
public:
    explicit CollectionSplitLayout(ui::ResizableContainer& collection_layout)
        : ui::StackContainer("##collections-content", ui::StackDirection::Horizontal), m_collection_layout(collection_layout) {
        set_spacing(10.0f);
    }

private:
    void on_layout() override {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        resolve_size({available.x, layout().size().y});

        const float current_width = m_collection_layout.layout().size().x;
        const float desired_width = current_width > 0.0F ? current_width : available.x * 0.25F;
        const float collection_width = std::min(desired_width, available.x * 0.5F);

        m_collection_layout.set_size({collection_width, 0.0F});

        ui::StackContainer::on_layout();
    }

    ui::ResizableContainer& m_collection_layout;
};

CollectionTab::CollectionTab(UI& ui) : UITab(ui, "collections") {}

void CollectionTab::setup() {
    const ui::Theme& theme = ui().theme();

    auto collection_layout = std::make_unique<ui::ResizableContainer>("##collections");
    m_collection_layout = collection_layout.get();

    m_collection_layout->set_resize(ui::ResizeAxes::X);
    m_collection_layout->set_spacing(8.0F);

    m_collection_layout->configure_all_styles([&theme](ui::Style& style) {
        style.padding({theme.content_padding, theme.content_padding}).border(ui::BORDER_RIGHT).border_color(theme.border_color);
    });

    auto& collection_input =
        m_collection_layout->add_child<ui::TextInputWidget>(ui(), m_collection_search, "##collection-search");
    collection_input.set_icon(ui().find_texture("search-icon"));

    auto& collection_card = m_collection_layout->add_child<CollectionCardWidget>(ui(), "Collection");
    collection_card.on_event = [&collection_card](ui::UiEvent& event) {
        if (event.type == ui::EventType::Click) {
            collection_card.set_text("Collection 2");
            collection_card.set_count("999 maps");
            collection_card.toggle_selected();
            event.mark_handled();
        } else if (event.type == ui::EventType::ContextClick) {
            event.mark_handled();
        }
    };

    auto beatmaps_layout = std::make_unique<ui::ChildContainer>("##collection-beatmaps");
    beatmaps_layout->configure_all_styles([&theme](ui::Style& style) { style.padding({0.0F, theme.content_padding}); });
    beatmaps_layout->add_child<ui::TextWidget>("collection data");

    auto& content_layout = add_child<CollectionSplitLayout>(*m_collection_layout);
    m_content_layout = &content_layout;
    content_layout.add(std::move(collection_layout));
    content_layout.add(std::move(beatmaps_layout));
}

void CollectionTab::render() {
    m_content_layout->set_size({0.0F, ImGui::GetContentRegionAvail().y});
    m_content_layout->draw();
}
