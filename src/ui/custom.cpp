#include "./custom.hpp"
#include "./theme.hpp"

#include <algorithm>
#include <imgui.h>
#include <imgui_internal.h>
#include <format>
#include <imgui_stdlib.h>

static constexpr float MIN_CHILD_SIZE = 32.0f;

// TODO: search icon
void custom_imgui::search_input(std::string_view label, std::string& input) {
    ImGui::InputText(std::format("##{}", label).c_str(), &input);

    bool is_hovered = ImGui::IsItemHovered();

    auto min = ImGui::GetItemRectMin();
    auto max = ImGui::GetItemRectMax();

    auto color = ImColor(ui_theme::BORDER_COLOR);

    if (is_hovered) {
        color = ImColor(ui_theme::ACCENT_HOVER_COLOR);
    }

    auto* dl = ImGui::GetWindowDrawList();
    dl->AddRect(min, max, color, ui_theme::BOX_ROUNDING, 2.0f);
}

void custom_imgui::line(ImVec2 a, ImVec2 b, ImU32 color, float thickness) {
    auto* dl = ImGui::GetWindowDrawList();
    dl->Flags |= ImDrawListFlags_AntiAliasedLines;
    dl->AddLine(a, b, color, thickness);
}

bool custom_imgui::begin_child(ChildState* state, ImGuiChildFlags child_flags, ImGuiWindowFlags window_flags) {
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {ui_theme::CONTENT_PADDING, ui_theme::CONTENT_PADDING});
    return ImGui::BeginChild(state->m_id.c_str(), state->m_size, child_flags | ImGuiChildFlags_AlwaysUseWindowPadding,
                             window_flags);
}

void custom_imgui::end_child(ChildState* state, customChildBorder flags, ImU32 color, float thickness) {
    ImGui::EndChild();
    ImGui::PopStyleVar(1);

    auto min = ImGui::GetItemRectMin();
    auto max = ImGui::GetItemRectMax();

    if (state != nullptr && (state->m_resize & CHILD_RESIZE_X || state->m_resize & CHILD_RESIZE_Y)) {
        const bool is_mouse_down = ImGui::IsMouseDown(ImGuiMouseButton_Left);

        if (state->m_dragging) {
            ImGuiWindow* root = ImGui::GetCurrentWindow()->RootWindow;
            ImVec2 mouse_pos = ImGui::GetMousePos();

            if (is_mouse_down) {

                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeAll);

                if (state->m_resizing & CHILD_RESIZE_X) {
                    float delta = mouse_pos.x - state->m_drag_start.x;
                    state->m_size.x = std::clamp(state->m_previous_size.x + delta, MIN_CHILD_SIZE, root->Size.x);
                } else if (state->m_resize & CHILD_RESIZE_Y) {
                    float delta = mouse_pos.y - state->m_drag_start.y;
                    state->m_size.y = std::clamp(state->m_previous_size.y + delta, MIN_CHILD_SIZE, root->Size.y);
                }
            } else {
                ImGui::SetMouseCursor(ImGuiMouseCursor_None);

                state->m_dragging = false;
                state->m_drag_start = {0.0f, 0.0f};
                state->m_resizing = CHILD_RESIZE_NONE;
            }
        } else {
            const bool is_hovering_x = ImGui::IsMouseHoveringRect({max.x - 20.0f, min.y}, max);
            const bool is_hovering_y = ImGui::IsMouseHoveringRect({min.x, max.y - 20.0f}, max);

            if (is_mouse_down && (is_hovering_x || is_hovering_y)) {
                state->m_dragging = true;
                state->m_drag_start = ImGui::GetMousePos();
                state->m_previous_size = state->m_size;
                state->m_resizing = is_hovering_x ? CHILD_RESIZE_X : CHILD_RESIZE_Y;
            } else if (is_hovering_x) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeEW);
            } else if (is_hovering_y) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeNS);
            }
        }
    }

    if (flags == BORDER_NONE) {
        return;
    }

    ImDrawList* dl = ImGui::GetForegroundDrawList();
    dl->Flags |= ImDrawListFlags_AntiAliasedLines;

    if (flags & BORDER_ALL) {
        dl->AddRect(min, max, color, 0.0f, thickness);
    } else {
        if (flags & BORDER_TOP) dl->AddLine({min.x, min.y}, {max.x, min.y}, color, thickness);
        if (flags & BORDER_BOTTOM) dl->AddLine({min.x, max.y}, {max.x, max.y}, color, thickness);
        if (flags & BORDER_LEFT) dl->AddLine({min.x, min.y}, {min.x, max.y}, color, thickness);
        if (flags & BORDER_RIGHT) dl->AddLine({max.x, min.y}, {max.x, max.y}, color, thickness);
    };
}
