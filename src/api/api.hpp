#pragma once

#include "../utils/query.hpp"

#include <chrono>
#include <cstdint>
#include <cpr/api.h>
#include <iostream>
#include <nlohmann/json.hpp>
#include <optional>
#include <set>
#include <string>
#include <string_view>
#include <utility>

using JsonResponse = nlohmann::json;
using ApiResponse = std::pair<int, std::optional<nlohmann::json>>;
using TimePoint = std::chrono::system_clock::time_point;

struct OAuthAuthRequest {
    std::string client_id;
    std::string client_secret;
    std::string grant_type = "authorization_code";
    std::optional<std::set<std::string>> scope;
    std::optional<std::string> code; // OAuthAuthType == CODE_GRANT
    std::optional<std::string> state; // OAuthAuthType == CODE_GRANT
    std::optional<std::string> redirect_uri; // OAuthAuthType == CODE_GRANT
    std::string refresh_token; // OAuthAuthType == CODE_GRANT
};

enum class OAuthAuthType : int32_t {
    CODE_GRANT,
    CLIENT_CREDENTIALS_GRANT
};

struct OAuthTokenData {
    std::string token_type;
    std::string access_token;
    std::string refresh_token;
    int32_t expires_in = 0;
};

class OAuthApi {
public:
    OAuthApi(std::string url, OAuthAuthType type);
    ~OAuthApi() = default;

    void authenticate();

    void set_auth_data(const OAuthAuthRequest& data) {
        m_auth_data = data;
    }

    template <typename T>
    std::optional<T> get(std::string_view endpoint, const query::Parameters& params) {
        authenticate();

        cpr::Header header{{"Accept", "application/json"}};
        cpr::Parameters query;

        if (!m_token_data.access_token.empty()) {
            header["Authorization"] = "Bearer " + m_token_data.access_token;
        }

        for (const auto& [key, value] : params) {
            query.Add({key, value});
        }

        const auto url =
            endpoint.starts_with('/') ? m_base_url + std::string(endpoint) : m_base_url + "/" + std::string(endpoint);
        return parse_typed_response<T>(cpr::Get(cpr::Url{url}, header, query));
    };

    template <typename T>
    std::optional<T> post(std::string_view endpoint, const nlohmann::json& body) {
        authenticate();
        cpr::Header header{{"Accept", "application/json"}, {"Content-Type", "application/json"}};

        if (!m_token_data.access_token.empty()) {
            header["Authorization"] = "Bearer " + m_token_data.access_token;
        }

        const auto url =
            endpoint.starts_with('/') ? m_base_url + std::string(endpoint) : m_base_url + "/" + std::string(endpoint);
        return parse_typed_response<T>(cpr::Post(cpr::Url{url}, header, cpr::Body{body.dump()}));
    };

    bool get_or_refresh_access_token(OAuthAuthType type, OAuthAuthRequest& data);

    void set_access_token(std::string_view token, int32_t expiration_seconds) {
        m_token_data.access_token = token;
        m_auth_timestamp = std::chrono::system_clock::now();
        m_expiration_seconds = expiration_seconds;
    }

    std::string get_access_token() const {
        return m_token_data.access_token;
    }

    bool is_access_token_expired() const {
        auto expiration = m_auth_timestamp + std::chrono::seconds(m_expiration_seconds);
        return expiration < std::chrono::system_clock::now();
    }

    bool has_valid_access_token() const {
        return !m_token_data.access_token.empty() && !is_access_token_expired();
    }

protected:
    std::optional<nlohmann::json> parse_response(const cpr::Response& response);

    template <typename T>
    std::optional<T> parse_typed_response(const cpr::Response& response) {
        const auto json = parse_response(response);

        if (!json.has_value()) {
            return std::nullopt;
        }

        try {
            return json->get<T>();
        } catch (const nlohmann::json::type_error& error) {
            std::cerr << "[api] failed to parse response: " << error.what() << "\n";
            return std::nullopt;
        }
    }

    bool store_token(const nlohmann::json& json);

private:
    // last auth details
    TimePoint m_auth_timestamp{};
    int32_t m_expiration_seconds = 0;

    // auth data
    OAuthTokenData m_token_data{};

    // base address
    std::string m_base_url{};

    OAuthAuthType m_auth_type = OAuthAuthType::CODE_GRANT;
    OAuthAuthRequest m_auth_data{};
};

inline static void from_json(const nlohmann::json& j, OAuthTokenData& r) {
    r.access_token = j.value("access_token", "");
    r.expires_in = j.value("expires_in", 0);
    r.token_type = j.value("token_type", "");
    r.refresh_token = j.value("refresh_token", "");
}
