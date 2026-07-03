#include "./custom.hpp"
#include "../utils/math.hpp"
#include "imgui.h"
#include "ui.hpp"
#include "ui/theme.hpp"

#include <stdexcept>
#include <string_view>
#include <algorithm>
#include <format>
#include <imgui_internal.h>
#include <imgui_stdlib.h>

static constexpr float MIN_CHILD_SIZE = 32.0f;
static constexpr float CHILD_RESIZE_HANDLE_SIZE = 20.0f;
static constexpr float ALPHA_ANIM_SPEED = 12.0f;
static constexpr float TAB_TEXT_COLOR_ANIM_SPEED = 14.0f;
static constexpr float TAB_LINE_ANIM_SPEED = 14.0f;
static constexpr float TAB_LINE_ALPHA_ANIM_SPEED = 18.0f;

static TabButtonStyle get_tab_button_target_style(bool visible, bool hovered, bool selected, bool is_title) {
    TabButtonStyle style;

    style.text_color.set((selected || is_title) ? ui_theme::ACCENT_COLOR : ui_theme::TEXT_COLOR);

    if (!visible) {
        style.line_alpha.value = 0.0f;
        style.line_width.value = 0.0f;
        return style;
    }

    if (selected) {
        style.line_alpha.value = 1.0f;
        style.line_width.value = 1.0f;
        return style;
    }

    if (hovered) {
        style.line_alpha.value = ui_theme::HOVER_LINE_ALPHA;
        style.line_width.value = 1.0f;
        return style;
    }

    style.line_alpha.value = 0.0f;
    style.line_width.value = 0.0f;
    return style;
}

static void tick_tab_button_style(TabButtonState& state, const TabButtonStyle& target) {
    const float dt = ImGui::GetIO().DeltaTime;

    state.tick(ALPHA_ANIM_SPEED, dt);
    state.style.line_alpha.tick(target.line_alpha.value, TAB_LINE_ALPHA_ANIM_SPEED, dt);
    state.style.line_width.tick(target.line_width.value, TAB_LINE_ANIM_SPEED, dt);
    state.style.text_color.tick(target.text_color.value, TAB_TEXT_COLOR_ANIM_SPEED, dt);
}

static void delete_gl_texture(uint32_t texture_id) {
    if (texture_id == 0) {
        return;
    }

    GLuint gl_texture_id = texture_id;
    glDeleteTextures(1, &gl_texture_id);
}

void custom_imgui::destroy_texture(uint32_t id) {
    delete_gl_texture(id);
}

// TODO: move to its own file...
IconTexture::IconTexture(std::filesystem::path& location) {
    auto document = lunasvg::Document::loadFromFile(location.string());

    // TODO: replace with some placeholder document? idk
    if (document == nullptr) {
        throw std::runtime_error(std::format("[IconTexture] failed to find {}", location.string()));
    }

    m_document = std::move(document);
}

GLuint IconTexture::load(uint8_t* data, int w, int h) {
    // Create a OpenGL texture identifier
    GLuint image_texture;
    glGenTextures(1, &image_texture);
    glBindTexture(GL_TEXTURE_2D, image_texture);

    // Setup filtering parameters for display
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    // Upload bitmap into texture
    glPixelStorei(GL_UNPACK_ROW_LENGTH, 0);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);

    return image_texture;
}

// TODO: move custom widgets to its own fils

void custom_imgui::image(IconTexture* texture, ImVec2 size, ImColor color) {
    GLuint id = texture->get(static_cast<int>(size.x), static_cast<int>(size.y));
    ImGui::ImageWithBg(static_cast<ImTextureID>(id), size, {0, 0}, {1, 1}, ImColor(0, 0, 0, 0), color);
}

InputState::InputState(IconTexture* texture) {
    m_search_texture = texture;
}

