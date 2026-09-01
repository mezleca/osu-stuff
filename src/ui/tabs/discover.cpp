#include "detail.hpp"
#include <ui/widgets/text.hpp>

using namespace ui;

DiscoverTab::DiscoverTab(UI& ui) : UITab(ui, "discover") {}

void DiscoverTab::setup() {
    m_content_layout = &add<StackContainer>("##discover-content");
    m_content_layout->add<TextWidget>("discover");
}

void DiscoverTab::render() {
    m_content_layout->draw();
}
