#include "detail.hpp"
#include <imgui-ui/widgets/text.hpp>

using namespace ui;

StatusTab::StatusTab() : UITab("status") {}

void StatusTab::setup() {
    m_content_layout = &add<Container>("##status-content");
    m_content_layout->set_size({grow(), grow()});
    m_content_layout->add<TextWidget>("status");
}