void custom_imgui::search_input(InputState* state) {
    const float icon_size = 18.0f;
    const float dt = ImGui::GetIO().DeltaTime;

    ImVec2 size = state->m_size;

    {
        const ImVec2 available = ImGui::GetContentRegionAvail();

        if (state->m_fit_width) {
            size.x = available.x;
        }

        // let imgui grow
        size.y = 0.0f;
    }

    auto label = std::format("##{}", state->m_label);

    auto window_flags = ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse;
    auto child_flags =
        ImGuiChildFlags_AlwaysUseWindowPadding | ImGuiChildFlags_AutoResizeX | ImGuiChildFlags_AutoResizeY;

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, ui_theme::BOX_ROUNDING);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0f, 2.0f});
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);

    auto border_color = ImColor(ui_theme::BORDER_COLOR);

    ImGui::BeginChild(label.c_str(), size, child_flags, window_flags);
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        const float frame_height = ImGui::GetFrameHeight();
        const float row_start_y = ImGui::GetCursorPosY();

        ImGui::SetCursorPosY(row_start_y + (available.y - icon_size) * 0.5f);
        image(state->m_search_texture, {icon_size, icon_size}, state->style.m_icon_color);

        ImGui::SameLine(0.0f, 10.0f);
        ImGui::SetCursorPosY(row_start_y + (available.y - frame_height) * 0.5f);

        ImGui::SetNextItemWidth(size.x);
        ImGui::InputText(label.c_str(), &state->m_value);

        const bool is_active = ImGui::IsItemActive();
        const bool is_hovered = ImGui::IsItemHovered();

        if (is_active) {
            border_color = ImColor(ui_theme::ACCENT_COLOR);
        } else if (is_hovered) {
            border_color = ImColor(ui_theme::ACCENT_HOVER_COLOR);
        }
    }
    ImGui::EndChild();
    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(3);

    state->style.m_border_color.tick(border_color, ALPHA_ANIM_SPEED * 2, dt);

    const ImVec2 rect_min = ImGui::GetItemRectMin();
    const ImVec2 rect_max = ImGui::GetItemRectMax();

    auto* dl = ImGui::GetWindowDrawList();
    dl->AddRect(rect_min, rect_max, ImColor(state->style.m_border_color.value), ui_theme::BOX_ROUNDING, 0, 4.0f);
}

CollectionCardState::CollectionCardState(IconTexture* texture) {
    m_music_texture = texture;
}

// TODO: return pair for (0 -> left clicked, 1 -> right clicked)
// TOFIX: image / name / count doenst feel vertically centered at all
bool custom_imgui::collection_card(CollectionCardState* state, int count) {
    const float icon_size = 16.0f;
    const float dt = ImGui::GetIO().DeltaTime;

    ImVec2 size = state->m_size;

    // collection card will always use the full width
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        size.x = available.x;
    }

    auto window_flags = ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse;
    auto child_flags = ImGuiChildFlags_AlwaysUseWindowPadding;

    auto border_color = state->m_selected ? ui_theme::ACCENT_COLOR_HALF : ui_theme::TRANSPARENT;
    auto bg_color = state->m_selected ? ui_theme::ACCENT_COLOR_SECONDARY : ui_theme::TRANSPARENT;

    auto label = std::format("##collection-{}-{}", state->m_name, (void*)state);

    state->style.m_border_color.tick(border_color, ALPHA_ANIM_SPEED * 2, dt);
    state->style.m_bg_color.tick(bg_color, ALPHA_ANIM_SPEED * 2, dt);

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, ui_theme::BOX_ROUNDING);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0f, 0.0f});

    ImGui::PushStyleColor(ImGuiCol_ChildBg, state->style.m_bg_color.value);
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);

    const std::string count_text = std::format("{} {}", count, count == 1 ? "map" : "maps");

    // calc text size
    ImGui::PushFont(state->m_font_small);
    auto count_size = ImGui::CalcTextSize(count_text.c_str());
    ImGui::PopFont();

    ImGui::PushFont(state->m_font);
    auto name_size = ImGui::CalcTextSize(state->m_name.c_str());
    ImGui::PopFont();

    ImGui::BeginChild(label.c_str(), size, child_flags, window_flags);
    {
        ImGui::PushFont(state->m_font);

        const ImVec2 available = ImGui::GetContentRegionAvail();
        const float row_start_y = ImGui::GetCursorPosY();

        // music icon
        {
            ImGui::SetCursorPosY(row_start_y + (available.y - icon_size) * 0.5f);
            image(state->m_music_texture, {icon_size, icon_size}, state->style.m_icon_color);
        }

        // name
        {
            ImGui::SameLine(0.0f, 10.0f);
            ImGui::SetCursorPosY(row_start_y + (available.y - name_size.y) * 0.5f);
            ImGui::TextUnformatted(state->m_name.c_str());
        }

        // count
        {
            ImGui::SameLine();

            ImGui::SetCursorPosX(available.x - count_size.x);
            ImGui::SetCursorPosY(row_start_y + (available.y - count_size.y) * 0.5f);

            ImGui::PushFont(state->m_font_small);
            ImGui::TextUnformatted(count_text.c_str());
            ImGui::PopFont();
        }

        ImGui::PopFont();
    }
    ImGui::EndChild();
    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(4);

    const ImVec2 rect_min = ImGui::GetItemRectMin();
    const ImVec2 rect_max = ImGui::GetItemRectMax();

    auto* dl = ImGui::GetWindowDrawList();
    dl->AddRect(rect_min, rect_max, ImColor(state->style.m_border_color.value), ui_theme::BOX_ROUNDING, 0, 1.0f);

    return ImGui::IsMouseClicked(ImGuiMouseButton_Left) && ImGui::IsMouseHoveringRect(rect_min, rect_max);
}

void custom_imgui::line(ImVec2 a, ImVec2 b, ImU32 color, float thickness) {
    auto* dl = ImGui::GetWindowDrawList();
    dl->Flags |= ImDrawListFlags_AntiAliasedLinesUseTex;
    dl->AddLine(a, b, color, thickness);
}

