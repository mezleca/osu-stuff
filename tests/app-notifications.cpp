#include <catch2/catch_test_macros.hpp>

#include "app/ui/managers/notifications.hpp"
#include "utils/imgui-context.hpp"

#include <ui/layout/geometry.hpp>
#include <ui/ui.hpp>

#include <filesystem>
#include <memory>

TEST_CASE("notifications animate into the overlay from outside the screen") {
    ui::Runtime runtime;
    runtime.add_font(
        ui::FontType::SEMIBOLD, std::filesystem::path(OSU_STUFF_SOURCE_DIR) / "resources/runtime/fonts/Torus-SemiBold.ttf"
    );
    UI surface(runtime, ui::Config{});
    UINotificationManager manager(surface);
    REQUIRE(manager.add(std::make_unique<LogNotificationWidget>(surface, LogNotificationLevel::INFO, "notification")));

    ui_test::ImGuiContext context({640.0F, 480.0F});

    const auto draw_frame = [&manager] {
        ImGui::NewFrame();
        manager.draw();
        ImGui::EndFrame();
    };

    draw_frame();
    const float target_x = manager.get(0)->target_offset().value.x;
    const float initial_x = manager.get(0)->current_offset().value.x;
    const ui::Rect initial_right_rect = manager.get(0)->layout().screen_rect();
    draw_frame();
    const float next_x = manager.get(0)->current_offset().value.x;

    manager.set_position(ui::OverlayPosition::LEFT);
    draw_frame();
    const float left_target_x = manager.get(0)->target_offset().value.x;
    const float left_initial_x = manager.get(0)->current_offset().value.x;
    const ui::Rect initial_left_rect = manager.get(0)->layout().screen_rect();
    draw_frame();
    const float left_next_x = manager.get(0)->current_offset().value.x;

    REQUIRE(initial_x > target_x);
    REQUIRE(next_x < initial_x);
    REQUIRE(next_x > target_x);
    REQUIRE(initial_right_rect.min.x >= 640.0F);
    REQUIRE(left_initial_x < left_target_x);
    REQUIRE(left_next_x > left_initial_x);
    REQUIRE(left_next_x < left_target_x);
    REQUIRE(initial_left_rect.max.x <= 0.0F);
}

TEST_CASE("non-persistent notifications close after their duration") {
    class TimedNotification final : public UINotification {
    public:
        explicit TimedNotification(UI& ui) : UINotification(ui) {}

        bool on_draw() override {
            return true;
        }

        void close() override {
            if (m_closing) {
                return;
            }

            m_closing = true;
            ++close_count;
        }

        int close_count = 0;
    };

    ui::Runtime runtime;
    UI surface(runtime, ui::Config{});
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
