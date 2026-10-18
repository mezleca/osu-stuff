#include "ui/managers/modal.hpp"
#include "ui/managers/notifications.hpp"
#include "ui/widgets/collection-card.hpp"
#include "ui/widgets/range.hpp"
#include "ui/widgets/tab-button.hpp"
#include "utils/imgui-context.hpp"

#include <imgui-ui/imgui/context-scope.hpp>
#include <imgui-ui/runtime.hpp>
#include <imgui-ui/surface.hpp>
#include <imgui-ui/widgets/button.hpp>
#include <imgui-ui/widgets/text-input.hpp>
#include <catch2/catch_test_macros.hpp>

using namespace ui;

static void draw_ui(Surface& surface, float dt = 0.1F) {
    surface.begin_frame();
    surface.update(dt);
    surface.draw();
    surface.end_frame();
}

static ImVec2 center(const Node& node) {
    const Rect rect = node.layout().visual_rect();
    return {(rect.min.x + rect.max.x) * 0.5F, (rect.min.y + rect.max.y) * 0.5F};
}

static void pointer_input(Surface& surface, EventType type, ImVec2 position) {
    UiEvent event = UiEvent::make(type);
    event.position = position;
    event.button = PointerButton::Left;
    surface.dispatch(event);
    ImGui::GetIO().AddMousePosEvent(position.x, position.y);
    if (type == EventType::PointerDown) ImGui::GetIO().AddMouseButtonEvent(0, true);
    if (type == EventType::PointerUp) ImGui::GetIO().AddMouseButtonEvent(0, false);
    draw_ui(surface);
}

TEST_CASE("custom range preserves native dragging and thumb geometry", "[ui][regression]") {
    Runtime runtime;
    Surface surface(runtime, {.backend = ui_test::make_backend(), .file_dialog_backend = nullptr});
    float minimum = 2.0F;
    float maximum = 8.0F;
    auto& range = surface.root().add<RangeWidget>(minimum, maximum, "range");
    range.set_bounds(0.0F, 10.0F).set_step(0.1F).set_size({px(380.0F), fit()});
    const ImGuiContextScope context(surface.imgui_context());
    ui_test::ImGuiContext::build_fonts();
    draw_ui(surface);
    draw_ui(surface);

    const ImVec2 start = center(range.minimum_thumb());
    auto motion = UiEvent::make(EventType::PointerMove);
    motion.position = start;
    surface.dispatch(motion);
    REQUIRE(range.input_state().hovered);
    pointer_input(surface, EventType::PointerMove, start);
    pointer_input(surface, EventType::PointerDown, start);
    pointer_input(surface, EventType::PointerMove, {start.x + 60.0F, start.y});
    REQUIRE(minimum > 2.0F);
    REQUIRE(minimum < maximum);
    REQUIRE(maximum == 8.0F);
    pointer_input(surface, EventType::PointerUp, {start.x + 60.0F, start.y});
    const float released = minimum;
    pointer_input(surface, EventType::PointerMove, {start.x + 100.0F, start.y});
    REQUIRE(minimum == released);
    REQUIRE(range.minimum_thumb().layout().visual_rect().min.x >= range.layout().visual_rect().min.x);
    REQUIRE(range.maximum_thumb().layout().visual_rect().max.x <= range.layout().visual_rect().max.x);
}

TEST_CASE("custom cards and tabs keep selection across hover changes", "[ui][regression]") {
    Runtime runtime;
    Surface surface(runtime, {.backend = ui_test::make_backend(), .file_dialog_backend = nullptr});
    auto& card = surface.root().add<CollectionCardWidget>("collection");
    auto& tab = surface.root().add<TabButtonWidget>("collections");
    card.on_event([&](UiEvent& event) {
        if (event.type == EventType::Click) card.toggle_selected();
    });
    const ImGuiContextScope context(surface.imgui_context());
    ui_test::ImGuiContext::build_fonts();
    draw_ui(surface);
    draw_ui(surface);
    pointer_input(surface, EventType::PointerDown, center(card));
    pointer_input(surface, EventType::PointerUp, center(card));
    REQUIRE(card.is_selected());
    pointer_input(surface, EventType::PointerMove, {1000.0F, 600.0F});
    REQUIRE(card.style(card.style_type()).background_color().value == card.style(StyleType::ACTIVE).background_color().value);
    REQUIRE(tab.layout().size().x > 0.0F);
    REQUIRE(tab.layout().size().y > 0.0F);
    tab.set_selected(true);
    draw_ui(surface);
    pointer_input(surface, EventType::PointerMove, center(tab));
    pointer_input(surface, EventType::PointerMove, {1000.0F, 600.0F});
    draw_ui(surface);
    REQUIRE(tab.is_selected());
    REQUIRE(tab.style(tab.style_type()).color().value == tab.style(StyleType::ACTIVE).color().value);
}

