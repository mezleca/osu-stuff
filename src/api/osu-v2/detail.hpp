#pragma once

#include "../api.hpp"

#include <cstdint>
#include <nlohmann/json.hpp>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <vector>

struct Beatmap;
struct BeatmapExtended;
struct BeatmapPack;
struct BeatmapUserScore;
struct BeatmapScores;
struct BeatmapDifficultyAttributes;
struct Beatmapset;
struct BeatmapsetDiscussion;
struct BeatmapsetDiscussionPost;
struct BeatmapsetDiscussionVote;
struct Build;
struct UpdateStream;
struct CommentBundle;
struct Event;
struct Forum;
struct ForumTopic;
struct ForumPost;
struct User;
struct WikiPage;
struct Match;
struct MatchEvent;
struct Score;
struct Mod;
struct Cursor;

using Ruleset = std::string; // osu, taiko, fruits, mania

// AUTH

struct OsuAuthorizeRequest {
    int32_t client_id;                       // The Client ID you received when you registered.
    std::optional<std::string> redirect_uri; // Must match the registered Application Callback URL exactly.
    std::string response_type = "code";      // This should always be "code" when requesting authorization.
    std::optional<std::string> scope;        // A space-delimited string of scopes.
    std::optional<std::string> state;        // Returned when a temporary code is issued. Useful against CSRF.
};

struct OsuAuthRequest {
    std::string client_id;                         // The client ID of your application.
    std::string client_secret;                     // The client secret of your application.
    std::string code;                              // The code you received from the authorization redirect.
    std::string grant_type = "authorization_code"; // This must always be authorization_code.
    std::optional<std::string> redirect_uri;       // Must be the same as the one used on the authorization request.
};

struct OsuAuthResponse {
    std::string token_type;    // The type of token, this should always be Bearer.
    int32_t expires_in;        // The number of seconds the token will be valid for.
    std::string access_token;  // The access token.
    std::string refresh_token; // The refresh token.
};

struct OsuClientCredentialsRequest {
    int32_t client_id;                             // The Client ID you received when you registered.
    std::string client_secret;                     // The client secret of your application.
    std::string grant_type = "client_credentials"; // This must always be client_credentials.
    std::set<std::string> scope;                   // Only public and scopes that allow delegation are supported.
};

struct OsuClientCredentialsResponse {
    std::string token_type;   // The type of token, this should always be Bearer.
    int32_t expires_in;       // The number of seconds the token will be valid for.
    std::string access_token; // The access token. No refresh_token for this grant.
};

// ACCOUNT

struct OsuGetOwnBeatmapsetFavouritesRequest {};

// BEATMAP_PACKS

struct OsuGetBeatmapPacksRequest {
    std::string type = "standard";            // BeatmapPackType of the beatmap packs to be returned.
    std::optional<std::string> cursor_string; // Cursor for pagination.
};

struct OsuGetBeatmapPacksResponse {
    std::vector<BeatmapPack> beatmap_packs;
};

struct OsuGetBeatmapPackRequest {
    std::string pack;        // The tag of the beatmap pack to be returned.
    int32_t legacy_only = 0; // Whether or not to consider lazer scores for user completion data.
};

using OsuGetBeatmapPackResponse = BeatmapPack; // always includes beatmapsets and user_completion_data

// BEATMAPS

struct OsuBeatmapLookupRequest {
    std::optional<std::string> checksum; // A beatmap checksum.
    std::optional<std::string> filename; // A filename to lookup.
    std::optional<std::string> id;       // A beatmap ID to lookup.
};

using OsuBeatmapLookupResponse = BeatmapExtended;

struct OsuGetUserBeatmapScoreRequest {
    int32_t beatmap;                 // Id of the Beatmap.
    int32_t user;                    // Id of the User.
    int32_t legacy_only = 0;         // Whether or not to exclude lazer scores.
    std::optional<std::string> mode; // The Ruleset to get scores for.
    std::optional<std::string> mods; // An array of matching Mods, or none.
};