bool custom_imgui::begin_child(ChildState& state, ImGuiChildFlags child_flags, ImGuiWindowFlags window_flags) {
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {ui_theme::CONTENT_PADDING, ui_theme::CONTENT_PADDING});
    return ImGui::BeginChild(state.m_id.c_str(), state.m_size, child_flags | ImGuiChildFlags_AlwaysUseWindowPadding,
                             window_flags);
}

void custom_imgui::end_child(ChildState& state, float thickness) {
    ImGui::EndChild();
    ImGui::PopStyleVar(1);

    auto min = ImGui::GetItemRectMin();
    auto max = ImGui::GetItemRectMax();

    if (state.m_resize & CHILD_RESIZE_X || state.m_resize & CHILD_RESIZE_Y || state.m_resize & CHILD_RESIZE_ALL) {
        const bool is_mouse_down = ImGui::IsMouseDown(ImGuiMouseButton_Left);

        if (state.m_dragging) {
            ImGuiWindow* root = ImGui::GetCurrentWindow()->RootWindow;
            ImVec2 mouse_pos = ImGui::GetMousePos();

            if (is_mouse_down) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeAll);

                if (state.m_resizing & CHILD_RESIZE_X) {
                    float delta = mouse_pos.x - state.m_drag_start.x;
                    state.m_size.x = std::clamp(state.m_previous_size.x + delta, MIN_CHILD_SIZE, root->Size.x);
                } else if (state.m_resizing & CHILD_RESIZE_Y) {
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

            const bool is_hovering_x = ImGui::IsMouseHoveringRect({max.x - CHILD_RESIZE_HANDLE_SIZE, min.y}, max);
            const bool is_hovering_y = ImGui::IsMouseHoveringRect({min.x, max.y - CHILD_RESIZE_HANDLE_SIZE}, max);

            const bool should_drag_x = state.m_last_click_pos.x > max.x - CHILD_RESIZE_HANDLE_SIZE &&
                                       state.m_last_click_pos.x < max.x && state.m_last_click_pos.y > min.y &&
                                       state.m_last_click_pos.y < max.y;

            const bool should_drag_y = state.m_last_click_pos.x > min.x && state.m_last_click_pos.x < max.x &&
                                       state.m_last_click_pos.y > max.y - CHILD_RESIZE_HANDLE_SIZE &&
                                       state.m_last_click_pos.y < max.y;

            if (is_mouse_down && (should_drag_x || should_drag_y)) {
                state.m_dragging = true;
                state.m_drag_start = ImGui::GetMousePos();
                state.m_previous_size = state.m_size;
                state.m_resizing = should_drag_x ? CHILD_RESIZE_X : CHILD_RESIZE_Y;
            } else if (is_hovering_x) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeEW);
            } else if (is_hovering_y) {
                ImGui::SetMouseCursor(ImGuiMouseCursor_ResizeNS);
            }
        }
    }

    if (state.m_border == BORDER_NONE) {
        return;
    }

    ImDrawList* dl = ImGui::GetForegroundDrawList();
    dl->Flags |= ImDrawListFlags_AntiAliasedLines;

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
    };
}

bool custom_imgui::tab_button(TabButtonState& state, std::string_view label, bool selected, bool draw_line,
                              bool is_title) {
    if (state.is_hidden()) {
        return false;
    }

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state.alpha.value);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2{8.0f, 6.0f});
    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4{});
    ImGui::PushStyleColor(ImGuiCol_Text, state.style.text_color.value);

    const bool is_pressed = ImGui::Button(std::format("{}##tab", label).c_str());
    const bool is_hovered = ImGui::IsItemHovered();

    tick_tab_button_style(state, get_tab_button_target_style(state.visible, is_hovered, selected, is_title));

    if (draw_line && !is_title) {
        const float line_alpha = state.style.line_alpha.value;
        const float line_width_t = state.style.line_width.value;

        if (line_alpha > 0.0f) {
            const ImVec2 rect_min = ImGui::GetItemRectMin();
            const ImVec2 rect_max = ImGui::GetItemRectMax();
            const float full_width = rect_max.x - rect_min.x;
            const float line_width = full_width * math_utils::smoothstep(line_width_t);
            const float line_x = rect_min.x + ((full_width - line_width) * 0.5f);
            const float line_y = rect_max.y + ui_theme::LINE_OFFSET;
            ImVec4 line_color = ui_theme::ACCENT_COLOR;
            line_color.w *= line_alpha;

            ImGui::GetWindowDrawList()->AddRectFilled(ImVec2{line_x, line_y},
                                                      ImVec2{line_x + line_width, line_y + ui_theme::LINE_HEIGHT},
                                                      ImGui::ColorConvertFloat4ToU32(line_color));
        }
    }

    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(4);

    return is_pressed;
}
