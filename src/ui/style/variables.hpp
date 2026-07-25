#pragma once

#include "../widgets/base/values.hpp"

#include <functional>
#include <string>
#include <string_view>
#include <type_traits>
#include <unordered_map>
#include <utility>

struct StyleVariableHash {
    using is_transparent = void;

    [[nodiscard]] size_t operator()(std::string_view value) const {
        return std::hash<std::string_view>{}(value);
    }

    [[nodiscard]] size_t operator()(const std::string& value) const {
        return operator()(std::string_view{value});
    }
};

class StyleVariableStore {
public:
    void set(std::string_view key, GenericValue value) {
        auto existing_it = m_vars.find(key);

        if (existing_it != m_vars.end()) {
            existing_it->second = std::move(value);
            return;
        }

        m_vars.emplace(key, std::move(value));
    }

    template <typename T>
    void set(std::string_view key, T value) {
        set(key, GenericValue{std::move(value)});
    }

    template <typename T>
    [[nodiscard]] T* get(std::string_view key) {
        auto value_it = m_vars.find(key);
        return value_it == m_vars.end() ? nullptr : std::get_if<T>(&value_it->second);
    }

    template <typename T>
    [[nodiscard]] const T* get(std::string_view key) const {
        auto value_it = m_vars.find(key);
        return value_it == m_vars.end() ? nullptr : std::get_if<T>(&value_it->second);
    }

    [[nodiscard]] GenericValue* find(std::string_view key) {
        auto value_it = m_vars.find(key);
        return value_it == m_vars.end() ? nullptr : &value_it->second;
    }

    [[nodiscard]] const GenericValue* find(std::string_view key) const {
        auto value_it = m_vars.find(key);
        return value_it == m_vars.end() ? nullptr : &value_it->second;
    }

    template <typename Func>
    bool for_each(Func&& func) {
        static_assert(
            std::is_invocable_r_v<bool, Func&, const std::string&, GenericValue&>,
            "StyleVariableStore::for_each callback must return bool"
        );

        for (auto& [key, value] : m_vars) {
            if (!std::invoke(func, key, value)) {
                return false;
            }
        }

        return true;
    }

    template <typename Func>
    bool for_each(Func&& func) const {
        static_assert(
            std::is_invocable_r_v<bool, Func&, const std::string&, const GenericValue&>,
            "StyleVariableStore::for_each callback must return bool"
        );

        for (const auto& [key, value] : m_vars) {
            if (!std::invoke(func, key, value)) {
                return false;
            }
        }

        return true;
    }

private:
    std::unordered_map<std::string, GenericValue, StyleVariableHash, std::equal_to<>> m_vars;
};
