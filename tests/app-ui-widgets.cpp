#include <ui/widgets/range.hpp>

#include "ui/managers/notifications.hpp"
#include "utils/imgui-context.hpp"

#include <ui/layout/stack-container.hpp>
#include <ui/runtime.hpp>
#include <ui/ui.hpp>
#include <ui/widgets/text.hpp>
#include <ui/widgets/checkbox.hpp>

#include "ui/widgets/collection-card.hpp"

#include <catch2/catch_test_macros.hpp>
#include <imgui.h>

#include <filesystem>
#include <memory>
#include <utility>

using namespace app;

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
    REQUIRE(initial_right_rect.size().x < 640.0F);
    REQUIRE(initial_right_rect.size().y < 480.0F);
    REQUIRE(left_initial_x < left_target_x);
    REQUIRE(left_next_x > left_initial_x);
    REQUIRE(left_next_x < left_target_x);
    REQUIRE(initial_left_rect.max.x <= 0.0F);
}

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

TEST_CASE("range respects its outer size and stack spacing", "[ui][layout][regression]") {
    ui::Runtime runtime;
    UI surface(runtime, {.size = {320.0F, 220.0F}});
    float minimum = 2.0F;
    float maximum = 8.0F;

    ui::StackContainer stack("range-stack");
    stack.set_size({280.0F, 180.0F});
    stack.set_spacing(10.0F);
    auto& range = stack.add_child<RangeWidget>(surface, minimum, maximum, "range");
    range.set_label("difficulty range").set_bounds(0.0F, 10.0F).set_size({200.0F, 60.0F});
    auto& sibling = stack.add_child<ui::TextWidget>("notification controls");

    ImGui::SetCurrentContext(surface.imgui_context());
    unsigned char* font_pixels = nullptr;
    int font_width = 0;
    int font_height = 0;
    ImGui::GetIO().Fonts->GetTexDataAsRGBA32(&font_pixels, &font_width, &font_height);
    ImGui::GetIO().DisplaySize = {320.0F, 220.0F};

    surface.begin_frame();
    ImGui::SetNextWindowPos({0.0F, 0.0F});
    ImGui::SetNextWindowSize({320.0F, 220.0F});
    ImGui::Begin("range-stack-test");
    stack.update(ImGui::GetIO().DeltaTime);
    stack.draw();
    ImGui::End();
    surface.end_frame();

    const float body_bottom = range.maximum_thumb().layout().screen_rect().max.y;
    REQUIRE(range.layout().size().y == 60.0F);
    REQUIRE(sibling.layout().screen_rect().min.y >= body_bottom + stack.spacing());
}

TEST_CASE("checkboxes inside passive stacks receive pointer clicks", "[ui][input][regression]") {
    ui::Runtime runtime;
    UI surface(runtime, {.size = {320.0F, 220.0F}});
    bool checked = false;

    ImGui::SetCurrentContext(surface.imgui_context());
    ImGui::GetIO().DisplaySize = {320.0F, 220.0F};

    auto& stack = surface.root().add_child<ui::StackContainer>("checkbox-stack");
    stack.clear_input_target();
    stack.set_size({240.0F, 80.0F});
    auto& checkbox = stack.add_child<ui::CheckboxWidget>(surface, checked, "checkbox");
    ui_test::ImGuiContext::build_fonts();

    const auto draw_frame = [&surface] {
        surface.begin_input_frame();
        surface.begin_frame();
        surface.root().update(ImGui::GetIO().DeltaTime);
        surface.root().draw();
        surface.end_frame();
    };

    draw_frame();
    const ui::Rect rect = checkbox.layout().screen_rect();
    REQUIRE(rect.valid());
    const ImVec2 position = {(rect.min.x + rect.max.x) * 0.5F, (rect.min.y + rect.max.y) * 0.5F};
    REQUIRE(surface.input_router().node_at(position) == &checkbox);

    ui::UiEvent down = ui::UiEvent::make(ui::EventType::PointerDown);
    down.position = position;
    down.button = ui::PointerButton::Left;
    REQUIRE_FALSE(surface.dispatch(down));

    ui::UiEvent up = ui::UiEvent::make(ui::EventType::PointerUp);
    up.position = position;
    up.button = ui::PointerButton::Left;
    REQUIRE_FALSE(surface.dispatch(up));
    REQUIRE(checked);
}

TEST_CASE("interactive stacks keep checkbox and collection card clicks", "[ui][input][regression]") {
    ui::Runtime runtime;
    runtime.add_font(
        ui::FontType::SEMIBOLD, std::filesystem::path(OSU_STUFF_SOURCE_DIR) / "resources/runtime/fonts/Torus-SemiBold.ttf"
    );
    UI surface(runtime, {.size = {320.0F, 220.0F}});
    bool checked = false;
    bool radio_checked = false;

    ImGui::SetCurrentContext(surface.imgui_context());
    ImGui::GetIO().DisplaySize = {320.0F, 220.0F};

    auto& stack = surface.root().add_child<ui::StackContainer>("interactive-stack");
    stack.set_size({240.0F, 160.0F});
    stack.set_input_target();
    auto& checkbox = stack.add_child<ui::CheckboxWidget>(surface, checked, "checkbox");
    auto& radio = stack.add_child<ui::CheckboxWidget>(surface, radio_checked, "radio");
    radio.set_type(ui::CheckboxType::Radio);
    auto& card = stack.add_child<CollectionCardWidget>(surface, "collection");
    card.on_event = [&card](ui::UiEvent& event) {
        if (event.type == ui::EventType::Click) {
            card.toggle_selected();
        }
    };
    ui_test::ImGuiContext::build_fonts();

    const auto draw_frame = [&surface] {
        surface.begin_input_frame();
        surface.begin_frame();
        surface.root().update(ImGui::GetIO().DeltaTime);
        surface.root().draw();
        surface.end_frame();
    };

    const auto click = [&surface](ui::Widget& widget) {
        const ui::Rect rect = widget.layout().screen_rect();
        const ImVec2 position = {(rect.min.x + rect.max.x) * 0.5F, (rect.min.y + rect.max.y) * 0.5F};
        REQUIRE(surface.input_router().node_at(position) == &widget);

        ui::UiEvent down = ui::UiEvent::make(ui::EventType::PointerDown);
        down.position = position;
        down.button = ui::PointerButton::Left;
        surface.dispatch(down);

        ui::UiEvent up = ui::UiEvent::make(ui::EventType::PointerUp);
        up.position = position;
        up.button = ui::PointerButton::Left;
        surface.dispatch(up);
    };

    draw_frame();
    click(checkbox);
    click(radio);
    click(card);
    draw_frame();

    ui::UiEvent move = ui::UiEvent::make(ui::EventType::PointerMove);
    move.position = {300.0F, 200.0F};
    surface.dispatch(move);

    REQUIRE(checked);
    REQUIRE(radio_checked);
    REQUIRE(checkbox.fill().layout().screen_rect().valid());
    REQUIRE(radio.fill().layout().screen_rect().valid());
    REQUIRE(card.is_selected());
    REQUIRE(card.style_type() == ui::StyleType::ACTIVE);
}
