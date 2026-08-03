#include "detail.hpp"

#include <string>

OsuV2API::OsuV2API() : OAuthApi("https://osu.ppy.sh", OAuthAuthType::CLIENT_CREDENTIALS_GRANT) {
}

std::optional<OsuGetBeatmapsResponse> OsuV2API::get_beatmaps(const OsuGetBeatmapsRequest& request) {
    query::Parameters parameters;
    for (const auto id : request.ids) {
        query::add_parameter(parameters, "ids[]", id);
    }

    return get<OsuGetBeatmapsResponse>("/api/v2/beatmaps", parameters);
}

std::optional<OsuGetBeatmapResponse> OsuV2API::get_beatmap(const OsuGetBeatmapRequest& request) {
    return get<OsuGetBeatmapResponse>("/api/v2/beatmaps/" + std::to_string(request.beatmap), {});
}

std::optional<OsuGetBeatmapPacksResponse> OsuV2API::get_beatmap_packs(const OsuGetBeatmapPacksRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "type", request.type);
    query::add_parameter(parameters, "cursor_string", request.cursor_string);
    return get<OsuGetBeatmapPacksResponse>("/api/v2/beatmaps/packs", parameters);
}

std::optional<OsuGetBeatmapPackResponse> OsuV2API::get_beatmap_pack(const OsuGetBeatmapPackRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "legacy_only", request.legacy_only);
    return get<OsuGetBeatmapPackResponse>("/api/v2/beatmaps/packs/" + request.pack, parameters);
}

std::optional<OsuBeatmapLookupResponse> OsuV2API::lookup_beatmap(const OsuBeatmapLookupRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "checksum", request.checksum);
    query::add_parameter(parameters, "filename", request.filename);
    query::add_parameter(parameters, "id", request.id);
    return get<OsuBeatmapLookupResponse>("/api/v2/beatmaps/lookup", parameters);
}

std::optional<OsuGetUserBeatmapScoreResponse>
OsuV2API::get_user_beatmap_score(const OsuGetUserBeatmapScoreRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "legacy_only", request.legacy_only);
    query::add_parameter(parameters, "mode", request.mode);
    query::add_parameter(parameters, "mods", request.mods);
    return get<OsuGetUserBeatmapScoreResponse>(
        "/api/v2/beatmaps/" + std::to_string(request.beatmap) + "/scores/users/" + std::to_string(request.user),
        parameters
    );
}

std::optional<OsuGetUserBeatmapScoresResponse>
OsuV2API::get_user_beatmap_scores(const OsuGetUserBeatmapScoresRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "legacy_only", request.legacy_only);
    query::add_parameter(parameters, "mode", request.mode);
    query::add_parameter(parameters, "ruleset", request.ruleset);
    return get<OsuGetUserBeatmapScoresResponse>(
        "/api/v2/beatmaps/" + std::to_string(request.beatmap) + "/scores/users/" + std::to_string(request.user),
        parameters
    );
}

std::optional<OsuGetBeatmapScoresResponse> OsuV2API::get_beatmap_scores(const OsuGetBeatmapScoresRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "legacy_only", request.legacy_only);
    query::add_parameter(parameters, "mode", request.mode);
    query::add_parameter(parameters, "mods", request.mods);
    query::add_parameter(parameters, "type", request.type);
    return get<OsuGetBeatmapScoresResponse>(
        "/api/v2/beatmaps/" + std::to_string(request.beatmap) + "/scores", parameters
    );
}

std::optional<OsuGetBeatmapAttributesResponse>
OsuV2API::get_beatmap_attributes(const OsuGetBeatmapAttributesRequest& request) {
    nlohmann::json body = nlohmann::json::object();
    if (request.mods) body["mods"] = *request.mods;
    if (request.ruleset) body["ruleset"] = *request.ruleset;
    if (request.ruleset_id) body["ruleset_id"] = *request.ruleset_id;
    return post<OsuGetBeatmapAttributesResponse>(
        "/api/v2/beatmaps/" + std::to_string(request.beatmap) + "/attributes", body
    );
}

std::optional<OsuGetBeatmapsetDiscussionPostsResponse>
OsuV2API::get_beatmapset_discussion_posts(const OsuGetBeatmapsetDiscussionPostsRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "beatmapset_discussion_id", request.beatmapset_discussion_id);
    query::add_parameter(parameters, "limit", request.limit);
    query::add_parameter(parameters, "page", request.page);
    query::add_parameter(parameters, "sort", request.sort);
    query::add_parameter(parameters, "types[]", request.types);
    query::add_parameter(parameters, "user", request.user);
    query::add_parameter(parameters, "with_deleted", request.with_deleted);
    return get<OsuGetBeatmapsetDiscussionPostsResponse>("/api/v2/beatmapsets/discussions/posts", parameters);
}

std::optional<OsuGetBeatmapsetDiscussionVotesResponse>
OsuV2API::get_beatmapset_discussion_votes(const OsuGetBeatmapsetDiscussionVotesRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "beatmapset_discussion_id", request.beatmapset_discussion_id);
    query::add_parameter(parameters, "limit", request.limit);
    query::add_parameter(parameters, "page", request.page);
    query::add_parameter(parameters, "receiver", request.receiver);
    query::add_parameter(parameters, "score", request.score);
    query::add_parameter(parameters, "sort", request.sort);
    query::add_parameter(parameters, "user", request.user);
    query::add_parameter(parameters, "with_deleted", request.with_deleted);
    return get<OsuGetBeatmapsetDiscussionVotesResponse>("/api/v2/beatmapsets/discussions/votes", parameters);
}

