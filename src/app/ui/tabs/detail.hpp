#pragma once

#include "tabs.hpp"
#include "../../../ui/core/layout.hpp"

#include <memory>

class IndexTab : public UITab {
public:
    explicit IndexTab();
    ~IndexTab() override = default;

    void setup() override;
    void render() override;

#ifndef NDEBUG
private:
    void render_visual_test();
    ui::ChildLayout* m_anchor_visual_test = nullptr;
    ui::ChildLayout* m_notification_visual_test = nullptr;
#endif
};

class CollectionTab : public UITab {
public:
    explicit CollectionTab();
    ~CollectionTab() override = default;

    void setup() override;
    void render() override;

private:
    ui::ChildLayout* m_content_layout = nullptr;
    ui::ChildLayout* m_collection_layout = nullptr;
    ui::ChildLayout* m_beatmaps_layout = nullptr;
    std::string m_collection_search;
    std::string m_beatmaps_search;
};

class DiscoverTab : public UITab {
public:
    explicit DiscoverTab();
    ~DiscoverTab() override = default;

    void setup() override;
    void render() override;

private:
    ui::ChildLayout* m_content_layout = nullptr;
};

class RadioTab : public UITab {
public:
    explicit RadioTab();
    ~RadioTab() override = default;

    void setup() override;
    void render() override;

private:
    ui::ChildLayout* m_content_layout = nullptr;
};

class ConfigTab : public UITab {
public:
    explicit ConfigTab();
    ~ConfigTab() override = default;
    void setup() override;
    void render() override;

private:
    ui::ChildLayout* m_content_layout = nullptr;
};

class StatusTab : public UITab {
public:
    explicit StatusTab();
    ~StatusTab() override = default;

    void setup() override;
    void render() override;

private:
    ui::ChildLayout* m_content_layout = nullptr;
};
