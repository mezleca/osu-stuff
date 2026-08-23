#include <catch2/catch_test_macros.hpp>

#include "app/ui/managers/notifications.hpp"
#include "utils/imgui-context.hpp"
#include "ui/layout/geometry.hpp"
#include "ui/ui.hpp"

#include <memory>
#include <string>
#include <vector>

using namespace ui;

TEST_CASE("ui nodes draw children between their begin and end hooks") {
    class DrawNode final : public ui::Node {
    public:
        DrawNode(std::string id, std::vector<std::string>& events, bool skip = false)
            : ui::Node(std::move(id)), m_events(events), m_skip(skip) {}

    private:
        void on_layout() override {
            m_events.push_back(id() + ":layout");
        }

        bool on_draw() override {
            m_events.push_back(id() + ":begin");
            if (m_skip) {
                return false;
            }

            return true;
        }

        void on_draw_end() override {
            m_events.push_back(id() + ":end");
        }

        std::vector<std::string>& m_events;
        bool m_skip = false;
    };

    std::vector<std::string> events;
    DrawNode root("root", events);
    root.add(std::make_unique<DrawNode>("child", events));

    root.draw();
    REQUIRE(
        events ==
        std::vector<std::string>{"root:layout", "root:begin", "child:layout", "child:begin", "child:end", "root:end"}
    );

    events.clear();
    DrawNode hidden_root("hidden", events, true);
    hidden_root.add(std::make_unique<DrawNode>("child", events));

    hidden_root.draw();
    REQUIRE(events == std::vector<std::string>{"hidden:layout", "hidden:begin"});
}

TEST_CASE("node measurement only reruns after invalidation") {
    class MeasureNode final : public ui::Node {
    public:
        explicit MeasureNode(int& count) : m_count(count) {}

    private:
        void on_measure() override {
            ++m_count;
        }

        int& m_count;
    };

    int root_measurements = 0;
    int child_measurements = 0;
    MeasureNode root(root_measurements);
    auto& child = root.add_child<MeasureNode>(child_measurements);

    root.draw();
    root.draw();
    REQUIRE(root_measurements == 1);
    REQUIRE(child_measurements == 1);

    child.invalidate_measure();
    root.draw();
    REQUIRE(root_measurements == 2);
    REQUIRE(child_measurements == 2);
}

TEST_CASE("leaf nodes do not capture an imgui item produced before their draw") {
    class NoItemNode final : public ui::Node {
    public:
        using ui::Node::Node;
    };

    class ManualRectNode final : public ui::Node {
    public:
        ManualRectNode() : ui::Node("manual") {}

    private:
        bool on_draw() override {
            set_screen_rect({{40.0F, 50.0F}, {70.0F, 80.0F}});
            return true;
        }
    };

    ui_test::ImGuiContext context({200.0F, 120.0F});

    ImGui::NewFrame();
    ImGui::Begin("leaf-rect-test");
    ImGui::Dummy({30.0F, 20.0F});

    NoItemNode no_item("no-item");
    no_item.draw();

    ManualRectNode manual;
    manual.draw();

    ImGui::End();
    ImGui::EndFrame();

    const ui::Rect no_item_rect = no_item.layout().screen_rect();
    const ui::Rect manual_rect = manual.layout().screen_rect();

    REQUIRE_FALSE(no_item_rect.valid());
    REQUIRE(manual_rect.min.x == 40.0F);
    REQUIRE(manual_rect.min.y == 50.0F);
    REQUIRE(manual_rect.max.x == 70.0F);
    REQUIRE(manual_rect.max.y == 80.0F);
}

TEST_CASE("notifications animate into the overlay from outside the screen") {
    ui::Runtime runtime;
    static_cast<void>(runtime.add_font(ui::FontType::SEMIBOLD, "resources/fonts/Torus-SemiBold.ttf"));
    UI surface(runtime, {});
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
