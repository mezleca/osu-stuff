#include "osu-web.hpp"

#include <iostream>

static const auto AUTH_URL = cpr::Url{"https://osu.ppy.sh/oauth/token"};

std::string string_set_to_string(const std::set<std::string>& set, std::string_view del) {
    std::string result;
    size_t total_bytes = 0;

    for (const auto& value : set) {
        total_bytes += value.size();
    }

    total_bytes += del.size() * (set.size() - 1);
    result.reserve(total_bytes);

    for (const auto& value : set) {
        result += value;
    }

    return result;
}

bool OsuAPI::authenticate(OsuAuthRequest req) {
    auto header = cpr::Header{{"Accept", "application/json"}};

    auto auth_parameters = cpr::Payload{{"client_id", req.client_id},
                                        {"client_secret", req.client_secret},
                                        {"grant_type", req.grant_type},
                                        {"scope", string_set_to_string(req.scope, " ")}};

    auto response = cpr::Post(AUTH_URL, header, auth_parameters);

    if (response.status_code != 200) {
        std::cout << "[OsuAPI] error: failed with code " << response.status_code << "\n";
        return false;
    }

    auto json = nlohmann::json::parse(response.text);
    auto data = json.get<OsuAuthResponse>();

    if (data.access_token.empty() || data.expires_in == INT32_MAX) {
        std::cout << "[OsuAPI] error: successful request but received invalid token" << "\n";
        return false;
    }

    m_auth_data = data;
    return true;
}