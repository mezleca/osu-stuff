#include "api.hpp"

#include <format>
#include <nlohmann/json.hpp>
#include <utility>

static bool is_success(const cpr::Response& response) {
    return response.status_code >= 200 && response.status_code < 300;
}

static std::optional<cpr::Response> oauth_code_exchange(const OAuthAuthRequest& data, const std::string& base_url) {
    const auto& id = data.client_id;
    const auto& secret = data.client_secret;
    const auto& code = data.code;

    if (id.empty() || secret.empty() || !code.has_value()) {
        LOG_ERROR("oauth_code_exchange: cannot proceed due to missing data");
        return std::nullopt;
    }

    cpr::Payload parameters = {
        {"client_id", id}, {"client_secret", secret}, {"code", code.value()}, {"grant_type", "authorization_code"}
    };

    if (data.redirect_uri.has_value()) {
        parameters.Add({"redirect_uri", data.redirect_uri.value()});
    }

    const auto url = std::format("{}/oauth/token", base_url);
    return cpr::Post(cpr::Url{url}, cpr::Header{{"Accept", "application/json"}}, parameters);
}

static std::optional<cpr::Response> oauth_refresh_access_token(const OAuthAuthRequest& data, const std::string& base_url) {
    const auto& id = data.client_id;
    const auto& secret = data.client_secret;
    const auto& refresh_token = data.refresh_token;

    if (id.empty() || secret.empty() || refresh_token.empty()) {
        LOG_ERROR("oauth_refresh_access_token: cannot proceed due to missing data");
        return std::nullopt;
    }

    cpr::Payload parameters = {
        {"client_id", id}, {"client_secret", secret}, {"refresh_token", refresh_token}, {"grant_type", "refresh_token"}
    };

    if (data.scope.has_value() && !data.scope->empty()) {
        parameters.Add({"scope", query::string_set_to_string(*data.scope, " ")});
    }

    const auto url = std::format("{}/oauth/token", base_url);
    return cpr::Post(cpr::Url{url}, cpr::Header{{"Accept", "application/json"}}, parameters);
}

static std::optional<cpr::Response> oauth_client_credentials_grant(const OAuthAuthRequest& data, const std::string& base_url) {
    const auto& id = data.client_id;
    const auto& secret = data.client_secret;

    if (id.empty() || secret.empty()) {
        LOG_ERROR("oauth_client_credentials_grant: cannot proceed due to missing data");
        return std::nullopt;
    }

    cpr::Payload parameters = {
        {"client_id", id},
        {"client_secret", secret},
        {"grant_type", "client_credentials"},
        {"scope", query::string_set_to_string(data.scope.value_or(std::set<std::string>{"public"}), " ")}
    };

    const auto url = std::format("{}/oauth/token", base_url);
    return cpr::Post(cpr::Url{url}, cpr::Header{{"Accept", "application/json"}}, parameters);
}

OAuthApi::OAuthApi(std::string url, OAuthAuthType type) : m_base_url(std::move(url)), m_auth_type(type) {}

bool OAuthApi::authenticate() {
    if (has_valid_access_token()) {
        return true;
    }

    return get_or_refresh_access_token(m_auth_type, m_auth_data);
}

std::optional<nlohmann::json> OAuthApi::parse_response(const cpr::Response& response) {
    if (!is_success(response)) {
        LOG_ERROR("[api] request failed: status={} error={}", response.status_code, response.error.message);
        return std::nullopt;
    }

    if (response.text.empty()) {
        return std::nullopt;
    }

    try {
        return nlohmann::json::parse(response.text);
    } catch (const nlohmann::json::parse_error& error) {
        LOG_ERROR("[api] failed to parse response body: {}", error.what());
        return std::nullopt;
    }
}

bool OAuthApi::store_token(const nlohmann::json& json) {
    if (!json.is_object()) {
        LOG_ERROR("[api] failed to store token (payload is not an object)");
        return false;
    }

    OAuthTokenData data{};
    try {
        data = json.get<OAuthTokenData>();
    } catch (const nlohmann::json::exception& error) {
        LOG_ERROR("[api] failed to store token: {}", error.what());
        return false;
    }

    if (data.access_token.empty() || data.expires_in <= 0) {
        LOG_ERROR("[api] failed to store token (invalid data)");
        return false;
    }

    set_access_token(data.access_token, data.expires_in);
    if (!data.refresh_token.empty()) {
        m_token_data.refresh_token = data.refresh_token;
        m_auth_data.refresh_token = data.refresh_token;
    }

    return true;
}

bool OAuthApi::get_or_refresh_access_token(OAuthAuthType type, OAuthAuthRequest& data) {
    cpr::Response response;
    switch (type) {
        case OAuthAuthType::CODE_GRANT: {
            // If a code is available, exchange it for an access and refresh token.
            // otherwise, just update the refresh token
            if (data.code.has_value() && !data.code->empty()) {
                auto result = oauth_code_exchange(data, m_base_url);
                response = result.value_or(cpr::Response{});
            } else {
                auto result = oauth_refresh_access_token(data, m_base_url);
                response = result.value_or(cpr::Response{});
            }

            break;
        }
        case OAuthAuthType::CLIENT_CREDENTIALS_GRANT: {
            auto result = oauth_client_credentials_grant(data, m_base_url);
            response = result.value_or(cpr::Response{});
            break;
        }
    }

    if (!is_success(response)) {
        return false;
    }

    const auto json = parse_response(response);
    if (!json.has_value()) {
        LOG_ERROR("[api] get_or_refresh_access_token received invalid JSON");
        return false;
    }

    // clear code so next time we authenticate, we just refresh the token
    if (type == OAuthAuthType::CODE_GRANT && data.code.has_value() && !data.code->empty()) {
        data.code->clear();
    }

    return store_token(*json);
}