std::optional<OsuGetBeatmapsetDiscussionsResponse>
OsuV2API::get_beatmapset_discussions(const OsuGetBeatmapsetDiscussionsRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "beatmap_id", request.beatmap_id);
    query::add_parameter(parameters, "beatmapset_id", request.beatmapset_id);
    query::add_parameter(parameters, "beatmapset_status", request.beatmapset_status);
    query::add_parameter(parameters, "limit", request.limit);
    query::add_parameter(parameters, "message_types[]", request.message_types);
    query::add_parameter(parameters, "only_unresolved", request.only_unresolved);
    query::add_parameter(parameters, "page", request.page);
    query::add_parameter(parameters, "sort", request.sort);
    query::add_parameter(parameters, "user", request.user);
    query::add_parameter(parameters, "with_deleted", request.with_deleted);
    query::add_parameter(parameters, "cursor_string", request.cursor_string);
    return get<OsuGetBeatmapsetDiscussionsResponse>("/api/v2/beatmapsets/discussions", parameters);
}

std::optional<OsuSearchBeatmapsetResponse> OsuV2API::search_beatmapsets(const OsuSearchBeatmapsetRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "q", request.query);
    query::add_parameter(parameters, "sort", request.sort);
    query::add_parameter(parameters, "general[]", request.general);
    query::add_parameter(parameters, "mode", request.mode);
    query::add_parameter(parameters, "s", request.section);
    query::add_parameter(parameters, "genre", request.genre);
    query::add_parameter(parameters, "language", request.language);
    query::add_parameter(parameters, "nsfw", request.nsfw);
    query::add_parameter(parameters, "c[]", request.include);
    query::add_parameter(parameters, "r[]", request.rank);
    query::add_parameter(parameters, "cursor_string", request.cursor_string);
    return get<OsuSearchBeatmapsetResponse>("/api/v2/beatmapsets/search", parameters);
}

std::optional<OsuBeatmapsetLookupResponse> OsuV2API::lookup_beatmapset(const OsuBeatmapsetLookupRequest& request) {
    return get<OsuBeatmapsetLookupResponse>(
        "/api/v2/beatmapsets/lookup", {{"beatmap_id", std::to_string(request.beatmap_id)}}
    );
}

std::optional<OsuGetBeatmapsetResponse> OsuV2API::get_beatmapset(const OsuGetBeatmapsetRequest& request) {
    return get<OsuGetBeatmapsetResponse>("/api/v2/beatmapsets/" + request.beatmapset, {});
}

std::optional<OsuGetEventsResponse> OsuV2API::get_events(const OsuGetEventsRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "sort", request.sort);
    query::add_parameter(parameters, "cursor_string", request.cursor_string);
    return get<OsuGetEventsResponse>("/api/v2/events", parameters);
}

std::optional<OsuGetTopicListingResponse> OsuV2API::get_topic_listing(const OsuGetTopicListingRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "sort", request.sort);
    query::add_parameter(parameters, "forum_id", request.forum_id);
    query::add_parameter(parameters, "limit", request.limit);
    query::add_parameter(parameters, "cursor_string", request.cursor_string);
    return get<OsuGetTopicListingResponse>("/api/v2/forums/topics", parameters);
}

std::optional<OsuGetTopicAndPostsResponse> OsuV2API::get_topic_and_posts(const OsuGetTopicAndPostsRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "sort", request.sort);
    query::add_parameter(parameters, "limit", request.limit);
    query::add_parameter(parameters, "start", request.start);
    query::add_parameter(parameters, "end", request.end);
    query::add_parameter(parameters, "cursor_string", request.cursor_string);
    return get<OsuGetTopicAndPostsResponse>("/api/v2/forums/topics/" + std::to_string(request.topic), parameters);
}

std::optional<OsuGetForumListingResponse> OsuV2API::get_forum_listing(const OsuGetForumListingRequest&) {
    return get<OsuGetForumListingResponse>("/api/v2/forums", {});
}

std::optional<OsuGetForumAndTopicsResponse> OsuV2API::get_forum_and_topics(const OsuGetForumAndTopicsRequest& request) {
    return get<OsuGetForumAndTopicsResponse>("/api/v2/forums/" + std::to_string(request.forum), {});
}

std::optional<OsuSearchResponse> OsuV2API::search(const OsuSearchRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "mode", request.mode);
    query::add_parameter(parameters, "query", request.query);
    query::add_parameter(parameters, "page", request.page);
    return get<OsuSearchResponse>("/api/v2/search", parameters);
}

std::optional<OsuGetMatchesListingResponse> OsuV2API::get_matches_listing(const OsuGetMatchesListingRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "limit", request.limit);
    query::add_parameter(parameters, "sort", request.sort);
    query::add_parameter(parameters, "active", request.active);
    query::add_parameter(parameters, "cursor_string", request.cursor_string);
    return get<OsuGetMatchesListingResponse>("/api/v2/matches", parameters);
}

std::optional<OsuGetMatchResponse> OsuV2API::get_match(const OsuGetMatchRequest& request) {
    query::Parameters parameters;
    query::add_parameter(parameters, "limit", request.limit);
    query::add_parameter(parameters, "before", request.before);
    query::add_parameter(parameters, "after", request.after);
    return get<OsuGetMatchResponse>("/api/v2/matches/" + std::to_string(request.match), parameters);
}
