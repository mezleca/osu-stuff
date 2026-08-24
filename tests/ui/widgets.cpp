#include "ui/style/state.hpp"
#include "ui/runtime.hpp"
#include "ui/layout/child-container.hpp"
#include "ui/widgets/widget.hpp"
#include "utils/imgui-context.hpp"

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include <imgui.h>
#include <string>

using namespace ui;

TEST_CASE("runtime owns shared theme and explicitly registered assets", "[Runtime]") {
    ui::RuntimeConfig config;
    config.theme.content_padding = 20.0F;
    config.theme.box_rounding = 8.0F;
    ui::Runtime runtime(std::move(config));
    ui::Font* font = runtime.add_font(ui::FontType::REGULAR, "fonts/regular.ttf");

    REQUIRE(runtime.theme().content_padding == 20.0F);
    REQUIRE(font == runtime.find_font(ui::FontType::REGULAR));
    REQUIRE(runtime.resource("default") != nullptr);

    ui::Runtime other_runtime;

    REQUIRE(runtime.theme().box_rounding == 8.0F);
    REQUIRE(other_runtime.theme().content_padding == ui::Theme::defaults().content_padding);
}

TEST_CASE("style defaults are independent from runtime themes", "[theme][layout]") {
    ui::Theme theme = ui::Theme::defaults();
    theme.content_padding = 20.0F;
    theme.box_rounding = 8.0F;
    theme.text_color = {0.2F, 0.3F, 0.4F, 1.0F};
    ui::RuntimeConfig config;
    config.theme = theme;
    ui::Runtime runtime(std::move(config));

    ui::ChildContainer container("container");
    REQUIRE(runtime.theme().content_padding == Catch::Approx(20.0F));
    REQUIRE(container.style().padding().x == Catch::Approx(ui::Theme::defaults().content_padding));
    REQUIRE(container.style().border_radius() == Catch::Approx(ui::Theme::defaults().box_rounding));
}

TEST_CASE("style transition duration uses seconds", "[VisualState][transition]") {
    ui::VisualState state;

    state.style(ui::StyleType::DEFAULT).color({0.0f, 0.0f, 0.0f, 1.0f});
    state.style(ui::StyleType::HOVER).color({1.0f, 0.0f, 0.0f, 1.0f}, 0.2F);

    state.style(ui::StyleType::HOVER).variables().set("rounding", ui::FloatValue{10.0f, 0.2f});
    state.style(ui::StyleType::DEFAULT).variables().set("rounding", ui::FloatValue{0.0f, 0.0f});

    state.style(ui::StyleType::HOVER).variables().set("enabled", ui::BoolValue{true});
    state.style(ui::StyleType::DEFAULT).variables().set("enabled", ui::BoolValue{false});

    ui::Vec2Value hover_offset;
    hover_offset.value = {5.0f, 5.0f};
    hover_offset.duration = 0.2f;
    state.style(ui::StyleType::HOVER).variables().set("offset", hover_offset);

    ui::Vec2Value default_offset;
    default_offset.value = {0.0f, 0.0f};
    state.style(ui::StyleType::DEFAULT).variables().set("offset", default_offset);

    state.style(ui::StyleType::HOVER).variables().set("count", ui::IntValue{100, 0.2f});
    state.style(ui::StyleType::DEFAULT).variables().set("count", ui::IntValue{0, 0.0f});

    state.snap_to_style(ui::StyleType::DEFAULT);
    state.set_style(ui::StyleType::HOVER);

    state.update(0.1F);
    REQUIRE(state.style().color().get().x == Catch::Approx(0.5F));
    REQUIRE(state.style().variables().get<ui::FloatValue>("rounding")->value == Catch::Approx(5.0F));
    REQUIRE(state.style().variables().get<ui::Vec2Value>("offset")->value.x == Catch::Approx(2.5F));
    REQUIRE(state.style().variables().get<ui::IntValue>("count")->value == 50);
    REQUIRE(state.style().variables().get<ui::BoolValue>("enabled")->value);

    state.update(0.1F);

    SECTION("discrete type snaps immediately") {
        REQUIRE(state.style().variables().get<ui::BoolValue>("enabled")->value);
    }

    SECTION("color converges") {
        REQUIRE(state.style().color().get().x == Catch::Approx(1.0f).margin(0.01f));
    }

    SECTION("float var converges") {
        REQUIRE(state.style().variables().get<ui::FloatValue>("rounding")->value == Catch::Approx(10.0f).margin(0.1f));
    }

    SECTION("vec2 var converges") {
        REQUIRE(state.style().variables().get<ui::Vec2Value>("offset")->value.x == Catch::Approx(5.0f).margin(0.1f));
    }

    SECTION("int var reaches exact target") {
        REQUIRE(state.style().variables().get<ui::IntValue>("count")->value == 100);
    }
}

