#include "detail.hpp"

#include <string>

static void add_pagination_parameters(query::Parameters& parameters, const OsuCollectorRecentRequest& request) {
    query::add_parameter(parameters, "cursor", request.cursor);
    query::add_parameter(parameters, "perPage", request.per_page);
}

OsuCollectorAPI::OsuCollectorAPI() : OAuthApi("https://osucollector.com/api", OAuthAuthType::CLIENT_CREDENTIALS_GRANT) {}

std::optional<OsuCollectorCollectionsPage> OsuCollectorAPI::get_recent_collections(const OsuCollectorRecentRequest& request) {
    query::Parameters parameters;
    add_pagination_parameters(parameters, request);
    return get<OsuCollectorCollectionsPage>("/collections/recent", parameters, false);
}

std::optional<OsuCollectorCollectionsPage>
OsuCollectorAPI::get_popular_collections(const OsuCollectorPopularCollectionsRequest& request) {
    query::Parameters parameters;
    add_pagination_parameters(parameters, request);
    query::add_parameter(parameters, "range", request.range);
    return get<OsuCollectorCollectionsPage>("/collections/popularv2", parameters, false);
}

std::optional<OsuCollectorCollectionsPage> OsuCollectorAPI::search_collections(const OsuCollectorSearchRequest& request) {
    query::Parameters parameters;
    add_pagination_parameters(parameters, request);
    query::add_parameter(parameters, "search", request.search);
    query::add_parameter(parameters, "sortBy", request.sort_by);
    query::add_parameter(parameters, "orderBy", request.order_by);
    return get<OsuCollectorCollectionsPage>("/collections/search", parameters, false);
}

std::optional<OsuCollectorCollection> OsuCollectorAPI::get_collection(const OsuCollectorCollectionRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "withBeatmapsets", request.with_beatmapsets);
    return get<OsuCollectorCollection>("/collections/" + std::to_string(request.id), parameters, false);
}

std::optional<OsuCollectorCollectionBeatmapsResponse>
OsuCollectorAPI::get_collection_beatmaps(const OsuCollectorCollectionBeatmapsRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "perPage", request.per_page);
    return get<OsuCollectorCollectionBeatmapsResponse>(
        "/collections/" + std::to_string(request.id) + "/beatmapsv3", parameters, false
    );
}

std::optional<OsuCollectorTournamentsPage> OsuCollectorAPI::get_recent_tournaments(const OsuCollectorRecentRequest& request) {
    query::Parameters parameters;
    add_pagination_parameters(parameters, request);
    return get<OsuCollectorTournamentsPage>("/tournaments/recent", parameters, false);
}

std::optional<OsuCollectorTournamentsPage> OsuCollectorAPI::search_tournaments(const OsuCollectorSearchRequest& request) {
    query::Parameters parameters;
    add_pagination_parameters(parameters, request);
    query::add_parameter(parameters, "search", request.search);
    query::add_parameter(parameters, "sortBy", request.sort_by);
    query::add_parameter(parameters, "orderBy", request.order_by);
    return get<OsuCollectorTournamentsPage>("/tournaments/search", parameters, false);
}

std::optional<OsuCollectorTournament> OsuCollectorAPI::get_tournament(const OsuCollectorTournamentRequest& request) {
    return get<OsuCollectorTournament>("/tournaments/" + std::to_string(request.id), {}, false);
}
