#pragma once

#include "tabs.hpp"
#include <ui/layout/child-container.hpp>
#include <ui/layout/resizable-container.hpp>
#include <ui/layout/stack-container.hpp>
#include <ui/layout/modal-container.hpp>

class TaskScheduler;

namespace ui {
    class ContextMenuWidget;
}

namespace app {
    class UINotificationManager;

    class IndexTab : public UITab {
    public:
        IndexTab(UI& ui, TaskScheduler& tasks, UINotificationManager& notification_manager);

    private:
        void setup() override;
        void render() override;

        ui::ModalContainer* m_modal_layout = nullptr;
        ui::ChildContainer* m_visual_test_layout = nullptr;
        ui::ContextMenuWidget* m_context_menu = nullptr;

        TaskScheduler& m_tasks;
        UINotificationManager& m_notification_manager;
    };

    class CollectionTab : public UITab {
    public:
        explicit CollectionTab(UI& ui);

    private:
        void setup() override;
        void render() override;

        ui::ChildContainer* m_content_layout = nullptr;
        ui::ResizableContainer* m_collection_layout = nullptr;
        std::string m_collection_search;
    };

    class DiscoverTab : public UITab {
    public:
        explicit DiscoverTab(UI& ui);

    private:
        void setup() override;
        void render() override;

        ui::ChildContainer* m_content_layout = nullptr;
    };

    class RadioTab : public UITab {
    public:
        explicit RadioTab(UI& ui);

    private:
        void setup() override;
        void render() override;

        ui::ChildContainer* m_content_layout = nullptr;
    };

    class ConfigTab : public UITab {
    public:
        explicit ConfigTab(UI& ui);

    private:
        void setup() override;
        void render() override;

        void build();

        ui::StackContainer* m_content_layout = nullptr;
    };

    class StatusTab : public UITab {
    public:
        explicit StatusTab(UI& ui);

    private:
        void setup() override;
        void render() override;

        ui::ChildContainer* m_content_layout = nullptr;
    };

} // namespace app