TEST_CASE("interaction style precedence is active focus hover default", "[VisualState][style]") {
    ui::VisualState state;

    state.set_item_state(false, false, false);
    REQUIRE(state.style_type() == ui::StyleType::DEFAULT);

    state.set_item_state(true, false, false);
    REQUIRE(state.style_type() == ui::StyleType::HOVER);

    state.set_item_state(true, false, true);
    REQUIRE(state.style_type() == ui::StyleType::FOCUS);

    state.set_item_state(true, true, true);
    REQUIRE(state.style_type() == ui::StyleType::ACTIVE);

    ui::Widget widget("focused-widget");
    ui::ItemInputState input;
    input.focused = true;
    widget.apply_input_state(input);
    REQUIRE(widget.style_type() == ui::StyleType::FOCUS);
}

TEST_CASE("border alpha fades out when a hover state is cleared", "[VisualState][transition]") {
    ui::VisualState state;
    const ImColor accent = ImColor(233, 30, 115, 255);
    const ImColor hidden_accent = ui::with_alpha(accent, 0.0F);

    state.configure_all_styles([&](ui::Style& style) { style.border_color(hidden_accent, 0.2F); });
    state.configure_style(ui::StyleType::HOVER, [&](ui::Style& style) { style.border_color(accent); });

    state.set_style(ui::StyleType::HOVER);
    state.update(0.2F);
    const float visible_alpha = state.style().border_color().get().w;

    state.set_style(ui::StyleType::DEFAULT);
    state.update(0.1F);
    const ImVec4 fading_color = state.style().border_color().get();

    REQUIRE(visible_alpha > 0.0F);
    REQUIRE(fading_color.w > 0.0F);
    REQUIRE(fading_color.w < visible_alpha);
    REQUIRE(fading_color.x == Catch::Approx(accent.Value.x));
    REQUIRE(fading_color.y == Catch::Approx(accent.Value.y));
    REQUIRE(fading_color.z == Catch::Approx(accent.Value.z));

    state.update(0.1F);
    REQUIRE(state.style().border_color().get().w == Catch::Approx(0.0F));
}

TEST_CASE("opacity ticks towards target and drives visibility", "[widget_state][opacity]") {
    ui::VisualState state;
    state.set_opacity(0.0f);

    state.update(0.075F);
    REQUIRE(state.opacity() == Catch::Approx(0.5F));
    state.update(0.075F);
    REQUIRE(state.opacity() == Catch::Approx(0.0F));
    REQUIRE_FALSE(state.is_visible());
}

TEST_CASE("fade transitions control input independently from drawing", "[widget_state][opacity]") {
    ui::VisualState state;
    state.update(1.0f / 60.0f);
    REQUIRE(state.accepts_input());

    state.fade_out();
    REQUIRE_FALSE(state.accepts_input());
    REQUIRE(state.is_visible());

    state.fade_in();
    REQUIRE(state.accepts_input());
}

TEST_CASE("widget input requires both node and visual state to accept input", "[Widget][input]") {
    ui::Widget widget("widget");
    ui::InputRouter router;
    router.register_region(widget, {{0.0F, 0.0F}, {10.0F, 10.0F}});

    REQUIRE(widget.accepts_input());
    REQUIRE(router.node_at({5.0F, 5.0F}) == &widget);

    widget.set_enabled(false);
    REQUIRE_FALSE(widget.accepts_input());
    REQUIRE(router.node_at({5.0F, 5.0F}) == nullptr);

    widget.set_enabled(true);
    widget.set_visible(false);
    REQUIRE_FALSE(widget.accepts_input());

    widget.set_visible(true);
    widget.fade_out();
    REQUIRE_FALSE(widget.accepts_input());
    REQUIRE(router.node_at({5.0F, 5.0F}) == nullptr);
}

