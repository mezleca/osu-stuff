#pragma once

#include <imgui.h>
#include <string>

struct ChildState;

struct UITab {
    explicit UITab();

    std::string m_id;

    virtual ~UITab();
    virtual void render() = 0;
};

struct IndexTab : public UITab {
    explicit IndexTab();
    ~IndexTab();
    void render() override;
};

struct CollectionTab : public UITab {
    explicit CollectionTab();
    ~CollectionTab() override;
    void render() override;

  private:
    ChildState* m_collection_child_state;
    ChildState* m_beatmaps_child_state;
};

struct DiscoverTab : public UITab {
    explicit DiscoverTab();
    ~DiscoverTab() override;
    void render() override;
};

struct RadioTab : public UITab {
    explicit RadioTab();
    ~RadioTab() override;
    void render() override;
};

struct ConfigTab : public UITab {
    explicit ConfigTab();
    ~ConfigTab() override;
    void render() override;
};

struct StatusTab : public UITab {
    explicit StatusTab();
    ~StatusTab() override;
    void render() override;
};
