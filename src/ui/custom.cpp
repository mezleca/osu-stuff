#include "./custom.hpp"
#include "./theme.hpp"
#include "../utils/math.hpp"

#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>

#include <SDL3/SDL_opengl.h>
#include <algorithm>
#include <fstream>
#include <format>
#include <imgui.h>
#include <imgui_internal.h>
#include <imgui_stdlib.h>
#include <iostream>
#include <vector>

static constexpr float MIN_CHILD_SIZE = 32.0f;
static constexpr float CHILD_RESIZE_HANDLE_SIZE = 20.0f;
static constexpr float TAB_ALPHA_ANIM_SPEED = 12.0f;
static constexpr float TAB_TEXT_COLOR_ANIM_SPEED = 14.0f;
static constexpr float TAB_LINE_ANIM_SPEED = 14.0f;
static constexpr float TAB_LINE_ALPHA_ANIM_SPEED = 18.0f;

static bool is_texture_valid(const custom_imgui::ImageTexture& texture) {
    return texture.m_id != 0 && texture.m_width > 0 && texture.m_height > 0;
}

static ImTextureID imgui_texture_id(const custom_imgui::ImageTexture& texture) {
    return static_cast<ImTextureID>(texture.m_id);
}

static ImVec2 texture_size(const custom_imgui::ImageTexture& texture) {
    return {static_cast<float>(texture.m_width), static_cast<float>(texture.m_height)};
}

static void delete_gl_texture(uint32_t texture_id) {
    if (texture_id == 0) {
        return;
    }

    GLuint gl_texture_id = texture_id;
    glDeleteTextures(1, &gl_texture_id);
}

static std::optional<custom_imgui::ImageTexture> create_texture_from_pixels(const unsigned char* pixels, int width,
                                                                            int height) {
    if (pixels == nullptr || width <= 0 || height <= 0) {
        return std::nullopt;
    }

    GLint previous_texture = 0;
    GLint previous_unpack_alignment = 0;
    glGetIntegerv(GL_TEXTURE_BINDING_2D, &previous_texture);
    glGetIntegerv(GL_UNPACK_ALIGNMENT, &previous_unpack_alignment);

    GLuint texture_id = 0;
    glGenTextures(1, &texture_id);
    glBindTexture(GL_TEXTURE_2D, texture_id);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, pixels);

    glPixelStorei(GL_UNPACK_ALIGNMENT, previous_unpack_alignment);
    glBindTexture(GL_TEXTURE_2D, previous_texture);

    custom_imgui::ImageTexture texture;
    texture.m_id = texture_id;
    texture.m_width = width;
    texture.m_height = height;
    return texture;
}

static std::optional<std::vector<unsigned char>> read_binary_file(const std::filesystem::path& path) {
    std::ifstream file(path, std::ios::binary | std::ios::ate);

    if (!file) {
        std::cout << "[ui] failed to open image file: " << path << "\n";
        return std::nullopt;
    }

    const std::streamsize size = file.tellg();

    if (size <= 0) {
        std::cout << "[ui] image file is empty: " << path << "\n";
        return std::nullopt;
    }

    std::vector<unsigned char> data(static_cast<std::size_t>(size));
    file.seekg(0, std::ios::beg);

    if (!file.read(reinterpret_cast<char*>(data.data()), size)) {
        std::cout << "[ui] failed to read image file: " << path << "\n";
        return std::nullopt;
    }

    return data;
}

static custom_imgui::TabButtonStyle get_tab_button_target_style(bool visible, bool hovered, bool selected,
                                                                bool is_title) {
    custom_imgui::TabButtonStyle style;

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

static void tick_tab_button_style(custom_imgui::TabButtonState& state, const custom_imgui::TabButtonStyle& target) {
    const float dt = ImGui::GetIO().DeltaTime;

    state.tick(TAB_ALPHA_ANIM_SPEED, dt);
    state.style.line_alpha.tick(target.line_alpha.value, TAB_LINE_ALPHA_ANIM_SPEED, dt);
    state.style.line_width.tick(target.line_width.value, TAB_LINE_ANIM_SPEED, dt);
    state.style.text_color.tick(target.text_color.value, TAB_TEXT_COLOR_ANIM_SPEED, dt);
}

void custom_imgui::search_input(std::string_view label, std::string& input) {
    ImGui::InputText(std::format("##{}", label).c_str(), &input);

    const bool is_active = ImGui::IsItemActive();
    const bool is_hovered = ImGui::IsItemHovered();

    auto min = ImGui::GetItemRectMin();
    auto max = ImGui::GetItemRectMax();

    auto color = ImColor(ui_theme::BORDER_COLOR);

    if (is_active) {
        color = ImColor(ui_theme::ACCENT_COLOR);
    } else if (is_hovered) {
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

std::optional<custom_imgui::ImageTexture> custom_imgui::load_texture_from_file(const std::filesystem::path& path) {
    const auto data = read_binary_file(path);

    if (!data.has_value()) {
        return std::nullopt;
    }

    return load_texture_from_memory(*data);
}

std::optional<custom_imgui::ImageTexture> custom_imgui::load_texture_from_memory(std::span<const unsigned char> data) {
    if (data.empty()) {
        std::cout << "[ui] failed to load image: empty image data\n";
        return std::nullopt;
    }

    int width = 0;
    int height = 0;
    int channels = 0;
    unsigned char* pixels =
        stbi_load_from_memory(data.data(), static_cast<int>(data.size()), &width, &height, &channels, 4);

    if (pixels == nullptr) {
        std::cout << "[ui] failed to decode image: " << stbi_failure_reason() << "\n";
        return std::nullopt;
    }

    auto texture = create_texture_from_pixels(pixels, width, height);
    stbi_image_free(pixels);

    if (!texture.has_value()) {
        std::cout << "[ui] failed to upload image texture\n";
    }

    return texture;
}

void custom_imgui::destroy_texture(ImageTexture& texture) {
    delete_gl_texture(texture.m_id);

    texture.m_id = 0;
    texture.m_width = 0;
    texture.m_height = 0;
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
