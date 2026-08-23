#include <catch2/catch_test_macros.hpp>

#include "ui/input/router.hpp"
#include "ui/layout/modal-container.hpp"
#include "ui/ui.hpp"
#include "ui/widgets/widget.hpp"

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
        _on_event = [this](ui::UiEvent& event) {
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

class EventWidget final : public ui::Widget {
public:
    explicit EventWidget(std::vector<std::string>& events) : ui::Widget("widget"), m_events(events) {
        _on_event = [this](ui::UiEvent&) { m_events.push_back("internal"); };
    }

private:
    std::vector<std::string>& m_events;
};

class PointerCaptureNode final : public ui::Node {
public:
    PointerCaptureNode(ui::InputRouter& router, std::vector<ui::EventType>& events)
        : ui::Node("drag"), m_router(router), m_events(events) {
        _on_event = [this](ui::UiEvent& event) {
            m_events.push_back(event.type);
            if (event.type == ui::EventType::PointerDown) {
                REQUIRE(m_router.capture_pointer(*this));
            }
            event.mark_handled();
        };
    }

private:
    ui::InputRouter& m_router;
    std::vector<ui::EventType>& m_events;
};

class PointerEventNode final : public ui::Node {
public:
    PointerEventNode(std::string node_id, std::vector<ui::EventType>& events)
        : ui::Node(std::move(node_id)), m_events(events) {
        _on_event = [this](ui::UiEvent& event) {
            m_events.push_back(event.type);
            event.mark_handled();
        };
    }

private:
    std::vector<ui::EventType>& m_events;
};

TEST_CASE("widget event handlers preserve internal behavior") {
    std::vector<std::string> events;
    EventWidget widget(events);
    widget.on_event = [&events](ui::UiEvent&) { events.push_back("public"); };

    ui::InputRouter router;
    ui::UiEvent event = click_event();
    REQUIRE_FALSE(router.dispatch(widget, event));
    REQUIRE(events == std::vector<std::string>{"internal", "public"});
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
    std::vector<ui::EventType> events;
    PointerCaptureNode node(router, events);

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

TEST_CASE("input router synthesizes clicks from matching pointer presses") {
    std::vector<ui::EventType> events;
    PointerEventNode node("click", events);
    ui::InputRouter router;
    router.register_region(node, {{0.0F, 0.0F}, {10.0F, 10.0F}});

    auto left_down = event_of(ui::EventType::PointerDown, {5.0F, 5.0F});
    left_down.button = ui::PointerButton::Left;
    REQUIRE(router.dispatch(left_down));

    auto left_up = event_of(ui::EventType::PointerUp, {5.0F, 5.0F});
    left_up.button = ui::PointerButton::Left;
    REQUIRE(router.dispatch(left_up));
    REQUIRE(events == std::vector<ui::EventType>{ui::EventType::PointerDown, ui::EventType::Click});

    events.clear();
    auto right_down = event_of(ui::EventType::PointerDown, {5.0F, 5.0F});
    right_down.button = ui::PointerButton::Right;
    REQUIRE(router.dispatch(right_down));

    auto right_up = event_of(ui::EventType::PointerUp, {5.0F, 5.0F});
    right_up.button = ui::PointerButton::Right;
    REQUIRE(router.dispatch(right_up));
    REQUIRE(events == std::vector<ui::EventType>{ui::EventType::PointerDown, ui::EventType::ContextClick});

    events.clear();
    auto drag_down = event_of(ui::EventType::PointerDown, {5.0F, 5.0F});
    drag_down.button = ui::PointerButton::Left;
    REQUIRE(router.dispatch(drag_down));

    auto drag_up = event_of(ui::EventType::PointerUp, {20.0F, 20.0F});
    drag_up.button = ui::PointerButton::Left;
    REQUIRE_FALSE(router.dispatch(drag_up));
    REQUIRE(events == std::vector<ui::EventType>{ui::EventType::PointerDown});
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
