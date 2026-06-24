#include "detail.hpp"

#include <memory>

UITab::~UITab() {
}

std::vector<std::unique_ptr<UITab>> create_default_tabs() {
    std::vector<std::unique_ptr<UITab>> tabs;
    tabs.reserve(6);

    tabs.push_back(std::make_unique<IndexTab>());
    tabs.push_back(std::make_unique<CollectionTab>());
    tabs.push_back(std::make_unique<DiscoverTab>());
    tabs.push_back(std::make_unique<RadioTab>());
    tabs.push_back(std::make_unique<ConfigTab>());
    tabs.push_back(std::make_unique<StatusTab>());

    return tabs;
}
