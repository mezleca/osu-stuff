#include "ui.hpp"
#include "ui/theme.hpp"
#include "imgui.h"

#include <SDL3/SDL_opengl.h>
#include <imgui_impl_opengl3.h>
#include <imgui_impl_sdl3.h>
#include <iostream>

UI::UI(SDL_GLContext* ctx, SDL_Window* window) {
    float main_scale = SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay());

    ImGui::CreateContext();
    io = &ImGui::GetIO();

    io->IniFilename = nullptr;
    io->LogFilename = nullptr;

    ImGui::StyleColorsDark();

    // setup default theme
    ImGuiStyle& style = ImGui::GetStyle();
    ImVec4* colors = style.Colors;

    style.WindowRounding = 0.0f;
    style.ChildRounding = 0.0f;
    style.FrameRounding = 4.0f;
    style.PopupRounding = 6.0f;
    style.GrabRounding = 4.0f;
    style.TabRounding = 4.0f;
    style.WindowPadding = ImVec2{0.0f, 0.0f};
    style.FramePadding = ImVec2{12.0f, 8.0f};
    style.ItemSpacing = ImVec2{10.0f, 10.0f};
    style.ItemInnerSpacing = ImVec2{8.0f, 6.0f};
    style.CellPadding = ImVec2{0.0f, 0.0f};
    style.ScaleAllSizes(main_scale);
    style.FontScaleDpi = main_scale;

    ImFontConfig font_cfg;
    font_cfg.PixelSnapH = false;
    font_cfg.OversampleH = 5;
    font_cfg.OversampleV = 5;
    font_cfg.RasterizerMultiply = 1.2f;

    colors[ImGuiCol_WindowBg] = ui_theme::BG_COLOR;
    colors[ImGuiCol_ChildBg] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_Border] = ui_theme::HEADER_BORDER_COLOR;
    colors[ImGuiCol_Separator] = ui_theme::HEADER_BORDER_COLOR;
    colors[ImGuiCol_Text] = ui_theme::TEXT_COLOR;
    colors[ImGuiCol_TextDisabled] = ui_theme::TEXT_SECONDARY_COLOR;
    colors[ImGuiCol_Button] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_ButtonHovered] = ui_theme::BG_TERTIARY_COLOR;
    colors[ImGuiCol_ButtonActive] = ui_theme::BUTTON_ACTIVE_COLOR;
    colors[ImGuiCol_Header] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_HeaderHovered] = ui_theme::BG_TERTIARY_COLOR;
    colors[ImGuiCol_HeaderActive] = ui_theme::BUTTON_ACTIVE_COLOR;
    colors[ImGuiCol_FrameBg] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_FrameBgHovered] = ui_theme::BG_TERTIARY_COLOR;
    colors[ImGuiCol_FrameBgActive] = ui_theme::BUTTON_ACTIVE_COLOR;
    colors[ImGuiCol_TitleBg] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_TitleBgActive] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_CheckMark] = ui_theme::ACCENT_COLOR;
    colors[ImGuiCol_SliderGrab] = ui_theme::ACCENT_COLOR;
    colors[ImGuiCol_SliderGrabActive] = ui_theme::ACCENT_HOVER_COLOR;

    ImGui_ImplSDL3_InitForOpenGL(window, ctx);
    ImGui_ImplOpenGL3_Init("#version 300 es");

    // initialize tabs
    for (auto& tab : create_default_tabs()) {
        m_tabs.emplace_back(custom_imgui::TabButtonState{}, std::move(tab));
    }

    // initialize / preload some fonts
    m_fonts[TORUS].initialize(font_cfg, "resources/fonts/Torus-Regular.ttf", io);
    m_fonts[TORUS_SEMI].initialize(font_cfg, "resources/fonts/Torus-SemiBold.ttf", io);
    m_fonts[TORUS_BOLD].initialize(font_cfg, "resources/fonts/Torus-Bold.ttf", io);

    for (auto& font : m_fonts) {
        font.load(FONT_SMALL);
        font.load(FONT_MEDIUM);
        font.load(FONT_LARGE);
    }
}

void UIFont::initialize(ImFontConfig cfg, std::string_view location, ImGuiIO* io) {
    m_font_location = location;
    m_cfg = cfg;
    m_io = io;
}

