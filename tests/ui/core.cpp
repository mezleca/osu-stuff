#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>

#include "ui/input/router.hpp"
#include "ui/diagnostics/profiler.hpp"
#include "ui/layout/child-container.hpp"
#include "ui/layout/geometry.hpp"
#include "ui/layout/modal-container.hpp"
#include "ui/layout/resizable-container.hpp"
#include "ui/layout/stack-container.hpp"
#include "ui/style/theme.hpp"
#include "ui/ui.hpp"
#include "ui/widgets/text.hpp"
#include "app/ui/managers/notifications.hpp"

#include <array>
#include <format>
#include <memory>
#include <string>
#include <vector>

using namespace ui;

static UiEvent event_of(EventType type, ImVec2 position = {}) {
    return {
        .type = type,
        .position = position,
        .scroll = {},
        .button = ui::PointerButton::Left,
        .key = 0,
        .text = {},
        .handled = false,
        .propagation_stopped = false,
        .default_prevented = false,
    };
}

static UiEvent click_event(ImVec2 position = {}) {
    return event_of(EventType::Click, position);
}

class EventNode final : public ui::Node {
public:
    explicit EventNode(std::string node_id, std::vector<std::string>& events)
        : ui::Node(std::move(node_id)), m_events(events) {
        on_event = [this](ui::UiEvent& event) {
            m_events.push_back(id());
            if (stop_events) {
                event.stop_propagation();
            } else if (handle_events) {
                event.mark_handled();
            }
        };
    }

    bool handle_events = false;
    bool stop_events = false;

private:
    std::vector<std::string>& m_events;
};

TEST_CASE("ui profiler publishes completed nested zones") {
    ui::Profiler profiler;
    profiler.set_enabled(true);
    profiler.begin_frame();

    {
        ui::ScopedProfileZone outer(&profiler, "outer", 10);
        ui::ScopedProfileZone inner(&profiler, "inner", 20);
    }

    profiler.end_frame();
    const std::span<const ui::ProfileEvent> events = profiler.latest_events();

    REQUIRE(events.size() == 2);
    REQUIRE(events[0].name == "outer");
    REQUIRE(events[0].depth == 0);
    REQUIRE(events[1].name == "inner");
    REQUIRE(events[1].depth == 1);
    REQUIRE(events[0].end >= events[0].start);
    REQUIRE(events[1].end >= events[1].start);
    REQUIRE(profiler.node_duration_ms(20) >= 0.0);
    REQUIRE(profiler.dropped_events() == 0);
    REQUIRE(profiler.has_report());

    profiler.clear_report();
    REQUIRE_FALSE(profiler.has_report());
}

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

TEST_CASE("notifications animate into the overlay from outside the screen") {
    ui::Runtime runtime;
    UI surface(runtime, {});
    UINotificationManager manager(surface);
    REQUIRE(manager.add(std::make_unique<LogNotificationWidget>(surface, LogNotificationLevel::INFO, "notification")));

    ImGuiContext* previous_context = ImGui::GetCurrentContext();
    ImGuiContext* context = ImGui::CreateContext();
    ImGui::SetCurrentContext(context);
    ImGui::GetIO().DisplaySize = {640.0F, 480.0F};
    ImGui::GetIO().DeltaTime = 1.0F / 60.0F;

    unsigned char* font_pixels = nullptr;
    int font_width = 0;
    int font_height = 0;
    int font_bytes_per_pixel = 0;
    ImGui::GetIO().Fonts->GetTexDataAsRGBA32(&font_pixels, &font_width, &font_height, &font_bytes_per_pixel);

    const auto draw_frame = [&manager] {
        ImGui::NewFrame();
        manager.draw();
        ImGui::EndFrame();
    };

    draw_frame();
    const float target_x = manager.get(0)->target_offset().value.x;
    const float initial_x = manager.get(0)->current_offset().value.x;
    const ui::Rect initial_right_rect = manager.get(0)->rect();
    draw_frame();
    const float next_x = manager.get(0)->current_offset().value.x;

    manager.set_position(ui::OverlayPosition::LEFT);
    draw_frame();
    const float left_target_x = manager.get(0)->target_offset().value.x;
    const float left_initial_x = manager.get(0)->current_offset().value.x;
    const ui::Rect initial_left_rect = manager.get(0)->rect();
    draw_frame();
    const float left_next_x = manager.get(0)->current_offset().value.x;

    ImGui::SetCurrentContext(previous_context);
    ImGui::DestroyContext(context);

    REQUIRE(initial_x > target_x);
    REQUIRE(next_x < initial_x);
    REQUIRE(next_x > target_x);
    REQUIRE(initial_right_rect.min.x >= 640.0F);
    REQUIRE(left_initial_x < left_target_x);
    REQUIRE(left_next_x > left_initial_x);
    REQUIRE(left_next_x < left_target_x);
    REQUIRE(initial_left_rect.max.x <= 0.0F);
}