using OsuGetUserBeatmapScoreResponse = BeatmapUserScore; // position depends on requested mode and mods

struct OsuGetUserBeatmapScoresRequest {
    int32_t beatmap;                    // Id of the Beatmap.
    int32_t user;                       // Id of the User.
    int32_t legacy_only = 0;            // Whether or not to exclude lazer scores.
    std::optional<std::string> mode;    // (deprecated) Ruleset to get scores for. Defaults to beatmap ruleset.
    std::optional<std::string> ruleset; // Ruleset to get scores for. Defaults to beatmap ruleset.
};

struct OsuGetUserBeatmapScoresResponse {
    std::vector<Score> scores;
};

struct OsuGetBeatmapScoresRequest {
    int32_t beatmap;                  // Id of the Beatmap.
    int32_t legacy_only = 0;          // Whether or not to exclude lazer scores.
    std::optional<std::string> mode;  // The Ruleset to get scores for.
    std::optional<std::string> mods;  // An array of matching Mods, or none.
    std::optional<std::string> type;  // Beatmap score ranking type.
};

using OsuGetBeatmapScoresResponse = BeatmapScores; // Score.user includes country and cover

struct OsuGetBeatmapsRequest {
    std::vector<int32_t> ids; // Beatmap IDs to be returned. Up to 50 beatmaps can be requested at once.
};

struct OsuGetBeatmapsResponse {
    std::vector<BeatmapExtended> beatmaps; // Includes beatmapset (with ratings), failtimes, max_combo, owners.
};

struct OsuGetBeatmapRequest {
    int32_t beatmap; // The ID of the beatmap.
};

using OsuGetBeatmapResponse = BeatmapExtended; // includes beatmapset (with ratings), failtimes, max_combo

struct OsuGetBeatmapAttributesRequest {
    int32_t beatmap;                   // Beatmap id.
    std::optional<std::string>
        mods;   // Mod combination: bitset, array of acronyms, or array of Mods. Defaults to no mods.
    std::optional<Ruleset> ruleset;    // Ruleset of the difficulty attributes. Defaults to the beatmap's ruleset.
    std::optional<int32_t> ruleset_id; // Same as ruleset but in integer form.
};

struct OsuGetBeatmapAttributesResponse {
    std::shared_ptr<BeatmapDifficultyAttributes> attributes;
};

// BEATMAPSET DISCUSSIONS

struct OsuGetBeatmapsetDiscussionPostsRequest {
    std::optional<std::string> beatmapset_discussion_id; // Id of the BeatmapsetDiscussion.
    std::optional<int32_t> limit;                        // Maximum number of results.
    std::optional<int32_t> page;                         // Search result page.
    std::string sort = "id_desc";                        // id_desc for newest first; id_asc for oldest first.
    std::vector<std::string> types;                       // first, reply, system. Defaults to reply.
    std::optional<std::string> user;                      // The id of the User.
    std::optional<std::string> with_deleted;              // No effect currently.
};

struct OsuGetBeatmapsetDiscussionPostsResponse {
    std::shared_ptr<Beatmapset> beatmapsets;
    std::optional<std::string> cursor_string;
    std::vector<BeatmapsetDiscussionPost> posts;
    std::vector<User> users;
};

struct OsuGetBeatmapsetDiscussionVotesRequest {
    std::optional<std::string> beatmapset_discussion_id; // Id of the BeatmapsetDiscussion.
    std::optional<int32_t> limit;            // Maximum number of results.
    std::optional<int32_t> page;             // Search result page.
    std::optional<std::string> receiver;     // The id of the User receiving the votes.
    std::optional<std::string> score;        // 1 for up vote, -1 for down vote.
    std::string sort = "id_desc";            // id_desc for newest first; id_asc for oldest first.
    std::optional<std::string> user;         // The id of the User giving the votes.
    std::optional<std::string> with_deleted; // No effect currently.
};

