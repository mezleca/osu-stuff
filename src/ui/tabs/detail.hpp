#pragma once

#include "tabs.hpp"
#include "../layout.hpp"

#include <memory>

class IndexTab : public UITab {
public:
    explicit IndexTab();
    ~IndexTab() override = default;

    void setup() override;
    void render() override;
};

class CollectionTab : public UITab {
public:
    explicit CollectionTab();
    ~CollectionTab() override = default;

    void setup() override;
    void render() override;

private:
    std::unique_ptr<UIChildLayout> m_collection_layout;
    std::unique_ptr<UIChildLayout> m_beatmaps_layout;
    std::string m_collection_search;
    std::string m_beatmaps_search;
};

class DiscoverTab : public UITab {
public:
    explicit DiscoverTab();
    ~DiscoverTab() override = default;

    void setup() override;
    void render() override;
};

class RadioTab : public UITab {
public:
    explicit RadioTab();
    ~RadioTab() override = default;

    void setup() override;
    void render() override;
};

class ConfigTab : public UITab {
public:
    explicit ConfigTab();
    ~ConfigTab() override = default;
    void setup() override;
    void render() override;
};

class StatusTab : public UITab {
public:
    explicit StatusTab();
    ~StatusTab() override = default;

    void setup() override;
    void render() override;
};
