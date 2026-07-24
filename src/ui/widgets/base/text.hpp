#pragma once

#include <format>
#include <imgui.h>
#include <string>
#include <tuple>
#include <type_traits>
#include <utility>

class UICachedTextBase {
public:
    const char* c_str() const {
        return m_text.c_str();
    }

    const std::string& str() const {
        return m_text;
    }

    void set_font(ImFont* font) {
        if (font == nullptr || font == m_font) {
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

    ImVec2 text_size(ImFont* font) {
        if (font != nullptr && font != m_font) {
            m_font = font;
            m_size_dirty = true;
        }

        if (m_size_dirty) {
            recompute_size();
        }

        return m_text_size;
    }

    ImVec2 text_size() {
        return text_size(ImGui::GetFont());
    }

protected:
    void set_text(std::string text) {
        m_text = std::move(text);
        m_size_dirty = true;
    }

private:
    void recompute_size() {
        auto* font = m_font != nullptr ? m_font : ImGui::GetFont();
        ImGui::PushFont(font);

        m_text_size = ImGui::CalcTextSize(m_text.c_str(), NULL, false, m_wrap_end);

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
class UITextFormatted : public UICachedTextBase {
public:
    explicit UITextFormatted(std::string fmt) : m_fmt(std::move(fmt)) {
        recompute_text();
    }

    void set(std::tuple<Args...> new_values) {
        if (new_values == m_values) {
            return;
        }

        m_values = std::move(new_values);
        recompute_text();
    }

private:
    void recompute_text() {
        set_text(
            std::apply(
                [this](auto const&... vals) { return std::vformat(m_fmt, std::make_format_args(vals...)); }, m_values
            )
        );
    }

    std::string m_fmt;
    std::tuple<Args...> m_values = {};
};

template <typename T>
class UIText : public UICachedTextBase {
public:
    explicit UIText(T value) : m_value(std::move(value)) {
        recompute_text();
    }

    void set(T value) {
        if (value == m_value) {
            return;
        }

        m_value = std::move(value);
        recompute_text();
    }

private:
    void recompute_text() {
        if constexpr (std::is_same_v<T, std::string>) {
            set_text(m_value);
        } else {
            set_text(std::format("{}", m_value));
        }
    }

    T m_value;
};