TEST_CASE("notification overlays preserve keyboard input and deferred removal", "[ui][regression]") {
    Runtime runtime;
    Surface surface(runtime, {.backend = ui_test::make_backend(), .file_dialog_backend = nullptr});
    int keys = 0;
    int clicks = 0;
    auto& input = surface.root().add<ButtonWidget>("keyboard target");
    input.set_size({grow(), grow()});
    input.on_click([&] { ++clicks; });
    input.on_key_press([&](UiEvent&) { ++keys; });
    auto& manager = surface.root().add<UINotificationManager>();
    auto& notification = manager.add(
        LogNotificationLevel::INFO, "a long notification that wraps across several lines without clipping the close icon"
    );
    manager.add(LogNotificationLevel::WARN, "second");
    const ImGuiContextScope context(surface.imgui_context());
    ui_test::ImGuiContext::build_fonts();
    draw_ui(surface);
    draw_ui(surface);
    draw_ui(surface);
    REQUIRE(notification.accepts_input());
    REQUIRE(notification.children().back()->layout().visual_rect().max.x <= notification.layout().visual_rect().max.x);
    surface.input_router().set_focus(&input);
    auto key = UiEvent::make(EventType::KeyDown);
    key.key = Key::Enter;
    surface.dispatch(key);
    REQUIRE(keys == 1);
    const ImVec2 icon = center(*notification.children().back());
    pointer_input(surface, EventType::PointerDown, icon);
    pointer_input(surface, EventType::PointerUp, icon);
    for (int i = 0; i < 4; ++i)
        draw_ui(surface);
    REQUIRE(manager.count() == 1);
    REQUIRE(clicks == 0);
    manager.clear_notifications();
    REQUIRE(manager.count() == 0);
    draw_ui(surface);
    REQUIRE(manager.count() == 0);
}

TEST_CASE("modal panels keep internal clicks and block backdrop input", "[ui][regression]") {
    Runtime runtime;
    Surface surface(runtime, {.backend = ui_test::make_backend(), .file_dialog_backend = nullptr});
    auto& modal = surface.root().add<UIModalManager>();
    auto& panel = modal.open("modal");
    std::string text;
    auto& input = panel.add<TextInputWidget>(text, "input");
    const ImGuiContextScope context(surface.imgui_context());
    ui_test::ImGuiContext::build_fonts();
    draw_ui(surface);
    draw_ui(surface);
    pointer_input(surface, EventType::PointerDown, center(input));
    pointer_input(surface, EventType::PointerUp, center(input));
    REQUIRE(modal.is_open());
    surface.input_router().set_focus(&input);
    auto typing = UiEvent::make(EventType::TextInput);
    typing.text = "ok";
    surface.dispatch(typing);
    REQUIRE_FALSE(typing.native_input_blocked);
    ImGui::GetIO().AddInputCharactersUTF8(typing.text.c_str());
    draw_ui(surface);
    REQUIRE(text == "ok");
    auto escape = UiEvent::make(EventType::KeyDown);
    escape.key = Key::Escape;
    surface.dispatch(escape);
    // text editing consumes the first escape and restores modal focus before the next escape dismisses it.
    REQUIRE(modal.is_open());
    REQUIRE_FALSE(input.input_state().focused);
    escape = UiEvent::make(EventType::KeyDown);
    escape.key = Key::Escape;
    surface.dispatch(escape);
    REQUIRE_FALSE(modal.is_open());
    modal.open("reopened");
    draw_ui(surface);
    auto click = UiEvent::make(EventType::PointerDown);
    click.button = PointerButton::Left;
    click.position = {20.0F, 20.0F};
    surface.dispatch(click);
    REQUIRE_FALSE(modal.is_open());
    REQUIRE(click.native_input_blocked);
}