TEST_CASE("ui events flows from target to parents") {
    std::vector<std::string> events;
    auto parent = std::make_unique<EventNode>("parent", events);
    auto child = std::make_unique<EventNode>("child", events);
    EventNode* child_ptr = child.get();
    parent->add(std::move(child));

    ui::InputRouter router;
    ui::UiEvent event = click_event();
    const bool handled = router.dispatch(*child_ptr, event);
    REQUIRE_FALSE(handled);

    REQUIRE(events == std::vector<std::string>{"child", "parent"});
}

TEST_CASE("ui events can stop propagation") {
    std::vector<std::string> events;
    auto parent = std::make_unique<EventNode>("parent", events);
    auto child = std::make_unique<EventNode>("child", events);
    EventNode* child_ptr = child.get();
    child_ptr->stop_events = true;
    parent->add(std::move(child));

    ui::InputRouter router;
    ui::UiEvent event = click_event();
    const bool handled = router.dispatch(*child_ptr, event);
    REQUIRE(handled);

    REQUIRE(event.handled);
    REQUIRE(event.propagation_stopped);
    REQUIRE(events == std::vector<std::string>{"child"});
}

TEST_CASE("pointer capture keeps drag events on the original node") {
    ui::InputRouter router;
    ui::Node node("drag");
    std::vector<ui::EventType> events;

    node.on_event = [&router, &node, &events](ui::UiEvent& event) {
        events.push_back(event.type);
        if (event.type == ui::EventType::PointerDown) {
            REQUIRE(router.capture_pointer(node));
        }
        event.mark_handled();
    };

    router.register_region(node, {{0.0F, 0.0F}, {10.0F, 10.0F}});

    auto down = event_of(ui::EventType::PointerDown, {5.0F, 5.0F});
    REQUIRE(router.dispatch(down));

    router.begin_frame();
    auto move = event_of(ui::EventType::PointerMove, {100.0F, 100.0F});
    REQUIRE(router.dispatch(move));

    auto up = event_of(ui::EventType::PointerUp, {100.0F, 100.0F});
    REQUIRE(router.dispatch(up));
    REQUIRE(
        events == std::vector<ui::EventType>{
                      ui::EventType::PointerDown,
                      ui::EventType::PointerMove,
                      ui::EventType::PointerUp,
                  }
    );

    router.begin_frame();
    auto move_after_release = event_of(ui::EventType::PointerMove, {100.0F, 100.0F});
    REQUIRE_FALSE(router.dispatch(move_after_release));
}

TEST_CASE("input router invalidates inactive focus and pointer capture") {
    std::vector<std::string> events;
    EventNode node("input", events);
    node.handle_events = true;

    ui::InputRouter router;
    REQUIRE(router.set_focus(node));
    events.clear();

    node.set_visible(false);
    auto hidden_key = event_of(ui::EventType::KeyDown);
    REQUIRE_FALSE(router.dispatch(hidden_key));
    REQUIRE(router.focused_node() == nullptr);
    REQUIRE(events.empty());

    node.set_visible(true);
    REQUIRE(router.set_focus(node));
    events.clear();

    node.set_enabled(false);
    auto disabled_key = event_of(ui::EventType::KeyDown);
    REQUIRE_FALSE(router.dispatch(disabled_key));
    REQUIRE(router.focused_node() == nullptr);
    REQUIRE(events.empty());

    node.set_enabled(true);
    REQUIRE(router.capture_pointer(node));
    events.clear();

    node.set_enabled(false);
    auto disabled_move = event_of(ui::EventType::PointerMove, {100.0F, 100.0F});
    REQUIRE_FALSE(router.dispatch(disabled_move));
    REQUIRE(events.empty());
}

