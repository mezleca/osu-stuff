#include <app/ui/widgets/context-menu.hpp>
#include <app/ui/widgets/range.hpp>

#include "app/ui/managers/notifications.hpp"
#include "utils/imgui-context.hpp"

#include <ui/layout/stack-container.hpp>
#include <ui/runtime.hpp>
#include <ui/ui.hpp>
#include <ui/widgets/text.hpp>

#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>
#include <imgui.h>

#include <filesystem>
#include <memory>
#include <utility>

namespace app_ui_widgets_test {
    void draw_context_menu(UI& surface, float dt = 0.2F) {
        surface.begin_input_frame();
        surface.begin_frame();
        ImGui::Begin("context-menu-test");
        surface.root().update(dt);
        surface.root().draw();
        ImGui::End();
        surface.end_frame();
    }

    ui::UiEvent pointer_event(ui::EventType type, ImVec2 position) {
        ui::UiEvent event = ui::UiEvent::make(type);
        event.position = position;
        event.button = ui::PointerButton::Left;
        return event;
    }
} // namespace app_ui_widgets_test

TEST_CASE("context menus start hidden and fade out after closing") {
    ui::Runtime runtime;
    UI surface(runtime, ui::Config{});
    ImGui::SetCurrentContext(surface.imgui_context());
    ImGui::GetIO().DisplaySize = {640.0F, 480.0F};
    ui_test::ImGuiContext::build_fonts();
    auto& menu = surface.root().add_child<ContextMenuWidget>(surface, ContextMenuList{{.name = "item"}});

    REQUIRE_FALSE(menu.visible());
    menu.show({400.0F, 350.0F});
    REQUIRE(menu.visible());
    REQUIRE(menu.is_open());

    app_ui_widgets_test::draw_context_menu(surface);
    REQUIRE(menu.opacity() == Catch::Approx(1.0F));
    REQUIRE(menu.layout().screen_rect().min.x == Catch::Approx(400.0F));
    REQUIRE(menu.layout().screen_rect().min.y == Catch::Approx(350.0F));

    menu.hide();
    REQUIRE_FALSE(menu.is_open());
    REQUIRE(menu.visible());
    app_ui_widgets_test::draw_context_menu(surface);
    REQUIRE_FALSE(menu.visible());
}

TEST_CASE("context menu item callbacks can cancel the close request") {
    ui::Runtime runtime;
    UI surface(runtime, ui::Config{});
    ImGui::SetCurrentContext(surface.imgui_context());
    ImGui::GetIO().DisplaySize = {640.0F, 480.0F};
    ui_test::ImGuiContext::build_fonts();
    bool callback_called = false;

    ContextMenuList items;
    items.push_back({
        .name = "keep open",
        .on_click = [&callback_called](ContextMenuWidget& menu) {
            callback_called = true;
            menu.cancel_close_request();
        },
    });

    auto& menu = surface.root().add_child<ContextMenuWidget>(surface, std::move(items));
    menu.show();
    app_ui_widgets_test::draw_context_menu(surface);

    const ImVec2 item_min = menu.children().front()->layout().screen_rect().min;
    const ImVec2 item_position = {item_min.x + 4.0F, item_min.y + 4.0F};
    ui::UiEvent pointer_down = app_ui_widgets_test::pointer_event(ui::EventType::PointerDown, item_position);
    ui::UiEvent pointer_up = app_ui_widgets_test::pointer_event(ui::EventType::PointerUp, item_position);
    surface.dispatch(pointer_down);
    REQUIRE(surface.dispatch(pointer_up));

    REQUIRE(callback_called);
    REQUIRE(menu.is_open());
    REQUIRE(menu.visible());
}

TEST_CASE("context menu builds hidden submenus and clamps its horizontal position") {
    ui::Runtime runtime;
    UI surface(runtime, ui::Config{});
    ImGui::SetCurrentContext(surface.imgui_context());
    ImGui::GetIO().DisplaySize = {320.0F, 240.0F};
    ui_test::ImGuiContext::build_fonts();

    ContextMenuList children;
    children.push_back({.name = "child"});

    ContextMenuList items;
    items.push_back({.name = "parent", .children = std::move(children)});

    auto& menu = surface.root().add_child<ContextMenuWidget>(surface, std::move(items));
    menu.set_placement(ui::Anchor::TopLeft, ui::Origin::TopLeft, {300.0F, 4.0F});
    menu.show();
    app_ui_widgets_test::draw_context_menu(surface);

    REQUIRE(menu.children().size() == 2);
    REQUIRE_FALSE(menu.children()[1]->visible());
    REQUIRE(menu.layout().screen_rect().max.x <= ImGui::GetMainViewport()->WorkPos.x + ImGui::GetMainViewport()->WorkSize.x);
}

TEST_CASE("context menu opens submenus on click or delayed hover and closes after leaving") {
    ui::Runtime runtime;
    UI surface(runtime, ui::Config{});
    ImGui::SetCurrentContext(surface.imgui_context());
    ImGui::GetIO().DisplaySize = {400.0F, 300.0F};
    ui_test::ImGuiContext::build_fonts();

    auto& menu = surface.root().add_child<ContextMenuWidget>(
        surface, ContextMenuList{{.name = "parent", .children = {{.name = "child"}}}}
    );
    auto& submenu = *static_cast<ContextMenuWidget*>(menu.children()[1].get());
    menu.show({20.0F, 20.0F});
    app_ui_widgets_test::draw_context_menu(surface, 0.01F);

    const ui::Rect field_rect = menu.children().front()->layout().screen_rect();
    const ImVec2 field_position = {field_rect.min.x + 4.0F, field_rect.min.y + 4.0F};
    ui::UiEvent pointer_down = app_ui_widgets_test::pointer_event(ui::EventType::PointerDown, field_position);
    ui::UiEvent pointer_up = app_ui_widgets_test::pointer_event(ui::EventType::PointerUp, field_position);
    surface.dispatch(pointer_down);
    surface.dispatch(pointer_up);
    REQUIRE(submenu.visible());
    ImGui::GetIO().MousePos = field_position;
    app_ui_widgets_test::draw_context_menu(surface, 0.01F);
    REQUIRE(submenu.layout().screen_rect().min.x == Catch::Approx(field_rect.max.x + 6.0F));
    REQUIRE(submenu.layout().screen_rect().max.x > menu.layout().screen_rect().max.x + 100.0F);
    REQUIRE(submenu.layout().screen_rect().size().x == Catch::Approx(184.0F));

    menu.hide();
    app_ui_widgets_test::draw_context_menu(surface);
    menu.show({20.0F, 20.0F});
    ImGui::GetIO().MousePos = field_position;
    app_ui_widgets_test::draw_context_menu(surface, 0.01F);
    app_ui_widgets_test::draw_context_menu(surface, 0.05F);
    REQUIRE_FALSE(submenu.visible());
    app_ui_widgets_test::draw_context_menu(surface, 0.051F);
    REQUIRE(submenu.visible());

    ImGui::GetIO().MousePos = {390.0F, 290.0F};
    app_ui_widgets_test::draw_context_menu(surface, 0.49F);
    REQUIRE(menu.is_open());
    app_ui_widgets_test::draw_context_menu(surface, 0.02F);
    REQUIRE_FALSE(menu.is_open());
}

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
