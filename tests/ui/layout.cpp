#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include "ui/layout/child-container.hpp"
#include "ui/layout/geometry.hpp"
#include "ui/layout/resizable-container.hpp"
#include "ui/layout/stack-container.hpp"
#include "ui/style/theme.hpp"
#include "ui/widgets/image.hpp"
#include "ui/widgets/text.hpp"
#include "utils/imgui-context.hpp"

#include <cfloat>
#include <memory>

using namespace ui;

TEST_CASE("image padding keeps the outer screen bounds", "[Widget][layout]") {
    ui_test::ImGuiContext context({200.0F, 120.0F});

    ui::ImageWidget image;
    image.set_size({24.0F, 20.0F});
    image.configure_all_styles([](ui::Style& style) { style.padding({3.0F, 2.0F}); });

    ImGui::NewFrame();
    ImGui::Begin("image-padding-test");
    image.draw();
    ImGui::End();
    ImGui::EndFrame();

    const ui::Rect bounds = image.layout().screen_rect();

    REQUIRE(bounds.size().x == Catch::Approx(24.0F));
    REQUIRE(bounds.size().y == Catch::Approx(20.0F));
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
    ui_test::ImGuiContext context({240.0F, 160.0F});

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

    const ui::Rect first = stack.children()[0]->layout().screen_rect();
    const ui::Rect second = stack.children()[1]->layout().screen_rect();
    REQUIRE(first.size().y > 0.0F);
    REQUIRE(second.min.y >= first.max.y + 4.0F);
}

TEST_CASE("horizontal stack places a fixed item after auto-sized text") {
    class FixedItemNode final : public ui::Node {
    public:
        explicit FixedItemNode(ImVec2 size) {
            set_size(size);
        }

    private:
        bool on_draw() override {
            ImGui::Button("add notification", layout().size());
            return true;
        }
    };

    ui_test::ImGuiContext context({640.0F, 180.0F});

    ui::Node root("root");
    auto& stack = root.add_child<ui::StackContainer>("notification-test", ui::StackDirection::Horizontal);
    stack.set_size({620.0F, 120.0F});
    stack.set_spacing(8.0F);
    stack.configure_all_styles([](ui::Style& style) { style.padding({8.0F, 8.0F}); });
    auto& text_node = stack.add_child<ui::TextWidget>("notifications: 0");
    stack.add_child<FixedItemNode>(ImVec2{180.0F, 30.0F});

    const auto draw_frame = [&root] {
        ImGui::NewFrame();
        ImGui::SetNextWindowPos({0.0F, 0.0F});
        ImGui::SetNextWindowSize({640.0F, 180.0F});
        ImGui::Begin("horizontal-stack-test");
        root.draw();
        ImGui::End();
        ImGui::EndFrame();
    };

    draw_frame();

    const ui::Rect text = stack.children()[0]->layout().screen_rect();
    const ui::Rect item = stack.children()[1]->layout().screen_rect();
    REQUIRE(text.valid());
    REQUIRE(item.valid());
    REQUIRE(item.min.x >= text.max.x + 8.0F);

    REQUIRE(text_node.try_set_content("notifications: 10000"));
    draw_frame();

    const ui::Rect resized_text = stack.children()[0]->layout().screen_rect();
    const ui::Rect repositioned_item = stack.children()[1]->layout().screen_rect();
    REQUIRE(resized_text.size().x > text.size().x);
    REQUIRE(repositioned_item.min.x >= resized_text.max.x + 8.0F);
}

TEST_CASE("changing stack direction rearranges existing children", "[layout][regression]") {
    class LayoutItemNode final : public ui::Node {
    public:
        using ui::Node::Node;

    private:
        bool on_draw() override {
            ImGui::Dummy(layout().size());
            return true;
        }
    };

    ui_test::ImGuiContext context({260.0F, 160.0F});

    ui::StackContainer stack("direction-stack");
    stack.set_size({200.0F, 100.0F});
    stack.set_spacing(5.0F);
    ui::Node& first = stack.add_child<LayoutItemNode>("first");
    first.set_size({30.0F, 20.0F});
    ui::Node& second = stack.add_child<LayoutItemNode>("second");
    second.set_size({30.0F, 20.0F});

    const auto draw_frame = [&stack] {
        ImGui::NewFrame();
        ImGui::Begin("stack-direction-test");
        stack.draw();
        ImGui::End();
        ImGui::EndFrame();
    };

    draw_frame();
    REQUIRE(second.layout().arranged_position().x == Catch::Approx(first.layout().arranged_position().x));
    REQUIRE(second.layout().arranged_position().y == Catch::Approx(first.layout().arranged_position().y + 25.0F));

    stack.set_direction(ui::StackDirection::Horizontal);
    draw_frame();
    REQUIRE(second.layout().arranged_position().x == Catch::Approx(first.layout().arranged_position().x + 35.0F));
    REQUIRE(second.layout().arranged_position().y == Catch::Approx(first.layout().arranged_position().y));
}