struct OsuGetBeatmapsetDiscussionVotesResponse {
    std::optional<std::string> cursor_string;
    std::vector<BeatmapsetDiscussion> discussions;
    std::vector<User> users;
    std::vector<BeatmapsetDiscussionVote> votes;
};

struct OsuGetBeatmapsetDiscussionsRequest {
    std::optional<std::string> beatmap_id;    // Id of the Beatmap.
    std::optional<std::string> beatmapset_id; // Id of the Beatmapset.
    std::string beatmapset_status = "all";    // all, ranked, qualified, disqualified, never_qualified.
    std::optional<int32_t> limit;             // Maximum number of results.
    std::vector<std::string> message_types;   // suggestion, problem, mapper_note, praise, hype, review.
    std::string only_unresolved = "false";    // true to show only unresolved issues.
    std::optional<int32_t> page;              // Search result page.
    std::string sort = "id_desc";             // id_desc for newest first; id_asc for oldest first.
    std::optional<std::string> user;          // The id of the User.
    std::optional<std::string> with_deleted;  // No effect currently.
    std::optional<std::string> cursor_string; // Cursor for pagination.
};

struct OsuGetBeatmapsetDiscussionsResponse {
    std::vector<BeatmapExtended> beatmaps;                   // Beatmaps associated with the discussions returned.
    std::optional<std::string> cursor_string;
    std::vector<BeatmapsetDiscussion> discussions;           // Discussions according to sort order.
    std::vector<BeatmapsetDiscussion> included_discussions;  // Additional discussions related to discussions.
    int32_t reviews_config_max_blocks;                       // Maximum number of blocks allowed in a review.
    std::vector<User> users;                                 // Users associated with the discussions returned.
};

// BEATMAPSETS

struct OsuSearchBeatmapsetCursor {
    int32_t approved_date;
    int32_t id;
};

struct OsuSearchBeatmapsetResponseMeta {
    std::string sort;
};

struct OsuSearchBeatmapsetRequest {
    std::optional<std::string> query;         // Song title, artist, stars, bpm, date, etc.
    std::optional<std::string>
        sort;          // e.g. title_desc, artist_asc, difficulty_desc, rating_asc, plays_desc, favourites_asc.
    std::vector<std::string> general;         // converts, follows, recommended, featured_artists, spotlights.
    std::optional<Ruleset> mode;              // osu, fruits, mania, taiko.
    std::optional<std::string> section;       // ranked, qualified, loved, favourites, pending, wip, graveyard, mine.
    std::optional<std::string> genre;         // Video Game, Anime, Rock, Pop, Hip Hop, Electronic, etc.
    std::optional<std::string> language;      // English, Japanese, Korean, Instrumental, Unspecified, etc.
    std::optional<std::string> include;       // video, storyboard.
    std::vector<std::string> rank;            // XH, X, SH, S, A, B, C, D.
    std::optional<bool> nsfw;                 // Requires login via lazer.
    std::optional<std::string> cursor_string; // Cursor for pagination.
};

struct OsuSearchBeatmapsetResponse {
    std::vector<Beatmapset> beatmapsets;
    OsuSearchBeatmapsetResponseMeta search;
    int32_t recommended_difficulty;
    std::string error;
    int32_t total;
    OsuSearchBeatmapsetCursor cursor;
    std::string cursor_string;
};

struct OsuBeatmapsetLookupRequest {
    int32_t beatmap_id; // Id of a beatmap belonging to the beatmapset.
};

using OsuBeatmapsetLookupResponse = Beatmapset;

struct OsuGetBeatmapsetRequest {
    std::string beatmapset; // The beatmapset.
};

using OsuGetBeatmapsetResponse = Beatmapset;

// CHANGELOG

struct OsuGetChangelogBuildRequest {
    std::string stream; // Update stream name.
    std::string build;  // Build version.
};

using OsuGetChangelogBuildResponse = Build; // includes changelog_entries, changelog_entries.github_user, versions

