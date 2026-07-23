#pragma once

#include <string>
#include <chrono>
#include <nlohmann/json.hpp>

using time_point = std::chrono::system_clock::time_point;

// not sure if i will ever use this outside osu!
struct AuthExpirationToken {
public:
    void set(std::string_view token, int32_t expiration_seconds) {
        m_token = token;
        m_auth_timestamp = std::chrono::system_clock::now();
        m_expiration_seconds = expiration_seconds;
    }

    [[nodiscard]] std::string get() const {
        return m_token;
    }

    [[nodiscard]] bool is_expired() const {
        auto expiration = m_auth_timestamp + std::chrono::seconds(m_expiration_seconds);
        return expiration < std::chrono::system_clock::now();
    }

private:
    std::string m_token;
    time_point m_auth_timestamp;
    int32_t m_expiration_seconds;
};