TEST_CASE("text measurement uses the font inherited from its parent", "[layout][regression]") {
    class FixedItemNode final : public ui::Node {
    public:
        FixedItemNode() {
            set_size({100.0F, 30.0F});
        }

    private:
        bool on_draw() override {
            ImGui::Button("sibling", layout().size());
            return true;
        }
    };

    ui_test::ImGuiContext context({480.0F, 140.0F});

    ImFontConfig default_font_config;
    default_font_config.SizePixels = 13.0F;
    ImGui::GetIO().Fonts->AddFontDefault(&default_font_config);
    ImFontConfig large_font_config;
    large_font_config.SizePixels = 28.0F;
    ImFont* large_font = ImGui::GetIO().Fonts->AddFontDefault(&large_font_config);
    context.build_fonts();

    ui::ChildContainer parent("font-parent");
    parent.set_size({460.0F, 100.0F});
    auto& stack = parent.add_child<ui::StackContainer>("font-stack", ui::StackDirection::Horizontal);
    stack.set_size({440.0F, 60.0F});
    stack.set_spacing(8.0F);
    stack.add_child<ui::TextWidget>("notifications: 0");
    stack.add_child<FixedItemNode>();

    const auto draw_frame = [&parent] {
        ImGui::NewFrame();
        ImGui::SetNextWindowPos({0.0F, 0.0F});
        ImGui::SetNextWindowSize({480.0F, 140.0F});
        ImGui::Begin("inherited-font-layout-test");
        parent.draw();
        ImGui::End();
        ImGui::EndFrame();
    };

    draw_frame();
    parent.set_font(large_font);
    draw_frame();

    const ui::Rect text = stack.children()[0]->layout().screen_rect();
    const ui::Rect sibling = stack.children()[1]->layout().screen_rect();
    const float expected_text_width =
        large_font->CalcTextSizeA(large_font->LegacySize, FLT_MAX, 0.0F, "notifications: 0").x;

    REQUIRE(text.valid());
    REQUIRE(text.size().x == Catch::Approx(expected_text_width).margin(1.0F));
    REQUIRE(sibling.min.x >= text.max.x + 8.0F);
}

TEST_CASE("resizable container stays within its parent bounds") {
    ui_test::ImGuiContext context({320.0F, 220.0F});

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

    ui_test::ImGuiContext context({200.0F, 120.0F});
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

    ui_test::ImGuiContext context({240.0F, 160.0F});

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
    tab.set_anchor(ui::Anchor::Center);
    static_cast<void>(draw_frame());
    tab.set_anchor(ui::Anchor::TopLeft).set_flow();
    const ImVec2 restored_position = draw_frame();

    REQUIRE(restored_position.x == Catch::Approx(initial_position.x));
    REQUIRE(restored_position.y == Catch::Approx(initial_position.y));
}

TEST_CASE("node screen rectangles follow scrollable child windows") {
    class ScrollProbeNode final : public ui::Node {
    public:
        explicit ScrollProbeNode(std::string node_id) : ui::Node(std::move(node_id)) {
            set_size({40.0F, 20.0F});
        }

        bool on_draw() override {
            actual_position = ImGui::GetCursorScreenPos();
            ImGui::Dummy(layout().size());
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

    ui_test::ImGuiContext context({240.0F, 160.0F});

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
}

TEST_CASE("stack auto-sized axes reflow when the parent grows", "[layout][regression]") {
    ui_test::ImGuiContext context({400.0F, 180.0F});

    ui::StackContainer stack("responsive-stack");
    stack.set_size({0.0F, 80.0F});
    ui::Node& hidden = stack.add_child<ui::Node>("hidden-child");
    hidden.set_size({40.0F, 40.0F});
    hidden.set_visible(false);
    ui::ChildContainer& child = stack.add_child<ui::ChildContainer>("stretching-child");
    child.set_size({0.0F, 20.0F});

    const auto draw_frame = [&stack](float width) {
        ImGui::NewFrame();
        ImGui::SetNextWindowPos({0.0F, 0.0F});
        ImGui::SetNextWindowSize({width, 160.0F});
        ImGui::Begin("responsive-stack-test");
        stack.draw();
        ImGui::End();
        ImGui::EndFrame();
    };

    draw_frame(220.0F);
    const float initial_stack_width = stack.layout().size().x;
    const float initial_child_width = child.layout().size().x;

    draw_frame(360.0F);

    REQUIRE(stack.layout().desired_size().x == 0.0F);
    REQUIRE(child.layout().desired_size().x == 0.0F);
    REQUIRE(child.layout().arranged_position().y == Catch::Approx(child.layout().parent_content_rect().min.y));
    REQUIRE(stack.layout().size().x > initial_stack_width);
    REQUIRE(child.layout().size().x > initial_child_width);
    REQUIRE(child.layout().size().x == Catch::Approx(stack.layout().size().x - stack.style().padding().x * 2.0F));
}
