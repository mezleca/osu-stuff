#pragma once

#include "tabs.hpp"
#include "../custom.hpp"
#include "../widgets/search.hpp"
#include "../widgets/collection_card.hpp"

struct IndexTab : public UITab {
    explicit IndexTab(UI* ui);
    ~IndexTab() override = default;
    void render() override;
};

struct CollectionTab : public UITab {
    explicit CollectionTab(UI* ui);
    ~CollectionTab() override = default;
    void render() override;

private:
    ChildState m_collection_child_state;
    ChildState m_beatmaps_child_state;
    std::unique_ptr<SearchInputWidget> m_collection_input;
    std::unique_ptr<SearchInputWidget> m_beatmaps_input;
    std::unique_ptr<CollectionCardWidget> m_collection_card;
};

struct DiscoverTab : public UITab {
    explicit DiscoverTab(UI* ui);
    ~DiscoverTab() override = default;
    void render() override;
};

struct RadioTab : public UITab {
    explicit RadioTab(UI* ui);
    ~RadioTab() override = default;
    void render() override;
};

struct ConfigTab : public UITab {
    explicit ConfigTab(UI* ui);
    ~ConfigTab() override = default;
    void render() override;
};

struct StatusTab : public UITab {
    explicit StatusTab(UI* ui);
    ~StatusTab() override = default;
    void render() override;
};
