#include "./custom.hpp"
#include "./theme.hpp"
#include "../utils/math.hpp"

#include <optional>
#include <string_view>
#include <algorithm>
#include <format>
#include <glad/gl.h>
#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>
#include <imgui_internal.h>
#include <imgui_stdlib.h>

static constexpr float MIN_CHILD_SIZE = 32.0f;
static constexpr float CHILD_RESIZE_HANDLE_SIZE = 20.0f;
static constexpr float TAB_ALPHA_ANIM_SPEED = 12.0f;
static constexpr float TAB_TEXT_COLOR_ANIM_SPEED = 14.0f;
static constexpr float TAB_LINE_ANIM_SPEED = 14.0f;
static constexpr float TAB_LINE_ALPHA_ANIM_SPEED = 18.0f;

static bool is_texture_valid(const ImageTexture& texture) {
    return texture.m_id != 0 && texture.m_width > 0 && texture.m_height > 0;
}

static ImTextureID imgui_texture_id(const ImageTexture& texture) {
    return static_cast<ImTextureID>(texture.m_id);
}

static ImVec2 texture_size(const ImageTexture& texture) {
    return {static_cast<float>(texture.m_width), static_cast<float>(texture.m_height)};
}

static void delete_gl_texture(uint32_t texture_id) {
    if (texture_id == 0) {
        return;
    }

    GLuint gl_texture_id = texture_id;
    glDeleteTextures(1, &gl_texture_id);
}

std::optional<ImageTexture> load_texture_from_memory(const void* data, size_t data_size) {
    int image_width = 0;
    int image_height = 0;

    unsigned char* image_data =
        stbi_load_from_memory((const unsigned char*)data, (int)data_size, &image_width, &image_height, NULL, 4);

    if (image_data == NULL) {
        return std::nullopt;
    }

    // Create a OpenGL texture identifier
    GLuint image_texture;
    glGenTextures(1, &image_texture);
    glBindTexture(GL_TEXTURE_2D, image_texture);

    // Setup filtering parameters for display
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    // Upload pixels into texture
    glPixelStorei(GL_UNPACK_ROW_LENGTH, 0);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, image_width, image_height, 0, GL_RGBA, GL_UNSIGNED_BYTE, image_data);

    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, image_width, image_height, 0, GL_RGBA, GL_UNSIGNED_BYTE, image_data);
    glGenerateMipmap(GL_TEXTURE_2D);

    stbi_image_free(image_data);

    ImageTexture texture;

    texture.m_id = image_texture;
    texture.m_width = image_width;
    texture.m_height = image_height;

    return texture;
}

std::optional<ImageTexture> custom_imgui::load_texture_from_file(std::string_view file_name) {
    FILE* f = fopen(file_name.data(), "rb");

    if (f == NULL) {
        return std::nullopt;
    }

    fseek(f, 0, SEEK_END);

    long file_size = ftell(f);

    if (file_size == -1) {
        return std::nullopt;
    }

    fseek(f, 0, SEEK_SET);
    void* file_data = IM_ALLOC(file_size);
    fread(file_data, 1, file_size, f);
    fclose(f);

    auto ret = load_texture_from_memory(file_data, file_size);
    IM_FREE(file_data);
    return ret;
}

void custom_imgui::destroy_texture(ImageTexture& texture) {
    delete_gl_texture(texture.m_id);

    texture.m_id = 0;
    texture.m_width = 0;
    texture.m_height = 0;
}

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

    state.tick(TAB_ALPHA_ANIM_SPEED, dt);
    state.style.line_alpha.tick(target.line_alpha.value, TAB_LINE_ALPHA_ANIM_SPEED, dt);
    state.style.line_width.tick(target.line_width.value, TAB_LINE_ANIM_SPEED, dt);
    state.style.text_color.tick(target.text_color.value, TAB_TEXT_COLOR_ANIM_SPEED, dt);
}

InputState::InputState(ImageTexture texture) {
    m_search_texture = texture;
}

// custom widgets

void custom_imgui::search_input(InputState* state) {
    static const float icon_size = 20.0f;

    const ImVec2 available = ImGui::GetContentRegionAvail();

    auto window_flags = ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse;
    auto child_flags =
        ImGuiChildFlags_AlwaysUseWindowPadding | ImGuiChildFlags_AutoResizeX | ImGuiChildFlags_AutoResizeY;

    auto label = std::format("##{}", state->m_label);
    ImVec2 size = state->m_size;

    if (state->m_fit_width) {
        size.x = available.x;
    }

    size.y = 0.0f;

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, ui_theme::BOX_ROUNDING);
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ui_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ui_theme::TRANSPARENT);

    auto border_color = ImColor(state->m_border_color);

    ImGui::BeginChild(label.c_str(), size, child_flags, window_flags);
    {
        const float frame_height = ImGui::GetFrameHeight();
        const float row_height = ImMax(icon_size, frame_height);
        const float row_start_y = ImGui::GetCursorPosY();

        ImGui::SetCursorPosY(row_start_y + (row_height - icon_size) * 0.5f);
        image(state->m_search_texture, {icon_size, icon_size});

        ImGui::SameLine(0.0f, 5.0f);
        ImGui::SetCursorPosY(row_start_y + (row_height - frame_height) * 0.5f);

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
    ImGui::PopStyleVar(1);
    ImGui::PopStyleColor(3);

    const ImVec2 rect_min = ImGui::GetItemRectMin();
    const ImVec2 rect_max = ImGui::GetItemRectMax();

    auto* dl = ImGui::GetWindowDrawList();
    dl->Flags |= ImDrawListFlags_AntiAliasedLinesUseTex;

    dl->AddRect(rect_min, rect_max, border_color, ui_theme::BOX_ROUNDING, 0, 4.0f);
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

void custom_imgui::image(const ImageTexture& texture, ImVec2 size) {
    if (!is_texture_valid(texture)) {
        return;
    }

    if (size.x <= 0.0f || size.y <= 0.0f) {
        size = texture_size(texture);
    }

    ImGui::Image(imgui_texture_id(texture), size);
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
