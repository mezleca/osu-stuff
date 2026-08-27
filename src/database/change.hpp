#pragma once

#include <utility>

namespace app {
    class DatabaseChange {
    public:
        template <typename Property, typename Value>
        bool set(Property& property, Value&& value) {
            if (property.detach() == value) {
                return false;
            }

            property = std::forward<Value>(value);
            m_changed = true;
            return true;
        }

        void mark_changed() {
            m_changed = true;
        }

        [[nodiscard]] bool changed() const {
            return m_changed;
        }

    private:
        bool m_changed = false;
    };
} // namespace app
