#include "detail.hpp"
#include <ui/widgets/text.hpp>

using namespace ui;

RadioTab::RadioTab() : UITab("radio") {}

void RadioTab::setup() {
    m_content_layout = &add<Container>("##radio-content");
    m_content_layout->set_size({grow(), grow()});
    m_content_layout->add<TextWidget>("radio");
}
