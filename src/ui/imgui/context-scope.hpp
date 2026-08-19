#pragma once

#include <imgui.h>

namespace ui {
    // makes a given imgui context current for the lifetime of the scope, then restores
    // whatever context was current before
    class ImGuiContextScope {
    public:
        explicit ImGuiContextScope(ImGuiContext* context) : m_previous(ImGui::GetCurrentContext()) {
            ImGui::SetCurrentContext(context);
        }

        ImGuiContextScope(const ImGuiContextScope&) = delete;
        ImGuiContextScope& operator=(const ImGuiContextScope&) = delete;

        ~ImGuiContextScope() {
            ImGui::SetCurrentContext(m_previous);
        }

    private:
        ImGuiContext* m_previous;
    };

} // namespace ui
