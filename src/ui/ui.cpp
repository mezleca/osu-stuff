#include "ui.hpp"
#include "imgui.h"

#include <SDL3/SDL_opengl.h>
#include <imgui_impl_opengl3.h>
#include <imgui_impl_sdl3.h>
#include <string>

UI::UI(SDL_GLContext* ctx, SDL_Window* window) {
    float main_scale = SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay());

    ImGui::CreateContext();
    io = &ImGui::GetIO();

    io->IniFilename = NULL;
    io->LogFilename = NULL;

    ImGui::StyleColorsDark();

    // setup scaling
    ImGuiStyle& style = ImGui::GetStyle();
    style.ScaleAllSizes(main_scale);
    style.FontScaleDpi = main_scale;

    ImGui_ImplSDL3_InitForOpenGL(window, ctx);
    ImGui_ImplOpenGL3_Init("#version 300 es");
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

    ImGui::Begin("##osu-stuff", NULL, flags);
    {
        ImGui::Text("%s", std::to_string(ImGui::GetTime()).c_str());
    }
    ImGui::End();
    ImGui::PopStyleVar(2);

    ImGui::Render();

    glViewport(0, 0, (int)io->DisplaySize.x, (int)io->DisplaySize.y);
    glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
    glClear(GL_COLOR_BUFFER_BIT);

    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}