struct OsuGetChangelogListingRequest {
    std::optional<std::string> from;    // Minimum build version.
    std::optional<int32_t> max_id;      // Maximum build ID.
    std::optional<std::string> stream;  // Stream name to return builds from.
    std::optional<std::string> to;      // Maximum build version.
    std::vector<std::string> message_formats; // html, markdown. Defaults to both.
};

struct OsuGetChangelogListingResponse {
    std::vector<Build> builds; // Includes changelog_entries, changelog_entries.github_user, requested formats.
    std::optional<std::string> search_from; // `from` input.
    int32_t search_limit; // Always 21.
    std::optional<int32_t> search_max_id; // `max_id` input.
    std::optional<std::string> search_stream; // `stream` input.
    std::optional<std::string> search_to; // `to` input.
    std::vector<UpdateStream> streams; // Always all available streams, includes latest_build, user_count.
};

struct OsuLookupChangelogBuildRequest {
    std::string changelog; // Build version, update stream name, or build ID.
    std::optional<std::string> key; // Unset to query by version/stream name, or "id" to query by build ID.
    std::vector<std::string> message_formats; // html, markdown. Defaults to both.
};

using OsuLookupChangelogBuildResponse = Build;

// COMMENTS

struct OsuGetCommentsRequest {
    std::optional<std::string> after; // Comments after the specified comment id, as per sort option.
    std::optional<std::string> commentable_type; // The type of resource to get comments for.
    std::optional<std::string> commentable_id; // The id of the resource to get comments for.
    std::optional<std::string> cursor; // Pagination cursor.
    std::optional<std::string> parent_id; // Limit to replies of the specified id. 0 for top level comments.
    std::string sort = "new"; // Sort option. Defaults to `new` for guests.
};

using OsuGetCommentsResponse = CommentBundle; // pinned_comments only included when commentable_type/id are specified

struct OsuGetCommentRequest {
    std::string comment; // The comment.
};

using OsuGetCommentResponse = CommentBundle;

// EVENTS

struct OsuGetEventsRequest {
    std::string sort = "id_desc"; // Sorting option: id_desc (default) or id_asc.
    std::optional<std::string> cursor_string; // Cursor for pagination.
};

struct OsuGetEventsResponse {
    std::optional<std::string> cursor_string;
    std::vector<Event> events;
};

// FORUM

struct OsuLockTopicRequest {
    int32_t topic; // Topic id.
    bool lock; // Whether to lock the topic.
};
// response: empty

struct OsuPinTopicRequest {
    int32_t topic; // Topic id.
    int32_t pin; // 0 to unpin, 1 for sticky, 2 for announcement.
};
// response: empty

struct OsuReplyTopicRequest {
    int32_t topic; // Id of the topic to be replied to.
    std::string body; // Content of the reply post.
};

using OsuReplyTopicResponse = ForumPost; // includes body

struct OsuGetTopicListingRequest {
    std::optional<std::string> forum_id; // Id of a specific forum to get topics from.
    std::string sort = "new"; // new (default) or old. Sorts by last post time.
    std::optional<int32_t> limit; // Maximum number of topics (50 at most and by default).
    std::optional<std::string> cursor_string; // Cursor for pagination.
};

struct OsuGetTopicListingResponse {
    std::vector<ForumTopic> topics;
    std::optional<std::string> cursor_string;
};

struct OsuCreateTopicPollBody {
    bool hide_results = false; // Hide results until voting period ends.
    int32_t length_days = 0; // Number of days for voting period. 0 means never ends.
    int32_t max_options = 1; // Maximum number of votes each user can cast.
    std::string options; // Newline-separated list of voting options. BBCode supported.
    std::string title; // Title of the poll.
    bool vote_change = false; // Whether to allow users to change their votes.
};

struct OsuCreateTopicRequest {
    std::string body; // Content of the topic.
    int32_t forum_id; // Forum to create the topic in.
    std::string title; // Title of the topic.
    bool with_poll = false; // Also create a poll in the topic.
    std::optional<OsuCreateTopicPollBody> forum_topic_poll; // Required fields inside if with_poll is true.
};

