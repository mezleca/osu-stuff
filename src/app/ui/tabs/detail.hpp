#pragma once

#include "tabs.hpp"
#include "../../../ui/layout/child-container.hpp"
#include "../../../ui/layout/resizable-container.hpp"
#include "../../../ui/layout/stack-container.hpp"
#include "../../../ui/layout/modal-container.hpp"

class UINotificationManager;

class IndexTab : public UITab {
public:
    IndexTab(UI& ui, UINotificationManager& notification_manager);

    void setup() override;
    void render() override;

private:
    void render_visual_test();

    ui::ModalContainer* m_modal_layout = nullptr;
    ui::ChildContainer* m_anchor_visual_test = nullptr;
    ui::ChildContainer* m_notification_visual_test = nullptr;
    ui::ChildContainer* m_widget_visual_test = nullptr;

    UINotificationManager& m_notification_manager;
};

class CollectionTab : public UITab {
public:
    explicit CollectionTab(UI& ui);

    void setup() override;
    void render() override;

private:
    ui::ChildContainer* m_content_layout = nullptr;
    ui::ResizableContainer* m_collection_layout = nullptr;
    ui::ChildContainer* m_beatmaps_layout = nullptr;
    std::string m_collection_search;
};

class DiscoverTab : public UITab {
public:
    explicit DiscoverTab(UI& ui);

    void setup() override;
    void render() override;

private:
    ui::ChildContainer* m_content_layout = nullptr;
};

class RadioTab : public UITab {
public:
    explicit RadioTab(UI& ui);

    void setup() override;
    void render() override;

private:
    ui::ChildContainer* m_content_layout = nullptr;
};

class ConfigTab : public UITab {
public:
    explicit ConfigTab(UI& ui);

    void setup() override;
    void render() override;

private:
    ui::ChildContainer* m_content_layout = nullptr;
};

class StatusTab : public UITab {
public:
    explicit StatusTab(UI& ui);

    void setup() override;
    void render() override;

private:
    ui::ChildContainer* m_content_layout = nullptr;
};
