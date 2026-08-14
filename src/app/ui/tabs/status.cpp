#include "detail.hpp"
#include "../../../ui/widgets/text.hpp"

StatusTab::StatusTab() : UITab("status") {}

void StatusTab::setup() {
    auto content_layout = std::make_unique<ui::ChildLayout>("##status-content");
    m_content_layout = content_layout.get();
    m_content_layout->add(std::make_unique<ui::TextWidget>("status"));
    add(std::move(content_layout));
    mark_initialized();
}

void StatusTab::render() {
    if (!is_initialized()) {
        return;
    }

    m_content_layout->set_size({0.0F, 0.0F});
    m_content_layout->draw();
}