TEST_CASE("input router clears targets when a node is detached") {
    std::vector<std::string> events;
    ui::Node parent("parent");
    auto child = std::make_unique<EventNode>("child", events);
    EventNode* child_ptr = child.get();
    child_ptr->handle_events = true;
    parent.add(std::move(child));

    ui::InputRouter router;
    parent.set_input_router(&router);
    REQUIRE(router.set_focus(*child_ptr));
    REQUIRE(router.capture_pointer(*child_ptr));
    events.clear();

    auto detached = parent.remove(*child_ptr);
    REQUIRE(detached != nullptr);
    events.clear();

    auto key = event_of(ui::EventType::KeyDown);
    REQUIRE_FALSE(router.dispatch(key));
    REQUIRE(router.focused_node() == nullptr);
    REQUIRE(events.empty());

    auto move = event_of(ui::EventType::PointerMove, {100.0F, 100.0F});
    REQUIRE_FALSE(router.dispatch(move));
    REQUIRE(events.empty());
}

TEST_CASE("input routers isolate focus and pointer capture between surfaces") {
    std::vector<std::string> events;
    EventNode surface_a_node("surface-a", events);
    EventNode surface_b_node("surface-b", events);
    surface_a_node.handle_events = true;
    surface_b_node.handle_events = true;

    ui::InputRouter surface_a_router;
    ui::InputRouter surface_b_router;
    REQUIRE(surface_a_router.set_focus(surface_a_node));
    REQUIRE(surface_b_router.set_focus(surface_b_node));
    REQUIRE(surface_a_router.capture_pointer(surface_a_node));
    REQUIRE(surface_b_router.capture_pointer(surface_b_node));

    events.clear();
    auto surface_a_key = event_of(ui::EventType::KeyDown);
    auto surface_b_key = event_of(ui::EventType::KeyDown);
    REQUIRE(surface_a_router.dispatch(surface_a_key));
    REQUIRE(surface_b_router.dispatch(surface_b_key));
    REQUIRE(events == std::vector<std::string>{"surface-a", "surface-b"});

    surface_a_router.clear_focus();
    surface_a_router.release_pointer();
    REQUIRE(surface_a_router.focused_node() == nullptr);
    REQUIRE(surface_b_router.focused_node() == &surface_b_node);

    auto surface_b_move = event_of(ui::EventType::PointerMove, {100.0F, 100.0F});
    REQUIRE(surface_b_router.dispatch(surface_b_move));
    REQUIRE(events.back() == "surface-b");
}

TEST_CASE("blocking modal layer prevents content input") {
    std::vector<std::string> events;
    EventNode content("content", events);
    EventNode modal("modal", events);
    modal.handle_events = true;

    ui::InputRouter router;
    router.set_layer_policy(ui::InputLayer::Modal, ui::InputPolicy::BlockAll);
    router.begin_frame();
    router.register_region(content, {{0.0F, 0.0F}, {100.0F, 100.0F}});
    router.register_region_in_layer(modal, {{25.0F, 25.0F}, {75.0F, 75.0F}}, ui::InputLayer::Modal);

    ui::UiEvent outside = click_event({10.0F, 10.0F});
    REQUIRE(router.dispatch(outside));
    REQUIRE(events.empty());

    ui::UiEvent inside = click_event({50.0F, 50.0F});
    REQUIRE(router.dispatch(inside));
    REQUIRE(events == std::vector<std::string>{"modal"});
}

TEST_CASE("hidden modal panels release the modal input policy") {
    ui::Runtime runtime;
    ui::Config config;
    config.window.title = "modal-policy-test";
    config.window.size = {1.0F, 1.0F};
    UI surface(runtime, std::move(config));
    ui::ModalContainer modal(surface);

    ui::ModalPanel& panel = modal.open("panel");
    REQUIRE(modal.has_open_modal());

    panel.set_visible(false);
    modal.update(0.0F);

    ui::UiEvent key = event_of(ui::EventType::KeyDown);
    REQUIRE_FALSE(surface.input_router().dispatch(key));
    REQUIRE_FALSE(key.handled);
}

