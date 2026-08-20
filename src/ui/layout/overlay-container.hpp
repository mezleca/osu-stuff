#pragma once

#include "../tree/node.hpp"

namespace ui {
    enum class OverlayPosition {
        LEFT,
        RIGHT,
    };

    /// does not take imgui focus; input behavior is controlled by InputLayer.
    class OverlayNode : public Node {
    public:
        explicit OverlayNode(std::string id) : Node(std::move(id)) {}

    protected:
        bool on_draw() override {
            const ImGuiViewport* viewport = ImGui::GetMainViewport();

            ImGui::SetNextWindowPos(viewport->WorkPos);
            ImGui::SetNextWindowSize(viewport->WorkSize);
            ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {0.0F, 0.0F});

            ImGui::Begin(
                id().c_str(), nullptr,
                ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoMove |
                    ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse | ImGuiWindowFlags_NoCollapse |
                    ImGuiWindowFlags_NoSavedSettings | ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoNav |
                    ImGuiWindowFlags_NoFocusOnAppearing
            );

            return true;
        }

        void on_draw_end() override {
            ImGui::End();
            ImGui::PopStyleVar();
        }
    };
} // namespace ui
