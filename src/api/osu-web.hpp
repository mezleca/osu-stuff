#pragma once

#include <cpr/api.h>
#include <nlohmann/json.hpp>
#include <set>
#include <string>
#include <optional>

struct OsuAuthResponse {
    std::string token_type;
    std::string access_token;
    int32_t expires_in;
};

struct OsuAuthRequest {
    std::string client_id;     // The client ID of your application.
    std::string client_secret; // The client secret of your application.
    std::string grant_type;    // This must always be authorization_code
    std::set<std::string>
        scope; // A space-delimited string of scopes. Only public and scopes that allow delegation are supported.
};

struct OsuAPI {
public:
    explicit OsuAPI(OsuAuthResponse auth) : m_auth_data(auth) {
    }

    bool authenticate(OsuAuthRequest req);

    [[nodiscard]] std::string get_token() const {
        return m_auth_data.access_token;
    }

private:
    OsuAuthResponse m_auth_data;
};

inline static void from_json(const nlohmann::json& j, OsuAuthResponse& r) {
    r.access_token = j.value("access_token", "");
    r.expires_in = j.value("expires_in", INT32_MAX);
    r.token_type = j.value("token_type", "");
}