TEST_CASE("block pointer policy leaves focused keyboard input available") {
    std::vector<std::string> events;
    EventNode content("content", events);
    content.handle_events = true;

    ui::InputRouter router;
    router.set_layer_policy(ui::InputLayer::Modal, ui::InputPolicy::BlockPointer);
    REQUIRE(router.set_focus(content));
    events.clear();

    router.begin_frame();
    router.register_region(content, {{0.0F, 0.0F}, {100.0F, 100.0F}});

    ui::UiEvent click = click_event({10.0F, 10.0F});
    REQUIRE(router.dispatch(click));
    REQUIRE(events.empty());

    ui::UiEvent key = event_of(ui::EventType::KeyDown);
    REQUIRE(router.dispatch(key));
    REQUIRE(events == std::vector<std::string>{"content"});
}

TEST_CASE("input router resolves the topmost node at a position") {
    ui::InputRouter router;
    ui::Node bottom("bottom");
    ui::Node top("top");

    router.begin_frame();
    router.register_region(bottom, {{0.0F, 0.0F}, {100.0F, 100.0F}});
    router.register_region(top, {{25.0F, 25.0F}, {75.0F, 75.0F}});

    REQUIRE(router.node_at({50.0F, 50.0F}) == &top);
    REQUIRE(router.node_at({10.0F, 10.0F}) == &bottom);
    REQUIRE(router.node_at({150.0F, 150.0F}) == nullptr);
}

TEST_CASE("input router ignores disabled and stale regions") {
    ui::InputRouter router;
    ui::Node disabled("disabled");
    ui::Node hidden("hidden");

    router.begin_frame();
    router.register_region(disabled, {{0.0F, 0.0F}, {100.0F, 100.0F}});
    router.register_region(hidden, {{0.0F, 0.0F}, {100.0F, 100.0F}});
    disabled.set_enabled(false);
    hidden.set_visible(false);

    REQUIRE(router.node_at({50.0F, 50.0F}) == nullptr);

    router.begin_frame();
    REQUIRE(router.node_at({50.0F, 50.0F}) == nullptr);
}

TEST_CASE("debug input target includes visible non-interactive nodes") {
    ui::InputRouter router;
    ui::Node container("container");
    container.set_enabled(false);

    router.register_region(container, {{0.0F, 0.0F}, {100.0F, 100.0F}});

    REQUIRE(router.node_at({50.0F, 50.0F}) == nullptr);
    REQUIRE(router.debug_node_at({50.0F, 50.0F}) == &container);

    container.set_visible(false);
    REQUIRE(router.debug_node_at({50.0F, 50.0F}) == nullptr);
}

TEST_CASE("input router prefers an overlapping child over its parent") {
    ui::InputRouter router;
    ui::Node parent("parent");
    auto child = std::make_unique<ui::Node>("child");
    ui::Node* child_ptr = child.get();
    parent.add(std::move(child));

    router.begin_frame();
    router.register_region(*child_ptr, {{0.0F, 0.0F}, {100.0F, 100.0F}});
    router.register_region(parent, {{0.0F, 0.0F}, {100.0F, 100.0F}});

    REQUIRE(router.node_at({50.0F, 50.0F}) == child_ptr);
}

TEST_CASE("nodes inherit their explicitly assigned input layer") {
    ui::Node modal_layer("modal-layer");
    modal_layer.set_input_layer(ui::InputLayer::Modal);
    auto parent = std::make_unique<ui::Node>("modal-parent");
    ui::Node* parent_ptr = parent.get();
    ui::Node* child_ptr = &parent_ptr->add_child<ui::Node>("modal-child");

    modal_layer.add(std::move(parent));

    REQUIRE(parent_ptr->input_layer() == ui::InputLayer::Modal);
    REQUIRE(child_ptr->input_layer() == ui::InputLayer::Modal);

    auto detached = modal_layer.remove(*parent_ptr);
    REQUIRE(detached->input_layer() == ui::InputLayer::Count);
    REQUIRE(detached->children().front()->input_layer() == ui::InputLayer::Count);

    ui::Node ordinary_parent("ordinary-parent");
    ordinary_parent.add(std::move(detached));
    REQUIRE(ordinary_parent.children().front()->input_layer() == ui::InputLayer::Count);
}

