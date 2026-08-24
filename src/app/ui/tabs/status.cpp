#include "detail.hpp"
#include "../../../ui/widgets/text.hpp"

StatusTab::StatusTab(UI& ui) : UITab(ui, "status") {}

void StatusTab::setup() {
    m_content_layout = &add_child<ui::StackContainer>("##status-content");
    m_content_layout->add_child<ui::TextWidget>("status");
}

void StatusTab::render() {
    m_content_layout->draw();
}
