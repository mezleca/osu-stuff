#include <app/ui/widgets/range.hpp>

#include <ui/layout/stack-container.hpp>
#include <ui/runtime.hpp>
#include <ui/ui.hpp>
#include <ui/widgets/text.hpp>

#include <catch2/catch_test_macros.hpp>
#include <imgui.h>

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