TEST_CASE("child containers use the theme content padding by default") {
    ui::Style::set_default_theme(ui::Theme::defaults());
    ui::ChildContainer child("child");
    const float default_padding = ui::Theme::defaults().content_padding;

    REQUIRE(child.style().padding().x == default_padding);
    REQUIRE(child.style().padding().y == default_padding);
}

TEST_CASE("layout anchors resolve the child origin against the parent") {
    const ImVec2 centered = resolve_layout_position({100.0F, 80.0F}, {20.0F, 10.0F}, Anchor::Center, Origin::Center);
    REQUIRE(centered.x == 40.0F);
    REQUIRE(centered.y == 35.0F);

    const ImVec2 bottom_right =
        resolve_layout_position({100.0F, 80.0F}, {20.0F, 10.0F}, Anchor::BottomRight, Origin::TopLeft, {2.0F, -3.0F});
    REQUIRE(bottom_right.x == 102.0F);
    REQUIRE(bottom_right.y == 77.0F);

    const ImVec2 custom = resolve_layout_position({100.0F, 80.0F}, {20.0F, 10.0F}, {0.25F, 0.75F}, {0.5F, 1.0F});
    REQUIRE(custom.x == 15.0F);
    REQUIRE(custom.y == 50.0F);
}

TEST_CASE("layout geometry exposes resolved rectangles") {
    const ui::Rect parent{{10.0F, 20.0F}, {110.0F, 100.0F}};
    const ui::Rect child = ui::resolve_layout_rect(
        parent, {20.0F, 10.0F}, ui::alignment_factor(ui::Anchor::BottomRight),
        ui::alignment_factor(ui::Origin::TopLeft), {2.0F, -3.0F}
    );

    REQUIRE(child.min.x == 112.0F);
    REQUIRE(child.min.y == 97.0F);
    REQUIRE(child.size().x == 20.0F);
    REQUIRE(child.size().y == 10.0F);
    REQUIRE(child.contains({120.0F, 100.0F}));
    REQUIRE_FALSE(child.contains({50.0F, 50.0F}));
}

TEST_CASE("layout size resolves non-positive dimensions from available space") {
    const ImVec2 resolved = ui::resolve_layout_size({0.0F, 40.0F}, {120.0F, 80.0F});
    REQUIRE(resolved.x == 120.0F);
    REQUIRE(resolved.y == 40.0F);

    const ImVec2 clamped = ui::resolve_layout_size({-1.0F, 0.0F}, {-20.0F, 60.0F});
    REQUIRE(clamped.x == 0.0F);
    REQUIRE(clamped.y == 60.0F);
}

TEST_CASE("stack layout places auto-sized children after their measured height") {
    ImGuiContext* previous_context = ImGui::GetCurrentContext();
    ImGuiContext* context = ImGui::CreateContext();
    ImGui::SetCurrentContext(context);
    ImGui::GetIO().DisplaySize = {240.0F, 160.0F};
    ImGui::GetIO().DeltaTime = 1.0F / 60.0F;

    unsigned char* font_pixels = nullptr;
    int font_width = 0;
    int font_height = 0;
    int font_bytes_per_pixel = 0;
    ImGui::GetIO().Fonts->GetTexDataAsRGBA32(&font_pixels, &font_width, &font_height, &font_bytes_per_pixel);

    ui::StackContainer stack("auto-size-stack");
    stack.set_size({200.0F, 100.0F});
    stack.set_spacing(4.0F);
    stack.add_child<ui::TextWidget>("first");
    stack.add_child<ui::TextWidget>("second");

    const auto draw_frame = [&stack] {
        ImGui::NewFrame();
        ImGui::SetNextWindowPos({0.0F, 0.0F});
        ImGui::SetNextWindowSize({240.0F, 160.0F});
        ImGui::Begin("stack-auto-size-test");
        stack.draw();
        ImGui::End();
        ImGui::EndFrame();
    };

    draw_frame();
    draw_frame();

    const ui::Rect first = stack.children()[0]->layout().screen_rect();
    const ui::Rect second = stack.children()[1]->layout().screen_rect();
    REQUIRE(first.size().y > 0.0F);
    REQUIRE(second.min.y >= first.max.y + 4.0F);

    ImGui::SetCurrentContext(previous_context);
    ImGui::DestroyContext(context);
}

