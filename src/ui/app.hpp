#pragma once

#include "../tasks/tasks.hpp"

#include <ui/ui.hpp>
#include <ui/backends/sdl/backend.hpp>
#include <SDL3/SDL_events.h>
#include <memory>
#include <vector>

namespace ui {
    class Debugger;
}

namespace app {
    class UINotificationManager;
    class TabButtonWidget;
    class UITab;

    struct TabEntry {
        TabButtonWidget* button;
        UITab* tab;
    };

    class AppUI {
    public:
        AppUI(ui::Runtime& runtime, const ui::Config& config);
        ~AppUI();

        void render();
        void process_sdl_event(SDL_Event* event);

        [[nodiscard]] bool ready() const;
        [[nodiscard]] bool done() const;

    private:
        void setup_debugger();

        UI m_ui;
        TaskScheduler m_tasks;
        std::unique_ptr<ui::Debugger> m_debugger;
        std::vector<TabEntry> m_tabs;
        UINotificationManager* m_notification_manager = nullptr;
        float m_header_end_height = 0.0f;
    };

} // namespace app
