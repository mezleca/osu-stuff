#include "detail.hpp"
#include "../theme.hpp"
#include "../../../ui/widgets/text.hpp"
#include "../widgets/collection-card.hpp"
#include "../../../ui/widgets/search.hpp"

#include <string>
#include <iostream>

static constexpr float PANEL_WIDTH_PERCENT = 25.0f;
static constexpr float PERCENT_DIVISOR = 100.0f;
static constexpr float MAX_PANEL_WIDTH_FACTOR = 2.0f;

namespace {
    class CollectionSplitLayout final : public ui::ChildLayout {
    public:
        CollectionSplitLayout(ui::ChildLayout& collection_layout, ui::ChildLayout& beatmaps_layout)
            : ui::ChildLayout("##collections-content"), m_collection_layout(collection_layout),
              m_beatmaps_layout(beatmaps_layout) {}

    private:
        void on_draw() override {
            ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {0.0F, 0.0F});
            ImGui::BeginChild(
                id().c_str(), layout().size(), ImGuiChildFlags_AlwaysUseWindowPadding,
                ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse
            );
        }

        void on_layout() override {
            const ImVec2 available = ImGui::GetContentRegionAvail();
            layout().set_size({available.x, layout().size().y});

            float collection_width = m_collection_layout.get_size().x;
            if (collection_width <= 0.0f) {
                collection_width = PANEL_WIDTH_PERCENT * available.x / PERCENT_DIVISOR;
            }
            if (collection_width > available.x / MAX_PANEL_WIDTH_FACTOR) {
                collection_width = available.x / MAX_PANEL_WIDTH_FACTOR;
            }

            m_collection_layout.set_size({collection_width, available.y});
            m_beatmaps_layout.layout().set_offset({collection_width, 0.0F});
            m_beatmaps_layout.set_size({available.x - collection_width, available.y});
        }

        ui::ChildLayout& m_collection_layout;
        ui::ChildLayout& m_beatmaps_layout;
    };
} // namespace

CollectionTab::CollectionTab() : UITab("collections") {}

void CollectionTab::setup() {
    auto collection_input = std::make_unique<ui::SearchInputWidget>(m_collection_search);
    auto collection_card = std::make_unique<CollectionCardWidget>("Collection");

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

    m_collection_layout->set_resize(ui::LAYOUT_RESIZE_X);
    m_collection_layout->layout().set_anchor(ui::Anchor::TopLeft);
    m_collection_layout->layout().set_origin(ui::Origin::TopLeft);

    m_collection_layout->style().border = ui::BORDER_RIGHT;
    m_collection_layout->style().border_color.value = ImColor(app_theme::BORDER_COLOR);

    m_collection_layout->add(std::move(collection_input));
    m_collection_layout->add(std::move(collection_card));

    auto beatmaps_layout = std::make_unique<ui::ChildLayout>("##collection-beatmaps");
    m_beatmaps_layout = beatmaps_layout.get();
    m_beatmaps_layout->layout().set_anchor(ui::Anchor::TopLeft);
    m_beatmaps_layout->layout().set_origin(ui::Origin::TopLeft);
    beatmaps_layout->add(std::make_unique<ui::TextWidget>("collection data"));

    auto content_layout = std::make_unique<CollectionSplitLayout>(*m_collection_layout, *m_beatmaps_layout);
    m_content_layout = content_layout.get();
    content_layout->add(std::move(collection_layout));
    content_layout->add(std::move(beatmaps_layout));
    add(std::move(content_layout));

    mark_initialized();
}

void CollectionTab::render() {
    if (!is_initialized()) {
        return;
    }

    m_content_layout->set_size({0.0F, ImGui::GetContentRegionAvail().y});
    m_content_layout->draw();
}