TEST_CASE("resizable container stays within its parent bounds") {
    ImGuiContext* previous_context = ImGui::GetCurrentContext();
    ImGuiContext* context = ImGui::CreateContext();
    ImGui::SetCurrentContext(context);
    ImGui::GetIO().DisplaySize = {320.0F, 220.0F};
    ImGui::GetIO().DeltaTime = 1.0F / 60.0F;

    unsigned char* font_pixels = nullptr;
    int font_width = 0;
    int font_height = 0;
    int font_bytes_per_pixel = 0;
    ImGui::GetIO().Fonts->GetTexDataAsRGBA32(&font_pixels, &font_width, &font_height, &font_bytes_per_pixel);

    ui::ResizableContainer resizable("resizable");
    resizable.set_size({80.0F, 60.0F});
    resizable.set_resize(ui::ResizeAxes::Both);

    const auto draw_frame = [&resizable](ImVec2 mouse_position, bool mouse_down) {
        ImGui::GetIO().MousePos = mouse_position;
        ImGui::GetIO().MouseDown[ImGuiMouseButton_Left] = mouse_down;
        ImGui::NewFrame();
        ImGui::SetNextWindowPos({0.0F, 0.0F});
        ImGui::SetNextWindowSize({320.0F, 220.0F});
        ImGui::Begin("resize-root");
        ImGui::BeginChild("resize-parent", {120.0F, 90.0F});
        resizable.draw();
        ImGui::EndChild();
        ImGui::End();
        ImGui::EndFrame();
    };

    draw_frame({0.0F, 0.0F}, false);
    const ui::Rect initial_rect = resizable.layout().screen_rect();
    const ImVec2 handle_position = {initial_rect.max.x - 5.0F, initial_rect.max.y - 5.0F};
    draw_frame(handle_position, true);
    draw_frame({300.0F, 200.0F}, true);
    draw_frame({300.0F, 200.0F}, false);

    REQUIRE(resizable.layout().size().x > 80.0F);
    REQUIRE(resizable.layout().size().x <= 120.0F);
    REQUIRE(resizable.layout().size().y <= 90.0F);

    ImGui::SetCurrentContext(previous_context);
    ImGui::DestroyContext(context);
}

TEST_CASE("nodes without explicit positions follow the ImGui cursor") {
    class FlowNode final : public ui::Node {
    public:
        explicit FlowNode(std::string id) : ui::Node(std::move(id)) {}

        bool on_draw() override {
            ImGui::Dummy({20.0F, 10.0F});
            return true;
        }
    };

    ImGuiContext* previous_context = ImGui::GetCurrentContext();
    ImGuiContext* context = ImGui::CreateContext();
    ImGui::SetCurrentContext(context);
    ImGui::GetIO().DisplaySize = {200.0F, 120.0F};
    ImGui::GetIO().DeltaTime = 1.0F / 60.0F;
    unsigned char* font_pixels = nullptr;
    int font_width = 0;
    int font_height = 0;
    int font_bytes_per_pixel = 0;
    ImGui::GetIO().Fonts->GetTexDataAsRGBA32(&font_pixels, &font_width, &font_height, &font_bytes_per_pixel);
    ImGui::NewFrame();
    ImGui::SetNextWindowPos({0.0F, 0.0F});
    ImGui::SetNextWindowSize({200.0F, 120.0F});
    ImGui::Begin("flow-test");

    FlowNode first("first");
    FlowNode second("second");
    FlowNode same_line("same-line");

    first.draw();
    second.draw();
    const ui::Rect first_rect = first.layout().screen_rect();
    const ui::Rect second_rect = second.layout().screen_rect();

    ImGui::SameLine();
    same_line.draw();
    const ui::Rect same_line_rect = same_line.layout().screen_rect();

    REQUIRE(second_rect.min.y > first_rect.min.y);
    REQUIRE(same_line_rect.min.x > second_rect.min.x);

    ui::InputRouter router;
    ui::Node logical_root("logical-root");
    logical_root.set_input_router(&router);
    auto routed_child = std::make_unique<FlowNode>("routed-child");
    FlowNode* routed_child_ptr = routed_child.get();
    logical_root.add(std::move(routed_child));

    ImGui::SetCursorPos({0.0F, 60.0F});
    router.begin_frame();
    logical_root.draw();

    const ImVec2 routed_position = logical_root.children().front()->layout().screen_rect().min;
    REQUIRE(router.debug_node_at({routed_position.x + 5.0F, routed_position.y + 5.0F}) == routed_child_ptr);

    ImGui::End();
    ImGui::Render();
    ImGui::DestroyContext(context);
    ImGui::SetCurrentContext(previous_context);
}

