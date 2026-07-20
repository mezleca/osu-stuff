#pragma once

#include "tabs.hpp"
#include "../custom.hpp"
#include "../widgets/search.hpp"
#include "../widgets/collection_card.hpp"

#include <memory>

class IndexTab : public UITab {
public:
    explicit IndexTab(UI* ui);
    ~IndexTab() override = default;

    void setup() override;
    void render() override;
};

class CollectionTab : public UITab {
public:
    explicit CollectionTab(UI* ui);
    ~CollectionTab() override = default;

    void setup() override;
    void render() override;

private:
    ChildState m_collection_child_state;
    ChildState m_beatmaps_child_state;
    std::unique_ptr<SearchInputWidget> m_collection_input;
    std::unique_ptr<SearchInputWidget> m_beatmaps_input;
    std::unique_ptr<CollectionCardWidget> m_collection_card;
    std::string m_collection_search;
    std::string m_beatmaps_search;
};

class DiscoverTab : public UITab {
public:
    explicit DiscoverTab(UI* ui);
    ~DiscoverTab() override = default;

    void setup() override;
    void render() override;
};

class RadioTab : public UITab {
public:
    explicit RadioTab(UI* ui);
    ~RadioTab() override = default;

    void setup() override;
    void render() override;
};

class ConfigTab : public UITab {
public:
    explicit ConfigTab(UI* ui);
    ~ConfigTab() override = default;
    void setup() override;
    void render() override;
};

class StatusTab : public UITab {
public:
    explicit StatusTab(UI* ui);
    ~StatusTab() override = default;

    void setup() override;
    void render() override;
};
