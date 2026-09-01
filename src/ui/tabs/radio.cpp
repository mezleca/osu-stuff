#include "detail.hpp"
#include <ui/widgets/text.hpp>

using namespace ui;

RadioTab::RadioTab(UI& ui) : UITab(ui, "radio") {}

void RadioTab::setup() {
    m_content_layout = &add<StackContainer>("##radio-content");
    m_content_layout->add<TextWidget>("radio");
}

void RadioTab::render() {
    m_content_layout->draw();
}