TEST_CASE("changing an anchor restores a node's natural top-left flow position") {
    class FlowNode final : public ui::Node {
    public:
        explicit FlowNode(std::string node_id) : ui::Node(std::move(node_id)) {
            set_size({40.0F, 20.0F});
        }

        bool on_draw() override {
            ImGui::Dummy(layout().size());
            return true;
        }
    };

    ImGuiContext* previous_context = ImGui::GetCurrentContext();
    ImGuiContext* context = ImGui::CreateContext();
    ImGui::SetCurrentContext(context);
    ImGui::GetIO().DisplaySize = {240.0F, 160.0F};
    ImGui::GetIO().DeltaTime = 1.0F / 60.0F;

    unsigned char* font_pixels = nullptr;
    int font_width = 0;
    int font_height = 0;
    int font_bytes_per_pixel = 0;
    ImGui::GetIO().Fonts->GetTexDataAsRGBA32(&font_pixels, &font_width, &font_height, &font_bytes_per_pixel);

    FlowNode title("title");
    FlowNode tab("tab");

    const auto draw_frame = [&title, &tab] {
        ImGui::NewFrame();
        ImGui::SetNextWindowPos({0.0F, 0.0F});
        ImGui::SetNextWindowSize({240.0F, 160.0F});
        ImGui::Begin("anchor-flow-test");
        title.draw();
        ImGui::SameLine();
        tab.draw();
        const ImVec2 position = tab.layout().screen_rect().min;
        ImGui::End();
        ImGui::EndFrame();
        return position;
    };

    const ImVec2 initial_position = draw_frame();
    tab.layout().set_anchor(ui::Anchor::Center);
    static_cast<void>(draw_frame());
    tab.layout().set_anchor(ui::Anchor::TopLeft);
    tab.layout().clear_explicit_position();
    const ImVec2 restored_position = draw_frame();

    REQUIRE(restored_position.x == Catch::Approx(initial_position.x));
    REQUIRE(restored_position.y == Catch::Approx(initial_position.y));

    ImGui::SetCurrentContext(previous_context);
    ImGui::DestroyContext(context);
}

TEST_CASE("node screen rectangles follow scrollable child windows") {
    class ScrollProbeNode final : public ui::Node {
    public:
        explicit ScrollProbeNode(std::string node_id) : ui::Node(std::move(node_id)) {
            set_size({40.0F, 20.0F});
        }

        bool on_draw() override {
            ImGui::Dummy(layout().size());
            actual_position = ImGui::GetItemRectMin();
            return true;
        }

        ImVec2 actual_position{};
    };

    class ScrollProbeContainer final : public ui::ChildContainer {
    public:
        ScrollProbeContainer() : ui::ChildContainer("scroll-probe") {
            set_size({100.0F, 50.0F});
            set_scrollable(true);
        }

        bool scroll_to_end = false;
        float current_scroll_y = 0.0F;

    protected:
        bool on_draw() override {
            ImGui::SetNextWindowContentSize({100.0F, 400.0F});
            return ui::ChildContainer::on_draw();
        }

        void on_draw_end() override {
            if (scroll_to_end) {
                ImGui::SetScrollY(100.0F);
            }

            ui::ChildContainer::on_draw_end();
        }

        void draw_children() override {
            current_scroll_y = ImGui::GetScrollY();
            ui::Node::draw_children();
        }
    };

    ImGuiContext* previous_context = ImGui::GetCurrentContext();
    ImGuiContext* context = ImGui::CreateContext();
    ImGui::SetCurrentContext(context);
    ImGui::GetIO().DisplaySize = {240.0F, 160.0F};
    ImGui::GetIO().DeltaTime = 1.0F / 60.0F;

    unsigned char* font_pixels = nullptr;
    int font_width = 0;
    int font_height = 0;
    int font_bytes_per_pixel = 0;
    ImGui::GetIO().Fonts->GetTexDataAsRGBA32(&font_pixels, &font_width, &font_height, &font_bytes_per_pixel);

    ScrollProbeContainer container;
    ScrollProbeNode* target = nullptr;
    for (int index = 0; index < 8; ++index) {
        target = &container.add_child<ScrollProbeNode>(std::format("item-{}", index));
    }

    const auto draw_frame = [&container] {
        ImGui::NewFrame();
        ImGui::SetNextWindowPos({0.0F, 0.0F});
        ImGui::SetNextWindowSize({240.0F, 160.0F});
        ImGui::Begin("scroll-root");
        container.draw();
        ImGui::End();
        ImGui::EndFrame();
    };

    draw_frame();
    container.scroll_to_end = true;
    draw_frame();
    draw_frame();

    REQUIRE(container.current_scroll_y > 0.0F);
    REQUIRE(target->layout().screen_rect().min.x == Catch::Approx(target->actual_position.x));
    REQUIRE(target->layout().screen_rect().min.y == Catch::Approx(target->actual_position.y));

    ImGui::SetCurrentContext(previous_context);
    ImGui::DestroyContext(context);
}