ImFont* UIFont::load_font_variation(int size) {
    std::cout << "[ui] loading " << m_font_location << " (" << size << ")\n";

    ImFont* font = m_io->Fonts->AddFontFromFileTTF(m_font_location.c_str(), static_cast<float>(size), &m_cfg);

    if (font != nullptr) {
        m_fonts[size] = font;
    }

    return font;
}

bool UIFont::load(int size) {
    if (m_font_location.empty()) {
        return false;
    }

    if (load_font_variation(size) == nullptr) {
        std::cout << "[ui] failed to load " << m_font_location << " (" << size << ")\n";
        return false;
    }

    return true;
}

UI::~UI() {
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplSDL3_Shutdown();
    ImGui::DestroyContext();
}

void UI::process_sdl_event(SDL_Event* event) {
    ImGui_ImplSDL3_ProcessEvent(event);
}

void UI::render() {
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplSDL3_NewFrame();
    ImGui::NewFrame();

    static ImGuiWindowFlags flags = ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove |
                                    ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoSavedSettings;
    static const ImGuiViewport* viewport = ImGui::GetMainViewport();

    auto torus_bold = m_fonts[TORUS_BOLD].get(FONT_MEDIUM);
    auto torus_semi = m_fonts[TORUS_BOLD].get(FONT_MEDIUM);

    ImGui::SetNextWindowPos(viewport->WorkPos);
    ImGui::SetNextWindowSize(viewport->WorkSize);

    ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 0.0f);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {0.0f, 0.0f});
    ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);

    ImGui::Begin("##osu-stuff", nullptr, flags);
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        ImGui::PushFont(torus_bold);
        const float font_height = ImGui::GetFrameHeight();
        ImGui::PopFont();

        // header
        ImGui::PushStyleColor(ImGuiCol_ChildBg, ui_theme::HEADER_BG_COLOR);
        ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, 0.0f);
        ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, ImVec2(0.0f, 0.0f));
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {ui_theme::CONTENT_PADDING, ui_theme::CONTENT_PADDING});

        const ImVec2 header_cursor_start = ImGui::GetCursorPos();
        const float header_size_y = font_height + ui_theme::CONTENT_PADDING * 2;

        ImGui::BeginChild("header", ImVec2{available.x, header_size_y}, ImGuiChildFlags_AlwaysUseWindowPadding,
                          ImGuiWindowFlags_None);
        {
            ImGui::PushFont(torus_bold);
            {
                for (std::size_t index = 0; index < m_tabs.size(); ++index) {
                    auto& pair = m_tabs[index];

                    auto& button = pair.first;
                    UITab* tab = pair.second.get();

                    std::string current_id = m_current_tab != nullptr ? m_current_tab->m_id : "";

                    const char* label = tab->m_id == "index" ? "osu-stuff" : tab->m_id.c_str();
                    const bool is_title = tab->m_id == "index";

                    if (index > 0) {
                        ImGui::SameLine(0.0f, ui_theme::HEADER_TABS_GAP);
                    }

                    if (custom_imgui::tab_button(button, label, current_id == tab->m_id, true, is_title)) {
                        m_current_tab = tab;
                    }
                }
            }
            ImGui::PopFont();

            auto* dl = ImGui::GetWindowDrawList();
            dl->Flags |= ImDrawListFlags_AntiAliasedLines;

            ImVec2 header_line_start = {header_cursor_start.x, header_cursor_start.y + header_size_y - 1.0f};
            ImVec2 header_line_end = {available.x, header_line_start.y};

            dl->AddLine(header_line_start, header_line_end, ImColor(ui_theme::HEADER_BORDER_COLOR), 1.0f);
        }
        ImGui::EndChild();
        ImGui::PopStyleVar(3);
        ImGui::PopStyleColor(1);

        ImGui::PushFont(torus_semi);

        if (m_current_tab != nullptr) {
            m_current_tab->render();
        }

        ImGui::PopFont();
    }
    ImGui::End();
    ImGui::PopStyleVar(3);

    ImGui::Render();

    glViewport(0, 0, (int)io->DisplaySize.x, (int)io->DisplaySize.y);
    glClearColor(ui_theme::BG_COLOR.x, ui_theme::BG_COLOR.y, ui_theme::BG_COLOR.z, ui_theme::BG_COLOR.w);
    glClear(GL_COLOR_BUFFER_BIT);

    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}
