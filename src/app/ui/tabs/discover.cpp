#include "detail.hpp"
#include "../../../ui/widgets/text.hpp"

DiscoverTab::DiscoverTab(UI& ui) : UITab(ui, "discover") {}

void DiscoverTab::setup() {
    m_content_layout = &add_child<ui::StackContainer>("##discover-content");
    m_content_layout->add_child<ui::TextWidget>("discover");
    mark_initialized();
}

void DiscoverTab::render() {
    if (!is_initialized()) {
        return;
    }

    m_content_layout->draw();
}
