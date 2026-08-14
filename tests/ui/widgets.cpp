#include "ui/core/node.hpp"
#include "ui/style/state.hpp"
#include "ui/widgets/base/widget.hpp"
#include "ui/widgets/base/text.hpp"

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>

#include <type_traits>

using namespace ui;

static_assert(std::is_base_of_v<ui::Node, ui::Widget>);

TEST_CASE("tick actually writes the interpolated value back", "[ColorValue]") {
    ui::ColorValue current;
    ui::ColorValue target;

    current.set(ImVec4{0.0f, 0.0f, 0.0f, 1.0f});

    target.set(ImVec4{1.0f, 0.0f, 0.0f, 1.0f});
    target.set_speed(8.0f);

    for (int i = 0; i < 1000; ++i) {
        current.tick(target, 1.0f / 60.0f);
    }

    REQUIRE(current.is_close(target, 0.01f));
}

TEST_CASE("StyleVariableStore set/get", "[VariableStore]") {
    ui::StyleVariableStore store;

    store.set("rounding", ui::FloatValue{4.0f, 0.0f});
    store.set("rounding", ui::FloatValue{8.0f, 0.0f});

    const ui::FloatValue* v = store.get<ui::FloatValue>("rounding");

    REQUIRE(v != nullptr);
    REQUIRE(v->value == 8.0f);

    SECTION("wrong type returns null") {
        REQUIRE(store.get<ui::IntValue>("rounding") == nullptr);
    }

    SECTION("missing key returns null") {
        REQUIRE(store.get<ui::FloatValue>("missing") == nullptr);
    }
}

TEST_CASE("set_for_all_styles applies to every style slot", "[VisualState]") {
    ui::VisualState state;

    state.set_for_all_styles([](ui::Style& style) {
        style.color.set(ImVec4{1.0f, 0.0f, 0.0f, 1.0f});
        style.color.set_speed(10.0f);
        style.variables().set("rounding", ui::FloatValue{4.0f, 0.0f});
    });

    for (int i = 0; i < static_cast<int>(ui::StyleType::_COUNT); ++i) {
        ui::Style& s = state.get_style(static_cast<ui::StyleType>(i));
        REQUIRE(s.color.speed == 10.0f);
        REQUIRE(s.variables().get<ui::FloatValue>("rounding")->value == 4.0f);
    }

    REQUIRE(state.get_style_type() == ui::StyleType::DEFAULT);
    REQUIRE(state.get_style().color.get().x == Catch::Approx(1.0f));

    state.set_for_all_styles([](ui::Style& style) { style.color.set(ImVec4{0.0f, 1.0f, 0.0f, 1.0f}); });
    REQUIRE(state.get_style().color.get().y == Catch::Approx(1.0f));
}