struct OsuCreateTopicResponse {
    std::shared_ptr<ForumTopic> topic;
    std::shared_ptr<ForumPost> post; // Includes body.
};

struct OsuGetTopicAndPostsRequest {
    int32_t topic; // Id of the topic.
    std::string sort = "id_asc"; // id_asc (default) or id_desc.
    int32_t limit = 20; // Maximum number of posts (20 default, 50 at most).
    std::optional<std::string> start; // First post id to return when sort is id_asc. Ignored if cursor_string set.
    std::optional<std::string> end; // First post id to return when sort is id_desc. Ignored if cursor_string set.
    std::optional<std::string> cursor_string; // Cursor for pagination.
};

struct OsuGetTopicAndPostsResponse {
    std::optional<std::string> cursor_string;
    std::vector<ForumPost> posts; // Includes body.
    std::shared_ptr<ForumTopic> topic;
};

struct OsuEditTopicRequest {
    int32_t topic; // Id of the topic.
    std::optional<std::string> forum_topic_topic_title; // New topic title.
};

using OsuEditTopicResponse = ForumTopic;

struct OsuEditPostRequest {
    int32_t post; // Id of the post.
    std::string body; // New post content in BBCode format.
};

using OsuEditPostResponse = ForumPost; // includes body

// no params. response: forums array
struct OsuGetForumListingRequest {};

struct OsuGetForumListingResponse {
    std::vector<Forum> forums;
};

struct OsuGetForumAndTopicsRequest {
    int32_t forum; // Id of the forum.
};

struct OsuGetForumAndTopicsResponse {
    std::shared_ptr<Forum> forum;
    std::vector<ForumTopic> topics;
    std::vector<ForumTopic> pinned_topics;
};

// SEARCH

struct OsuSearchRequest {
    std::string mode = "all"; // all, user, or wiki_page.
    std::optional<std::string> query; // Search keyword.
    std::optional<int32_t> page; // Search result page. Ignored for mode `all`.
};

template <typename T>
struct OsuSearchResult {
    std::vector<T> data;
    int32_t total;
};

struct OsuSearchResponse {
    std::optional<OsuSearchResult<User>> user; // For `all` or `user` mode. Only first 100 results accessible.
    std::optional<OsuSearchResult<WikiPage>> wiki_page; // For `all` or `wiki_page` mode.
};

// MATCHES

struct OsuGetMatchesListingRequest {
    int32_t limit = 50; // Maximum number of matches (50 default, 1 min, 50 max).
    std::string sort = "id_desc"; // id_desc for newest first; id_asc for oldest first.
    std::optional<bool> active; // true for active only, false for inactive only. Unset returns both.
    std::optional<std::string> cursor_string; // Cursor for pagination.
};

struct OsuGetMatchesListingResponse {
    std::shared_ptr<Cursor> cursor;
    std::optional<std::string> cursor_string;
    std::vector<Match> matches;
    int32_t params_limit;
    std::string params_sort;
    std::optional<bool> params_active;
};

struct OsuGetMatchRequest {
    int32_t match; // Match ID.
    std::optional<int32_t> before; // Filter for match events before the specified MatchEvent.id.
    std::optional<int32_t> after; // Filter for match events after the specified MatchEvent.id.
    int32_t limit = 100; // Maximum number of match events (100 default, 1 min, 101 max).
};

struct OsuGetMatchResponse {
    std::shared_ptr<Match> match;
    std::vector<MatchEvent> events;
    std::vector<User> users; // Includes country.
    int32_t first_event_id; // ID of the first MatchEvent in the match.
    int32_t latest_event_id; // ID of the latest MatchEvent in the match.
};

namespace osu_v2 {
    [[nodiscard]] bool authenticate(OsuClientCredentialsRequest data);

    inline AuthExpirationToken m_token = {};
}; // namespace osu_v2

inline static void from_json(const nlohmann::json& j, OsuClientCredentialsResponse& r) {
    r.access_token = j.value("access_token", "");
    r.expires_in = j.value("expires_in", 0);
    r.token_type = j.value("token_type", "");
}
