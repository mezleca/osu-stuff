#include "ui/widgets/widget.hpp"
#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>

TEST_CASE("tick actually writes the interpolated value back", "[UIWidgetColor]") {
    UIWidgetColor current;
    UIWidgetColor target;

    current.set(ImVec4{0.0f, 0.0f, 0.0f, 1.0f});

    target.set(ImVec4{1.0f, 0.0f, 0.0f, 1.0f});
    target.set_speed(8.0f);

    for (int i = 0; i < 1000; ++i) {
        current.tick(target, 1.0f / 60.0f);
    }

    REQUIRE(current.is_close(target, 0.01f));
}

TEST_CASE("StyleVariableStore set/get", "[VariableStore]") {
    StyleVariableStore store;

    store.set("rounding", UIWidgetFloat{4.0f, 0.0f});
    store.set("rounding", UIWidgetFloat{8.0f, 0.0f});

    auto v = store.get<UIWidgetFloat>("rounding");

    REQUIRE(v.has_value());
    REQUIRE(v.value().value == 8.0f);

    SECTION("wrong type returns nullopt") {
        REQUIRE_FALSE(store.get<UIWidgetInt>("rounding").has_value());
    }

    SECTION("missing key returns nullopt") {
        REQUIRE_FALSE(store.get<UIWidgetFloat>("missing").has_value());
    }
}

TEST_CASE("set_for_all_styles applies to every style slot", "[WidgetState]") {
    WidgetState state;

    state.set_for_all_styles([](WidgetStyle& style) {
        style.color.set_speed(10.0f);
        style.vars.set("rounding", UIWidgetFloat{4.0f, 0.0f});
    });

    for (int i = 0; i < static_cast<int>(WidgetStyleType::_COUNT); ++i) {
        WidgetStyle& s = state.get_style(static_cast<WidgetStyleType>(i));
        REQUIRE(s.color.speed == 10.0f);
        REQUIRE(s.vars.get<UIWidgetFloat>("rounding").value().value == 4.0f);
    }
}

TEST_CASE("transition reaches target and settles", "[WidgetState][transition]") {
    WidgetState state;

    state.get_style(WidgetStyleType::DEFAULT).color.set({0.0f, 0.0f, 0.0f, 1.0f});
    state.get_style(WidgetStyleType::HOVER).color.set({1.0f, 0.0f, 0.0f, 1.0f});
    state.get_style(WidgetStyleType::HOVER).color.set_speed(8.0f);

    state.get_style(WidgetStyleType::HOVER).vars.set("rounding", UIWidgetFloat{10.0f, 8.0f});
    state.get_style(WidgetStyleType::DEFAULT).vars.set("rounding", UIWidgetFloat{0.0f, 0.0f});

    state.get_style(WidgetStyleType::HOVER).vars.set("enabled", UIWidgetBool{true});
    state.get_style(WidgetStyleType::DEFAULT).vars.set("enabled", UIWidgetBool{false});

    UIWidgetVec2 hover_offset;
    hover_offset.value = {5.0f, 5.0f};
    hover_offset.speed = 8.0f;
    state.get_style(WidgetStyleType::HOVER).vars.set("offset", hover_offset);

    UIWidgetVec2 default_offset;
    default_offset.value = {0.0f, 0.0f};
    state.get_style(WidgetStyleType::DEFAULT).vars.set("offset", default_offset);

    state.get_style(WidgetStyleType::HOVER).vars.set("count", UIWidgetInt{100, 8.0f});
    state.get_style(WidgetStyleType::DEFAULT).vars.set("count", UIWidgetInt{0, 0.0f});

    state.snap_to_style(WidgetStyleType::DEFAULT);
    state.set_style(WidgetStyleType::HOVER);

    bool settled = false;

    for (int i = 0; i < 10000; ++i) {
        state.update(1.0f / 60.0f);

        if (state.get_style().is_close_to(
                state.get_style(WidgetStyleType::HOVER), WidgetState::TRANSITION_SETTLE_EPSILON
            )) {
            settled = true;
            break;
        }
    }

    REQUIRE(settled);

    SECTION("discrete type snaps immediately") {
        REQUIRE(state.get_style().vars.get<UIWidgetBool>("enabled").value().value == true);
    }

    SECTION("color converges") {
        REQUIRE(state.get_style().color.get().x == Catch::Approx(1.0f).margin(0.01f));
    }

    SECTION("float var converges") {
        REQUIRE(
            state.get_style().vars.get<UIWidgetFloat>("rounding").value().value == Catch::Approx(10.0f).margin(0.1f)
        );
    }

    SECTION("vec2 var converges") {
        REQUIRE(state.get_style().vars.get<UIWidgetVec2>("offset").value().value.x == Catch::Approx(5.0f).margin(0.1f));
    }

    SECTION("int var reaches exact target") {
        REQUIRE(state.get_style().vars.get<UIWidgetInt>("count").value().value == 100);
    }
}

TEST_CASE("set_style is a no-op when already targeting that style", "[widget_state]") {
    WidgetState state;
    state.set_style(WidgetStyleType::HOVER);
    state.update(0.016f);
    float opacity_before = state.get_opacity();

    state.set_style(WidgetStyleType::HOVER);
    state.update(0.016f);

    REQUIRE(state.get_opacity() == opacity_before);
}

TEST_CASE("opacity ticks towards target and drives visibility", "[widget_state][opacity]") {
    WidgetState state;
    state.set_opacity(0.0f);

    for (int i = 0; i < 300; ++i) {
        state.update(1.0f / 60.0f);
    }

    REQUIRE(state.get_opacity() < 0.01f);
    REQUIRE_FALSE(state.is_visible());
}

TEST_CASE("UIWidgetInt interpolates gradually", "[ui_widget_int]") {
    UIWidgetInt current{0, 0.0f};
    UIWidgetInt target{100, 4.0f};

    current.tick(target, 1.0f / 60.0f);
    REQUIRE(current.value > 0);
    REQUIRE(current.value < 100); // moved, but didnt snap straight to 100

    for (int i = 0; i < 6000; ++i) {
        current.tick(target, 1.0f / 60.0f);
    }

    REQUIRE(current.is_close(target, 0));
}

TEST_CASE("a var introduced only on the target style still appears after transition", "[widget_state][regression]") {
    WidgetState state;

    state.get_style(WidgetStyleType::DEFAULT).vars.set("line_alpha", UIWidgetFloat{0.0f, 18.0f});
    state.get_style(WidgetStyleType::HOVER).vars.set("line_alpha", UIWidgetFloat{1.0f, 18.0f});

    REQUIRE_FALSE(state.get_style().vars.get<UIWidgetFloat>("line_alpha").has_value());

    state.set_style(WidgetStyleType::HOVER);
    state.update(1.0f / 60.0f); // first transition frame

    REQUIRE(state.get_style().vars.get<UIWidgetFloat>("line_alpha").has_value());
}

TEST_CASE("UIText caches and only recomputes on value change", "[ui_text]") {
    UIText<int> text(5);
    REQUIRE(std::string(text.c_str()) == "5");

    text.set(5);
    REQUIRE(std::string(text.c_str()) == "5");

    text.set(42);
    REQUIRE(std::string(text.c_str()) == "42");
}
