#include "ui.hpp"
#include "ui/theme.hpp"
#include "imgui.h"
#include "ui/tabs/tabs.hpp"
#include "ui/widgets/tab_button.hpp"

#include <SDL3/SDL_opengl.h>
#include <imgui_impl_opengl3.h>
#include <imgui_impl_sdl3.h>

#include <Torus_Bold.hpp>
#include <Torus_SemiBold.hpp>
#include <Torus_Regular.hpp>

UI::UI(SDL_GLContext* ctx, SDL_Window* window) {
    float main_scale = SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay());

    ImGui::CreateContext();
    io = &ImGui::GetIO();

    io->IniFilename = NULL;
    io->LogFilename = NULL;

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

    // initialize tab states
    for (const auto& tab : m_tabs_str) {
        TabButtonWidget state(tab);
        state.show();
        m_tabs.push_back(state);
    }

    // setup fonts
    m_fonts[TORUS][FONT_SMALL] =
        io->Fonts->AddFontFromMemoryCompressedTTF(C_TORUS_REGULAR, TORUS_REGULAR_SIZE, 14.0f, &font_cfg);
    m_fonts[TORUS][FONT_MEDIUM] =
        io->Fonts->AddFontFromMemoryCompressedTTF(C_TORUS_REGULAR, TORUS_REGULAR_SIZE, 20.0f, &font_cfg);
    m_fonts[TORUS][FONT_LARGE] =
        io->Fonts->AddFontFromMemoryCompressedTTF(C_TORUS_REGULAR, TORUS_REGULAR_SIZE, 26.0f, &font_cfg);

    m_fonts[TORUS_SEMI][FONT_SMALL] =
        io->Fonts->AddFontFromMemoryCompressedTTF(C_TORUS_SEMIBOLD, TORUS_SEMIBOLD_SIZE, 14.0f, &font_cfg);
    m_fonts[TORUS_SEMI][FONT_MEDIUM] =
        io->Fonts->AddFontFromMemoryCompressedTTF(C_TORUS_SEMIBOLD, TORUS_SEMIBOLD_SIZE, 20.0f, &font_cfg);
    m_fonts[TORUS_SEMI][FONT_LARGE] =
        io->Fonts->AddFontFromMemoryCompressedTTF(C_TORUS_SEMIBOLD, TORUS_SEMIBOLD_SIZE, 26.0f, &font_cfg);

    m_fonts[TORUS_BOLD][FONT_SMALL] =
        io->Fonts->AddFontFromMemoryCompressedTTF(C_TORUS_BOLD, TORUS_BOLD_SIZE, 14.0f, &font_cfg);
    m_fonts[TORUS_BOLD][FONT_MEDIUM] =
        io->Fonts->AddFontFromMemoryCompressedTTF(C_TORUS_BOLD, TORUS_BOLD_SIZE, 20.0f, &font_cfg);
    m_fonts[TORUS_BOLD][FONT_LARGE] =
        io->Fonts->AddFontFromMemoryCompressedTTF(C_TORUS_BOLD, TORUS_BOLD_SIZE, 26.0f, &font_cfg);
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

    ImGui::SetNextWindowPos(viewport->WorkPos);
    ImGui::SetNextWindowSize(viewport->WorkSize);

    ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 0.0f);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);

    ImGui::Begin("##osu-stuff", nullptr, flags);
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        ImGui::PushFont(m_fonts[TORUS_SEMI][FONT_MEDIUM]);
        const float header_height = ImGui::GetFrameHeight() + (ui_theme::HEADER_PADDING_Y * 2.0f) +
                                    ui_theme::LINE_OFFSET + ui_theme::LINE_HEIGHT;
        ImGui::PopFont();

        // header
        ImGui::PushStyleColor(ImGuiCol_ChildBg, ui_theme::HEADER_BG_COLOR);
        ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, 0.0f);
        ImGui::BeginChild("header", ImVec2{available.x, header_height}, ImGuiChildFlags_None, ImGuiWindowFlags_None);
        {
            ImGui::SetCursorPos(ImVec2{ui_theme::HEADER_PADDING_X, ui_theme::HEADER_PADDING_Y});
            ImGui::PushFont(m_fonts[TORUS_BOLD][FONT_MEDIUM]);
            {
                for (std::size_t index = 0; index < m_tabs.size(); ++index) {
                    auto& tab = m_tabs[index];
                    const char* label = tab.name == "index" ? "osu-stuff" : tab.name.c_str();
                    const bool is_title = tab.name == "index";

                    if (index > 0) {
                        ImGui::SameLine(0.0f, ui_theme::HEADER_TABS_GAP);
                    }

                    if (tab_button(tab, label, m_tab == tab.name, true, is_title)) {
                        m_tab = tab.name;
                    }
                }

                ImGui::Separator();
            }
            ImGui::PopFont();
        }
        ImGui::EndChild();
        ImGui::PopStyleVar();
        ImGui::PopStyleColor();

        // tab content
        ImGui::BeginChild("content", ImVec2{available.x, 0.0f}, ImGuiChildFlags_None, ImGuiWindowFlags_NoBackground);
        {
            if (m_tab == "index") {
                tabs::render_index(m_fonts[TORUS_BOLD][FONT_LARGE]);
            } else if (m_tab == "collections") {
                tabs::render_collections(m_fonts[TORUS_BOLD][FONT_LARGE]);
            } else if (m_tab == "discover") {
                tabs::render_discover(m_fonts[TORUS_BOLD][FONT_LARGE]);
            } else if (m_tab == "radio") {
                tabs::render_radio(m_fonts[TORUS_BOLD][FONT_LARGE]);
            } else if (m_tab == "config") {
                tabs::render_config(m_fonts[TORUS_BOLD][FONT_LARGE]);
            } else if (m_tab == "status") {
                tabs::render_status(m_fonts[TORUS_BOLD][FONT_LARGE]);
            }
        }
        ImGui::EndChild();
    }
    ImGui::End();
    ImGui::PopStyleVar(2);

    ImGui::Render();

    glViewport(0, 0, (int)io->DisplaySize.x, (int)io->DisplaySize.y);
    glClearColor(ui_theme::BG_COLOR.x, ui_theme::BG_COLOR.y, ui_theme::BG_COLOR.z, ui_theme::BG_COLOR.w);
    glClear(GL_COLOR_BUFFER_BIT);

    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}
