#include <catch2/catch_test_macros.hpp>

#include "ui/core/input.hpp"
#include "ui/core/modal.hpp"
#include "ui/core/overlay.hpp"
#include "ui/core/layout.hpp"

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

class TestObject final : public ui::StyledNode {
public:
    explicit TestObject(std::string id) : StyledNode(std::move(id)) {
    }

    void on_draw() override {
    }
};

TEST_CASE("ui node owns children and finds descendants") {
    ui::Node root("root");
    auto child = std::make_unique<ui::Node>("child");
    ui::Node* child_ptr = child.get();
    child->add(std::make_unique<ui::Node>("grandchild"));
    root.add(std::move(child));

    REQUIRE(child_ptr->parent() == &root);
    REQUIRE(root.contains(child_ptr));
    REQUIRE(root.find("grandchild") != nullptr);
    REQUIRE(root.find("missing") == nullptr);

    auto removed = root.remove(*child_ptr);
    REQUIRE(removed.get() == child_ptr);
    REQUIRE(removed->parent() == nullptr);
    REQUIRE_FALSE(root.contains(child_ptr));
}

TEST_CASE("ui node exposes optional content and measures draw time") {
    class ContentNode final : public ui::Node {
    public:
        ContentNode() : ui::Node("content") {
        }

        std::optional<std::string> get_content() const override {
            return m_content;
        }

        bool set_content(std::string content) override {
            m_content = std::move(content);
            return true;
        }

        void on_draw() override {
        }

    private:
        std::string m_content = "hello##content-id";
    };

    ContentNode root;
    root.add(std::make_unique<ui::Node>("child"));
    const auto content = root.get_content();

    REQUIRE(content.has_value());
    REQUIRE(*content == "hello##content-id");
    REQUIRE(root.set_content("updated##content-id"));
    REQUIRE(*root.get_content() == "updated##content-id");

    root.draw();
    REQUIRE(root.draw_time_ms() >= 0.0);
}

TEST_CASE("ui events bubble from target to parents") {
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

TEST_CASE("blocking modal layer prevents content input") {
    std::vector<std::string> events;
    EventNode content("content", events);
    EventNode modal("modal", events);
    modal.handle_events = true;

    ui::InputRouter router;
    router.set_layer_policy(ui::InputLayer::Modal, ui::InputPolicy::BlockAll);
    router.begin_frame();
    router.register_region(content, {{0.0F, 0.0F}, {100.0F, 100.0F}});
    router.register_region(modal, {{25.0F, 25.0F}, {75.0F, 75.0F}}, ui::InputLayer::Modal);

    ui::UiEvent outside = click_event({10.0F, 10.0F});
    REQUIRE(router.dispatch(outside));
    REQUIRE(events.empty());

    ui::UiEvent inside = click_event({50.0F, 50.0F});
    REQUIRE(router.dispatch(inside));
    REQUIRE(events == std::vector<std::string>{"modal"});
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

TEST_CASE("ui root exposes ordered layers") {
    ui::UiRoot root;

    REQUIRE(root.id() == "ui-root");
    REQUIRE(root.layer(ui::InputLayer::Content).id() == "content-layer");
    REQUIRE(root.layer(ui::InputLayer::Overlay).id() == "overlay-layer");
    REQUIRE(root.layer(ui::InputLayer::Modal).id() == "modal-layer");
    REQUIRE(root.layer(ui::InputLayer::Notification).id() == "notification-layer");
    REQUIRE(root.layer(ui::InputLayer::Content).parent() == &root);
    REQUIRE(root.children().size() == 4);
}

TEST_CASE("ui child layout stores objects in the node tree") {
    ui::ChildLayout layout("layout");
    auto child = std::make_unique<TestObject>("child");
    ui::StyledNode* child_ptr = child.get();

    layout.add(std::move(child));

    REQUIRE(layout.children().size() == 1);
    REQUIRE(child_ptr->parent() == &layout);
    REQUIRE(layout.find("child") == child_ptr);

    auto removed = layout.remove(*child_ptr);
    REQUIRE(removed.get() == child_ptr);
    REQUIRE(removed->parent() == nullptr);
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

TEST_CASE("overlay host owns and orders layer nodes") {
    ui::UiRoot root;
    ui::OverlayHost host(root);

    host.add(std::make_unique<ui::Node>("first"));
    host.add(std::make_unique<ui::Node>("second"));

    REQUIRE(host.size() == 2);
    REQUIRE(host.top()->id() == "second");

    host.set_policy(ui::InputLayer::Modal, ui::InputPolicy::BlockAll);
    REQUIRE(root.layer(ui::InputLayer::Modal).input_policy() == ui::InputPolicy::BlockAll);

    host.add(std::make_unique<ui::Node>("dialog"), ui::InputLayer::Modal, ui::InputPolicy::BlockAll);
    REQUIRE(host.top(ui::InputLayer::Modal)->id() == "dialog");
    REQUIRE(root.input_router().set_focus(*host.top(ui::InputLayer::Modal), ui::InputLayer::Modal));
    REQUIRE(host.remove("dialog", ui::InputLayer::Modal));
    REQUIRE(host.size(ui::InputLayer::Modal) == 0);
    REQUIRE(root.input_router().focused_node() == nullptr);

    host.clear();
    REQUIRE(host.size() == 0);
}

TEST_CASE("cancelable overlays receive escape without focus") {
    ui::UiRoot root;
    ui::OverlayHost host(root);
    auto overlay = std::make_unique<ui::Node>("dialog");
    ui::Node* overlay_ptr = overlay.get();
    bool cancelled = false;
    overlay_ptr->on_event = [&cancelled](ui::UiEvent& event) {
        if (event.type == ui::EventType::Cancel) {
            cancelled = true;
            event.mark_handled();
        }
    };

    host.add(std::move(overlay), ui::InputLayer::Modal, ui::InputPolicy::BlockAll, true);

    ui::UiEvent cancel = event_of(ui::EventType::Cancel);
    REQUIRE(root.input_router().dispatch(cancel));
    REQUIRE(cancelled);
    REQUIRE(cancel.handled);

    REQUIRE(host.remove("dialog", ui::InputLayer::Modal));
    host.set_policy(ui::InputLayer::Modal, ui::InputPolicy::PassThrough);
    cancelled = false;
    cancel = event_of(ui::EventType::Cancel);
    REQUIRE_FALSE(root.input_router().dispatch(cancel));
    REQUIRE_FALSE(cancelled);
}

TEST_CASE("modals are nodes owned by the modal layer") {
    ui::UiRoot root;
    ui::OverlayHost host(root);
    auto modal = std::make_unique<ui::Modal>("settings-modal");
    ui::Modal* modal_ptr = modal.get();

    host.add(std::move(modal), ui::InputLayer::Modal, ui::InputPolicy::BlockAll, true);

    REQUIRE(host.top(ui::InputLayer::Modal) == modal_ptr);
    REQUIRE(modal_ptr->parent() == &root.layer(ui::InputLayer::Modal));
    REQUIRE(modal_ptr->cancelable());
    REQUIRE(root.layer(ui::InputLayer::Modal).input_policy() == ui::InputPolicy::BlockAll);
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

    REQUIRE(router.set_focus(modal, ui::InputLayer::Modal));
    events.clear();
    ui::UiEvent text = event_of(ui::EventType::TextInput);
    text.text = "osu";
    REQUIRE(router.dispatch(text));
    REQUIRE(events == std::vector<std::string>{"modal"});

    router.clear_focus();
    REQUIRE(router.focused_node() == nullptr);
}
