#include "ui/managers/notifications.hpp"
#include "utils/imgui-context.hpp"

#include <catch2/catch_test_macros.hpp>
#include <imgui.h>
#include <ui/runtime.hpp>
#include <ui/ui.hpp>

#include <filesystem>
#include <memory>

using namespace ui;

TEST_CASE("non-persistent notifications close after their duration") {
    class TimedNotification final : public UINotification {
    public:
        explicit TimedNotification(UI& ui) : UINotification(ui) {}

        void close() override {
            if (m_closing) {
                return;
            }

            m_closing = true;
            ++close_count;
        }

        int close_count = 0;
    };

    Runtime runtime;
    UI surface(runtime, {.backend = ui_test::make_backend()});
    TimedNotification notification(surface);

    REQUIRE(notification.persistent);
    notification.duration = 1.0F;
    notification.update(2.0F);
    REQUIRE(notification.close_count == 0);

    notification.persistent = false;
    notification.update(0.25F);
    REQUIRE(notification.close_count == 0);
    notification.update(0.75F);
    REQUIRE(notification.close_count == 1);
    REQUIRE(notification.duration == 1.0F);
    notification.update(1.0F);
    REQUIRE(notification.close_count == 1);
}