TEST_CASE("styled widgets advance visual state during update", "[Widget][style]") {
    ui_test::ImGuiContext context({160.0F, 120.0F});

    ui::Widget widget("widget");
    widget.configure_all_styles([](ui::Style& style) { style.color(ImColor{0, 0, 0, 255}, 0.2F); });
    widget.configure_style(ui::StyleType::HOVER, [](ui::Style& style) { style.color(ImColor{255, 0, 0, 255}, 0.2F); });
    widget.set_visual_style(ui::StyleType::HOVER);

    ui::VisualState expected;
    expected.configure_all_styles([](ui::Style& style) { style.color(ImColor{0, 0, 0, 255}, 0.2F); });
    expected.configure_style(ui::StyleType::HOVER, [](ui::Style& style) {
        style.color(ImColor{255, 0, 0, 255}, 0.2F);
    });
    expected.set_style(ui::StyleType::HOVER);
    expected.update(ImGui::GetIO().DeltaTime);

    widget.update(ImGui::GetIO().DeltaTime);
    const float color_after_update = widget.style().color().get().x;

    ImGui::NewFrame();
    ImGui::Begin("style-tick-test");
    widget.draw();
    ImGui::End();
    ImGui::EndFrame();

    REQUIRE(widget.style().color().get().x == Catch::Approx(expected.style().color().get().x));
    REQUIRE(widget.style().color().get().x == Catch::Approx(color_after_update));

    widget.configure_style(ui::StyleType::FOCUS, [](ui::Style& style) { style.border_radius(12.0F); });
    REQUIRE(widget.style(ui::StyleType::FOCUS).border_radius() == Catch::Approx(12.0F));
}

TEST_CASE("custom update hooks cannot skip visual state advancement", "[Widget][style][regression]") {
    class UpdatingWidget final : public ui::Widget {
    public:
        UpdatingWidget() : ui::Widget("updating-widget") {}

        int updates = 0;

    private:
        void on_update(float) override {
            ++updates;
        }
    };

    UpdatingWidget widget;
    widget.configure_all_styles([](ui::Style& style) { style.alpha(0.0F); });
    widget.configure_style(ui::StyleType::HOVER, [](ui::Style& style) { style.alpha(1.0F); });
    widget.set_visual_style(ui::StyleType::HOVER);

    widget.update(1.0F / 60.0F);

    REQUIRE(widget.updates == 1);
    REQUIRE(widget.style().alpha() == Catch::Approx(1.0F));
}

TEST_CASE("fade in starts new visual states transparent", "[widget_state][opacity]") {
    ui::VisualState state;

    state.fade_in();
    REQUIRE(state.opacity() == Catch::Approx(0.0F));

    state.update(1.0F / 60.0F);
    REQUIRE(state.opacity() > 0.0F);
    REQUIRE(state.opacity() < 1.0F);
}

TEST_CASE("a var introduced only on the target style still appears after transition", "[widget_state][regression]") {
    ui::VisualState state;

    state.style(ui::StyleType::DEFAULT).variables().set("line_alpha", ui::FloatValue{0.0f, 0.15f});
    state.style(ui::StyleType::HOVER).variables().set("line_alpha", ui::FloatValue{1.0f, 0.15f});

    const ui::FloatValue* default_alpha = state.style().variables().get<ui::FloatValue>("line_alpha");
    REQUIRE(default_alpha != nullptr);
    REQUIRE(default_alpha->value == Catch::Approx(0.0F));

    state.set_style(ui::StyleType::HOVER);
    state.update(1.0f / 60.0f); // first transition frame

    REQUIRE(state.style().variables().get<ui::FloatValue>("line_alpha") != nullptr);
}

TEST_CASE("editing the selected style updates its effective appearance") {
    ui::VisualState state;
    state.style(ui::StyleType::DEFAULT).color(ImColor{0, 0, 0, 255});
    state.style(ui::StyleType::ACTIVE).color(ImColor{255, 0, 0, 255});
    state.snap_to_style(ui::StyleType::DEFAULT);
    state.set_style(ui::StyleType::ACTIVE);
    state.update(1.0F / 60.0F);

    state.style(ui::StyleType::ACTIVE).color().set(ImColor{0, 255, 0, 255});

    const ui::VisualState& const_state = state;
    REQUIRE(const_state.style().color().get().x == Catch::Approx(0.0F));
    REQUIRE(const_state.style().color().get().y == Catch::Approx(1.0F));
}
