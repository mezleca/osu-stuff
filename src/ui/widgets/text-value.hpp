#pragma once

#include <format>
#include <imgui.h>
#include <string>
#include <tuple>
#include <utility>

namespace ui {
    class TextValue {
    public:
        explicit TextValue(std::string text = {}, ImFont* font = nullptr) : m_text(std::move(text)), m_font(font) {}
        virtual ~TextValue() = default;

        const char* c_str() const {
            return m_text.c_str();
        }

        const std::string& str() const {
            return m_text;
        }

        void set_font(ImFont* font) {
            if (font == m_font) {
                return;
            }

            m_font = font;
            m_size_dirty = true;
        }

        void set_wrap(float wrap_end) {
            if (m_wrap_end == wrap_end) {
                return;
            }

            m_wrap_end = wrap_end;
            m_size_dirty = true;
        }

        ImVec2 text_size() {
            if (m_size_dirty) {
                recompute_size();
            }

            return m_text_size;
        }

        ImFont* font() const {
            return m_font;
        }

        void set(std::string text) {
            if (text == m_text) {
                return;
            }

            m_text = std::move(text);
            m_size_dirty = true;
        }

    private:
        void recompute_size() {
            auto* font = m_font != nullptr ? m_font : ImGui::GetFont();
            ImGui::PushFont(font);

            m_text_size = ImGui::CalcTextSize(m_text.c_str(), nullptr, false, m_wrap_end);

            ImGui::PopFont();
            m_size_dirty = false;
        }

        std::string m_text;
        ImFont* m_font = nullptr;
        ImVec2 m_text_size;
        float m_wrap_end = -1.0f;
        bool m_size_dirty = true;
    };

    template <typename... Args>
    class TextFormatted : public TextValue {
    public:
        explicit TextFormatted(std::string fmt, ImFont* font = nullptr)
            : TextValue(std::string{}, font), m_fmt(std::move(fmt)) {}

        void set(std::tuple<Args...> new_values) {
            if (new_values == m_values) {
                return;
            }

            m_values = std::move(new_values);
            recompute_text();
        }

    private:
        void recompute_text() {
            TextValue::set(
                std::apply(
                    [this](auto const&... vals) { return std::vformat(m_fmt, std::make_format_args(vals...)); },
                    m_values
                )
            );
        }

        std::string m_fmt;
        std::tuple<Args...> m_values = {};
    };

} // namespace ui
