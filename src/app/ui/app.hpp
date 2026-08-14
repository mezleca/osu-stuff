#pragma once

#include "../../ui/ui.hpp"

#include <vector>

class UINotificationManager;
class TabButtonWidget;
class UITab;

namespace app {
    struct TabEntry {
        TabButtonWidget* button;
        UITab* tab;
    };

    class OsuStuffApp {
    public:
        explicit OsuStuffApp(UI& ui);
        ~OsuStuffApp();

        void render();
        [[nodiscard]] UINotificationManager* notification_manager();

    private:
        UI& m_ui;
        std::vector<TabEntry> m_tabs;
        UINotificationManager* m_notification_manager = nullptr;
        UITab* m_current_tab = nullptr;
        float m_header_end_height = 0.0f;
    };

    OsuStuffApp& current();

} // namespace app
