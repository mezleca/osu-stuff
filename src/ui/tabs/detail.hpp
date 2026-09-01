#pragma once

#include "tabs.hpp"
#include <ui/layout/container.hpp>
#include <ui/layout/resizable-container.hpp>
#include <ui/layout/stack-container.hpp>

class TaskScheduler;

namespace ui {
    class ContextMenuWidget;
}

class UIModalManager;
class UINotificationManager;

class IndexTab : public UITab {
public:
    IndexTab(ui::UI& ui, TaskScheduler& tasks, UINotificationManager& notification_manager);

private:
    void setup() override;
    void render() override;

    UIModalManager* m_modal_manager = nullptr;
    ui::Container* m_visual_test_layout = nullptr;
    ui::ContextMenuWidget* m_context_menu = nullptr;

    TaskScheduler& m_tasks;
    UINotificationManager& m_notification_manager;
};

class CollectionTab : public UITab {
public:
    explicit CollectionTab(ui::UI& ui);

private:
    void setup() override;
    void render() override;

    ui::Container* m_content_layout = nullptr;
    ui::ResizableContainer* m_collection_layout = nullptr;
    std::string m_collection_search;
};

class DiscoverTab : public UITab {
public:
    explicit DiscoverTab(ui::UI& ui);

private:
    void setup() override;
    void render() override;

    ui::Container* m_content_layout = nullptr;
};

class RadioTab : public UITab {
public:
    explicit RadioTab(ui::UI& ui);

private:
    void setup() override;
    void render() override;

    ui::Container* m_content_layout = nullptr;
};

class ConfigTab : public UITab {
public:
    explicit ConfigTab(ui::UI& ui);

private:
    void setup() override;
    void render() override;

    void build();

    ui::StackContainer* m_content_layout = nullptr;
};

class StatusTab : public UITab {
public:
    explicit StatusTab(ui::UI& ui);

private:
    void setup() override;
    void render() override;

    ui::Container* m_content_layout = nullptr;
};
