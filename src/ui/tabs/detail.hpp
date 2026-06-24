#pragma once

#include "tabs.hpp"
#include "../custom.hpp"

struct IndexTab : public UITab {
    explicit IndexTab();
    ~IndexTab() override = default;
    void render() override;
};

struct CollectionTab : public UITab {
    explicit CollectionTab();
    ~CollectionTab() override = default;
    void render() override;

private:
    ChildState m_collection_child_state;
    ChildState m_beatmaps_child_state;
};

struct DiscoverTab : public UITab {
    explicit DiscoverTab();
    ~DiscoverTab() override = default;
    void render() override;
};

struct RadioTab : public UITab {
    explicit RadioTab();
    ~RadioTab() override = default;
    void render() override;
};

struct ConfigTab : public UITab {
    explicit ConfigTab();
    ~ConfigTab() override = default;
    void render() override;
};

struct StatusTab : public UITab {
    explicit StatusTab();
    ~StatusTab() override = default;
    void render() override;
};
