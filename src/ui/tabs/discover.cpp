#include "detail.hpp"
#include <ui/widgets/text.hpp>

using namespace ui;

DiscoverTab::DiscoverTab() : UITab("discover") {}

void DiscoverTab::setup() {
    m_content_layout = &add<Container>("##discover-content");
    m_content_layout->set_size({grow(), grow()});
    m_content_layout->add<TextWidget>("discover");
}
