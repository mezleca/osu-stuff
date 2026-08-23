#pragma once

#include <imgui.h>

namespace ui_test {
    class ImGuiContext {
    public:
        explicit ImGuiContext(ImVec2 display_size) : m_previous(ImGui::GetCurrentContext()) {
            m_context = ImGui::CreateContext();
            ImGui::SetCurrentContext(m_context);
            ImGui::GetIO().DisplaySize = display_size;
            ImGui::GetIO().DeltaTime = 1.0F / 60.0F;
            build_fonts();
        }

        ImGuiContext(const ImGuiContext&) = delete;
        ImGuiContext& operator=(const ImGuiContext&) = delete;

        ~ImGuiContext() {
            ImGui::DestroyContext(m_context);
            ImGui::SetCurrentContext(m_previous);
        }

        void build_fonts() {
            unsigned char* pixels = nullptr;
            int width = 0;
            int height = 0;
            int bytes_per_pixel = 0;
            ImGui::GetIO().Fonts->GetTexDataAsRGBA32(&pixels, &width, &height, &bytes_per_pixel);
        }

    private:
        ::ImGuiContext* m_previous = nullptr;
        ::ImGuiContext* m_context = nullptr;
    };
} // namespace ui_test