TEST_CASE("transition reaches target and settles", "[VisualState][transition]") {
    ui::VisualState state;

    state.get_style(ui::StyleType::DEFAULT).color.set({0.0f, 0.0f, 0.0f, 1.0f});
    state.get_style(ui::StyleType::HOVER).color.set({1.0f, 0.0f, 0.0f, 1.0f});
    state.get_style(ui::StyleType::HOVER).color.set_speed(8.0f);

    state.get_style(ui::StyleType::HOVER).variables().set("rounding", ui::FloatValue{10.0f, 8.0f});
    state.get_style(ui::StyleType::DEFAULT).variables().set("rounding", ui::FloatValue{0.0f, 0.0f});

    state.get_style(ui::StyleType::HOVER).variables().set("enabled", ui::BoolValue{true});
    state.get_style(ui::StyleType::DEFAULT).variables().set("enabled", ui::BoolValue{false});

    ui::Vec2Value hover_offset;
    hover_offset.value = {5.0f, 5.0f};
    hover_offset.speed = 8.0f;
    state.get_style(ui::StyleType::HOVER).variables().set("offset", hover_offset);

    ui::Vec2Value default_offset;
    default_offset.value = {0.0f, 0.0f};
    state.get_style(ui::StyleType::DEFAULT).variables().set("offset", default_offset);

    state.get_style(ui::StyleType::HOVER).variables().set("count", ui::IntValue{100, 8.0f});
    state.get_style(ui::StyleType::DEFAULT).variables().set("count", ui::IntValue{0, 0.0f});

    state.snap_to_style(ui::StyleType::DEFAULT);
    state.set_style(ui::StyleType::HOVER);

    bool settled = false;

    for (int i = 0; i < 10000; ++i) {
        state.update(1.0f / 60.0f);

        if (state.get_style().is_close_to(state.get_style(ui::StyleType::HOVER), ui::TRANSITION_SETTLE_EPSILON)) {
            settled = true;
            break;
        }
    }

    REQUIRE(settled);

    SECTION("discrete type snaps immediately") {
        REQUIRE(state.get_style().variables().get<ui::BoolValue>("enabled")->value == true);
    }

    SECTION("color converges") {
        REQUIRE(state.get_style().color.get().x == Catch::Approx(1.0f).margin(0.01f));
    }

    SECTION("float var converges") {
        REQUIRE(
            state.get_style().variables().get<ui::FloatValue>("rounding")->value == Catch::Approx(10.0f).margin(0.1f)
        );
    }

    SECTION("vec2 var converges") {
        REQUIRE(
            state.get_style().variables().get<ui::Vec2Value>("offset")->value.x == Catch::Approx(5.0f).margin(0.1f)
        );
    }

    SECTION("int var reaches exact target") {
        REQUIRE(state.get_style().variables().get<ui::IntValue>("count")->value == 100);
    }
}

TEST_CASE("set_style is a no-op when already targeting that style", "[widget_state]") {
    ui::VisualState state;
    state.set_style(ui::StyleType::HOVER);
    ui::Style* target_style = &state.get_style(ui::StyleType::HOVER);
    state.update(0.016f);

    state.set_style(ui::StyleType::HOVER);

    REQUIRE(&state.get_style(ui::StyleType::HOVER) == target_style);
}

TEST_CASE("opacity ticks towards target and drives visibility", "[widget_state][opacity]") {
    ui::VisualState state;
    state.set_opacity(0.0f);

    for (int i = 0; i < 300; ++i) {
        state.update(1.0f / 60.0f);
    }

    REQUIRE(state.get_opacity() < 0.01f);
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

TEST_CASE("IntValue interpolates gradually", "[int_value]") {
    ui::IntValue current{0, 0.0f};
    ui::IntValue target{100, 4.0f};

    current.tick(target, 1.0f / 60.0f);
    REQUIRE(current.value > 0);
    REQUIRE(current.value < 100); // moved, but didnt snap straight to 100

    for (int i = 0; i < 6000; ++i) {
        current.tick(target, 1.0f / 60.0f);
    }

    REQUIRE(current.is_close(target, 0));
}

TEST_CASE("a var introduced only on the target style still appears after transition", "[widget_state][regression]") {
    ui::VisualState state;

    state.get_style(ui::StyleType::DEFAULT).variables().set("line_alpha", ui::FloatValue{0.0f, 18.0f});
    state.get_style(ui::StyleType::HOVER).variables().set("line_alpha", ui::FloatValue{1.0f, 18.0f});

    REQUIRE(state.get_style().variables().get<ui::FloatValue>("line_alpha") == nullptr);

    state.set_style(ui::StyleType::HOVER);
    state.update(1.0f / 60.0f); // first transition frame

    REQUIRE(state.get_style().variables().get<ui::FloatValue>("line_alpha") != nullptr);
}

TEST_CASE("TextValue caches and only recomputes on value change", "[text_value]") {
    ui::TextValue<int> text(5);
    REQUIRE(std::string(text.c_str()) == "5");

    text.set(5);
    REQUIRE(std::string(text.c_str()) == "5");

    text.set(42);
    REQUIRE(std::string(text.c_str()) == "42");
}
