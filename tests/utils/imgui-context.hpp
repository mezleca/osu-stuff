#pragma once

#include <ui/backends/backend.hpp>

#include <imgui.h>

#include <cstdint>
#include <memory>

namespace ui_test {
    class TestBackend final : public ui::Backend {
    public:
        bool initialize() override {
            return true;
        }

        bool initialize_imgui() override {
            return true;
        }

        void shutdown_imgui() override {}
        void begin_frame(ImVec4) override {}
        void set_mouse_cursor(ImGuiMouseCursor) override {}
        void render(ImDrawData*) override {}

        float content_scale() const override {
            return 1.0F;
        }

        uint64_t window_id() const override {
            return 1;
        }

        ImVec2 display_size() const override {
            return config().size;
        }
    };

    inline std::unique_ptr<ui::Backend> make_backend() {
        return std::make_unique<TestBackend>();
    }

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

        static void build_fonts() {
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
