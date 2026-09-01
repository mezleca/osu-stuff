#include "detail.hpp"
#include <ui/widgets/text.hpp>

using namespace ui;

StatusTab::StatusTab(UI& ui) : UITab(ui, "status") {}

void StatusTab::setup() {
    m_content_layout = &add<StackContainer>("##status-content");
    m_content_layout->add<TextWidget>("status");
}

void StatusTab::render() {
    m_content_layout->draw();
}
