#pragma once

#include "../tasks/tasks.hpp"

#include <ui/ui.hpp>
#include <ui/backends/sdl/backend.hpp>
#include <SDL3/SDL_events.h>
#include <memory>
#include <vector>

class UINotificationManager;
class TabButtonWidget;
class UITab;

struct TabEntry {
    TabButtonWidget* button;
    UITab* tab;
};

class AppUI {
public:
    AppUI(ui::Runtime& runtime, std::unique_ptr<ui::Backend> backend);
    ~AppUI();

    void render();
    void process_sdl_event(SDL_Event* event);

    [[nodiscard]] bool ready() const;
    [[nodiscard]] bool done() const;

private:
    void configure_debugger();

    ui::UI m_ui;
    TaskScheduler m_tasks;
    std::vector<TabEntry> m_tabs;
    UINotificationManager* m_notification_manager = nullptr;
    float m_header_end_height = 0.0f;
};
