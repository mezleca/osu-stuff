#include "detail.hpp"
#include "../../../ui/widgets/text.hpp"

DiscoverTab::DiscoverTab() : UITab("discover") {}

void DiscoverTab::setup() {
    auto content_layout = std::make_unique<ui::ChildLayout>("##discover-content");
    m_content_layout = content_layout.get();
    m_content_layout->add(std::make_unique<ui::TextWidget>("discover"));
    add(std::move(content_layout));
    mark_initialized();
}

void DiscoverTab::render() {
    if (!is_initialized()) {
        return;
    }

    m_content_layout->set_size({0.0F, 0.0F});
    m_content_layout->draw();
}
