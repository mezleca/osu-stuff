#include "custom.hpp"
#include "ui/theme.hpp"
#include "texture/icon.hpp"

#include <stdexcept>
#include <algorithm>
#include <format>
#include <imgui_internal.h>
#include <imgui_stdlib.h>

static constexpr float MIN_CHILD_SIZE = 32.0f;
static constexpr float CHILD_RESIZE_HANDLE_SIZE = 20.0f;

void custom_imgui::destroy_texture(uint32_t texture_id) {
    if (texture_id == 0) {
        return;
    }

    GLuint gl_texture_id = texture_id;
    glDeleteTextures(1, &gl_texture_id);
}

void custom_imgui::image(IconTexture* texture, ImVec2 size, ImColor color) {
    GLuint id = texture->get(static_cast<int>(size.x), static_cast<int>(size.y));
    ImGui::ImageWithBg(static_cast<ImTextureID>(id), size, {0, 0}, {1, 1}, ImColor(0, 0, 0, 0), color);
}

void custom_imgui::line(ImVec2 a, ImVec2 b, ImU32 color, float thickness) {
    auto* dl = ImGui::GetWindowDrawList();
    dl->Flags |= ImDrawListFlags_AntiAliasedLinesUseTex;
    dl->AddLine(a, b, color, thickness);
}

bool custom_imgui::begin_child(ChildState& state, ImGuiChildFlags child_flags, ImGuiWindowFlags window_flags) {
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {ui_theme::CONTENT_PADDING, ui_theme::CONTENT_PADDING});
    return ImGui::BeginChild(
        state.m_id.c_str(), state.m_size, child_flags | ImGuiChildFlags_AlwaysUseWindowPadding, window_flags
    );
}

void custom_imgui::end_child(ChildState& state, float thickness) {
    ImGui::EndChild();
    ImGui::PopStyleVar(1);

    auto min = ImGui::GetItemRectMin();
    auto max = ImGui::GetItemRectMax();

    if (state.m_resize & CHILD_RESIZE_X || state.m_resize & CHILD_RESIZE_Y || state.m_resize & CHILD_RESIZE_ALL) {
        const bool is_mouse_down = ImGui::IsMouseDown(ImGuiMouseButton_Left);
        const ImVec2 handle_min = {max.x - CHILD_RESIZE_HANDLE_SIZE, max.y - CHILD_RESIZE_HANDLE_SIZE};

        if (state.m_dragging) {
            ImGuiWindow* root = ImGui::GetCurrentWindow()->RootWindow;
            ImVec2 mouse_pos = ImGui::GetMousePos();

            if (is_mouse_down) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeAll);

                if (state.m_resizing & CHILD_RESIZE_X) {
                    float delta = mouse_pos.x - state.m_drag_start.x;
                    state.m_size.x = std::clamp(state.m_previous_size.x + delta, MIN_CHILD_SIZE, root->Size.x);
                }
                if (state.m_resizing & CHILD_RESIZE_Y) {
                    float delta = mouse_pos.y - state.m_drag_start.y;
                    state.m_size.y = std::clamp(state.m_previous_size.y + delta, MIN_CHILD_SIZE, root->Size.y);
                }
            } else {
                ImGui::SetMouseCursor(ImGuiMouseCursor_None);

                state.m_dragging = false;
                state.m_last_click_pos = {0.0f, 0.0f};
                state.m_drag_start = {0.0f, 0.0f};
                state.m_resizing = CHILD_RESIZE_NONE;
            }
        } else {
            if (is_mouse_down && state.m_last_click_pos.x == 0 && state.m_last_click_pos.y == 0) {
                state.m_last_click_pos = ImGui::GetMousePos();
            } else if (!is_mouse_down && state.m_last_click_pos.x != 0 && state.m_last_click_pos.y != 0) {
                state.m_last_click_pos = {0.0f, 0.0f};
            }

            const bool is_hovering_handle = ImGui::IsMouseHoveringRect(handle_min, max);

            const bool should_drag_handle = state.m_last_click_pos.x > handle_min.x &&
                                            state.m_last_click_pos.x < max.x &&
                                            state.m_last_click_pos.y > handle_min.y && state.m_last_click_pos.y < max.y;

            if (is_mouse_down && should_drag_handle) {
                state.m_dragging = true;
                state.m_drag_start = ImGui::GetMousePos();
                state.m_previous_size = state.m_size;
                state.m_resizing = state.m_resize;
            } else if (is_hovering_handle) {
                if (state.m_resize & CHILD_RESIZE_X && state.m_resize & CHILD_RESIZE_Y) {
                    ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeNWSE);
                } else if (state.m_resize & CHILD_RESIZE_X) {
                    ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeEW);
                } else if (state.m_resize & CHILD_RESIZE_Y) {
                    ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeNS);
                }
            }
        }
    }

    ImDrawList* dl = ImGui::GetForegroundDrawList();
    dl->Flags |= ImDrawListFlags_AntiAliasedLines;

    // draw child borders
    if (!(state.m_border & BORDER_NONE)) {
        if (state.m_border & BORDER_ALL) {
            dl->AddRect(min, max, state.m_border_color, 0.0f, 0, thickness);
        } else {
            if (state.m_border & BORDER_TOP) {
                dl->AddLine({min.x, min.y}, {max.x, min.y}, state.m_border_color, thickness);
            }
            if (state.m_border & BORDER_BOTTOM) {
                dl->AddLine({min.x, max.y}, {max.x, max.y}, state.m_border_color, thickness);
            }
            if (state.m_border & BORDER_LEFT) {
                dl->AddLine({min.x, min.y}, {min.x, max.y}, state.m_border_color, thickness);
            }
            if (state.m_border & BORDER_RIGHT) {
                dl->AddLine({max.x, min.y}, {max.x, max.y}, state.m_border_color, thickness);
            }
        }
    }

    // draw resize borders
    if (!(state.m_resize & CHILD_RESIZE_NONE)) {
        float offset = 1;

        for (int i = 0; i < 5; i++) {
            dl->AddLine({max.x - offset, max.y}, {max.x, max.y - offset}, state.m_border_color, 1.0f);
            offset += 3;
        }
    }
}
