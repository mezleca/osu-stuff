#include "detail.hpp"
#include "../../utils/query.hpp"

#include <cpr/api.h>
#include <iostream>

static const auto AUTH_URL = cpr::Url{"https://osu.ppy.sh/oauth/token"};

bool osu_v2::authenticate(OsuClientCredentialsRequest req) {
    auto header = cpr::Header{{"Accept", "application/json"}};

    auto auth_parameters = cpr::Payload{
        {"client_id", std::to_string(req.client_id)},
        {"client_secret", req.client_secret},
        {"grant_type", req.grant_type},
        {"scope", query::string_set_to_string(req.scope, " ")}
    };

    auto response = cpr::Post(AUTH_URL, header, auth_parameters);

    if (response.status_code != 200) {
        std::cout << "[OsuAPI] error: failed with code " << response.status_code << "\n";
        return false;
    }

    auto json = nlohmann::json::parse(response.text);
    OsuClientCredentialsResponse data = json.get<OsuClientCredentialsResponse>();

    if (data.access_token.empty() || data.expires_in == INT32_MAX) {
        std::cout << "[OsuAPI] error: successful request but received invalid token" << "\n";
        return false;
    }

    m_token.set(data.access_token, data.expires_in);
    return true;
}