TEST_CASE("stack layout places children in insertion order") {
    const std::array sizes = {ImVec2{20.0F, 10.0F}, ImVec2{30.0F, 15.0F}, ImVec2{10.0F, 25.0F}};
    const std::vector<ui::Rect> children = ui::resolve_stack_layout(
        {{10.0F, 20.0F}, {200.0F, 100.0F}}, sizes, ui::StackDirection::Horizontal, 5.0F, {2.0F, 3.0F}
    );

    REQUIRE(children.size() == 3);
    REQUIRE(children[0].min.x == 12.0F);
    REQUIRE(children[0].min.y == 23.0F);
    REQUIRE(children[1].min.x == 37.0F);
    REQUIRE(children[2].min.x == 72.0F);

    const std::vector<ui::Rect> vertical = ui::resolve_stack_layout(
        {{10.0F, 20.0F}, {200.0F, 100.0F}}, sizes, ui::StackDirection::Vertical, 4.0F, {2.0F, 3.0F}
    );
    REQUIRE(vertical[1].min.y == 37.0F);
    REQUIRE(vertical[2].min.y == 56.0F);
}

TEST_CASE("blocked keyboard input reaches the layer target without focus") {
    std::vector<std::string> events;
    ui::InputRouter router;
    EventNode modal("modal", events);
    modal.handle_events = true;
    modal.set_input_layer(ui::InputLayer::Modal);
    router.set_layer_policy(ui::InputLayer::Modal, ui::InputPolicy::BlockAll);
    router.set_keyboard_target(modal);

    ui::UiEvent key = event_of(ui::EventType::KeyDown);
    REQUIRE(router.dispatch(key));
    REQUIRE(key.handled);
    REQUIRE(events == std::vector<std::string>{"modal"});
}

TEST_CASE("focused node receives keyboard events and blocked layers consume them") {
    std::vector<std::string> events;
    EventNode content("content", events);
    EventNode modal("modal", events);
    content.handle_events = true;
    modal.handle_events = true;

    ui::InputRouter router;
    REQUIRE(router.set_focus(content));
    events.clear();

    ui::UiEvent key = event_of(ui::EventType::KeyDown);
    REQUIRE(router.dispatch(key));
    REQUIRE(events == std::vector<std::string>{"content"});

    router.set_layer_policy(ui::InputLayer::Modal, ui::InputPolicy::BlockAll);
    events.clear();
    key = event_of(ui::EventType::KeyDown);
    REQUIRE(router.dispatch(key));
    REQUIRE(events.empty());

    REQUIRE(router.set_focus_in_layer(modal, ui::InputLayer::Modal));
    events.clear();
    ui::UiEvent text = event_of(ui::EventType::TextInput);
    text.text = "osu";
    REQUIRE(router.dispatch(text));
    REQUIRE(events == std::vector<std::string>{"modal"});

    router.clear_focus();
    REQUIRE(router.focused_node() == nullptr);
}
