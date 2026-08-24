#pragma once

#include "../api.hpp"

#include <cstdint>
#include <nlohmann/json.hpp>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <vector>

struct BeatmapPack;
struct Beatmap;
struct BeatmapUserScore;
struct BeatmapScores;
struct BeatmapDifficultyAttributes;
struct Beatmapset;
struct BeatmapExtended;
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
struct UserExtended;
struct WikiPage;
struct Match;
struct MatchEvent;
struct Score;
struct Mod;
struct Cursor;

using Ruleset = std::string; // osu, taiko, fruits, mania

struct Mod {
    std::string acronym;
    nlohmann::json settings = nlohmann::json::object();
};

struct Beatmap {
    int32_t id = 0;
    int32_t beatmapset_id = 0;
    std::string checksum;
    std::string mode;
    std::string status;
    std::string version;
    double accuracy = 0.0;
    double ar = 0.0;
    double bpm = 0.0;
    double cs = 0.0;
    double drain = 0.0;
    double difficulty_rating = 0.0;
    int32_t total_length = 0;
    int32_t user_id = 0;
    std::optional<int32_t> max_combo;
};

struct BeatmapExtended : Beatmap {
    std::optional<std::string> last_updated;
    std::optional<int32_t> passcount;
    std::optional<int32_t> playcount;
};

struct BeatmapsetCovers {
    std::string cover;
    std::string card;
    std::string list;
    std::string slimcover;
    std::string cover_2x;
    std::string card_2x;
    std::string list_2x;
    std::string slimcover_2x;
};

struct UserCountry {
    std::string code;
    std::string name;
};

struct UserCover {
    std::optional<std::string> custom_url;
    std::string url;
};

struct UserLevel {
    int32_t current = 0;
    double progress = 0.0;
};

struct UserRank {
    std::optional<int32_t> global;
    std::optional<int32_t> country;
};

struct UserStatistics {
    double pp = 0.0;
    double ppv1 = 0.0;
    double accuracy = 0.0;
    int64_t global_rank = 0;
    int32_t country_rank = 0;
    int32_t play_count = 0;
    int64_t play_time = 0;
    int64_t ranked_score = 0;
    int64_t total_score = 0;
    int64_t total_hits = 0;
    int32_t maximum_combo = 0;
    UserLevel level;
    UserRank rank;
};

struct BeatmapPack {
    std::string tag;
    std::string name;
    std::string pack_type;
    std::string date;
    std::string url;
    std::vector<int32_t> beatmap_ids;
};

struct Beatmapset {
    int32_t id = 0;
    std::string artist_unicode;
    int32_t favourite_count = 0;
    int32_t play_count = 0;
    int32_t user_id = 0;
    std::string artist;
    std::string creator;
    std::string source;
    std::string title;
    std::string title_unicode;
    std::string status;
    BeatmapsetCovers covers;
    std::vector<BeatmapExtended> beatmaps;
};

struct User {
    int32_t id = 0;
    std::string username;
    std::string country_code;
    std::string avatar_url;
    std::string country;
    std::string profile_colour;
    bool is_active = false;
    bool is_bot = false;
    bool is_online = false;
    bool is_supporter = false;
    std::optional<UserCountry> country_info;
    std::optional<UserCover> cover;
};

struct UserExtended : User {
    std::string join_date;
    std::string last_visit;
    std::string occupation;
    std::string interests;
    std::string playstyle;
    std::string twitter;
    std::string website;
    std::optional<UserStatistics> statistics;
    std::vector<std::string> account_history;
};

struct Score {
    int64_t id = 0;
    int32_t user_id = 0;
    double accuracy = 0.0;
    int32_t max_combo = 0;
    std::string rank;
    int64_t score = 0;
    std::optional<double> pp;
    bool perfect = false;
    std::string created_at;
    std::string mode;
    std::vector<Mod> mods;
    std::shared_ptr<User> user;
};

struct BeatmapUserScore {
    int32_t position = 0;
    Score score;
};

struct BeatmapScores {
    std::vector<Score> scores;
    std::shared_ptr<Beatmap> beatmap;
    std::shared_ptr<Beatmapset> beatmapset;
};

struct BeatmapDifficultyAttributes {
    double max_combo = 0.0;
    double star_rating = 0.0;
};

struct Cursor {
    int32_t id = 0;
    std::string page;
};

struct Event {
    int64_t id = 0;
    std::string created_at;
    std::string type;
    std::shared_ptr<User> user;
};

struct Forum {
    int32_t id = 0;
    std::string name;
    std::string description;
};

struct ForumTopic {
    int32_t id = 0;
    int32_t forum_id = 0;
    std::string title;
    std::string created_at;
    std::string last_post_at;
    bool is_locked = false;
    bool is_sticky = false;
};

struct ForumPost {
    int32_t id = 0;
    int32_t topic_id = 0;
    nlohmann::json body = "";
    std::string created_at;
    std::shared_ptr<User> user;
};

struct BeatmapsetDiscussion {
    int32_t id = 0;
    int32_t beatmapset_id = 0;
    int32_t beatmap_id = 0;
    int32_t user_id = 0;
    std::string message_type;
    std::string timestamp;
    bool resolved = false;
};

struct BeatmapsetDiscussionPost : ForumPost {};

struct BeatmapsetDiscussionVote {
    int32_t id = 0;
    int32_t user_id = 0;
    int32_t score = 0;
};

struct Build {
    int32_t id = 0;
    std::string version;
    std::string display_version;
    std::string update_stream;
    std::string created_at;
};

struct UpdateStream {
    std::string name;
    int32_t user_count = 0;
    std::shared_ptr<Build> latest_build;
};

struct CommentBundle {
    std::vector<User> users;
    std::vector<ForumPost> comments;
    std::optional<std::string> cursor;
};

struct WikiPage {
    std::string locale;
    std::string title;
    std::string path;
};

struct Match {
    int64_t id = 0;
    std::string start_time;
    std::string end_time;
    std::string name;
};

struct MatchEvent {
    int64_t id = 0;
    int64_t match_id = 0;
    nlohmann::json detail = nlohmann::json::object();
    std::string timestamp;
};

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
    std::optional<std::string> mods;   // Mod combination: bitset, array of acronyms, or array of Mods. Defaults to no mods.
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
    std::vector<Beatmapset> beatmapsets;
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
    std::optional<std::string> sort; // e.g. title_desc, artist_asc, difficulty_desc, rating_asc, plays_desc, favourites_asc.
    std::vector<std::string> general; // converts, follows, recommended, featured_artists, spotlights.
    std::optional<Ruleset> mode; // osu, fruits, mania, taiko.
    std::optional<std::string> section; // ranked, qualified, loved, favourites, pending, wip, graveyard, mine.
    std::optional<std::string> genre; // Video Game, Anime, Rock, Pop, Hip Hop, Electronic, etc.
    std::optional<std::string> language; // English, Japanese, Korean, Instrumental, Unspecified, etc.
    std::optional<std::string> include; // video, storyboard.
    std::vector<std::string> rank; // XH, X, SH, S, A, B, C, D.
    std::optional<bool> nsfw; // Requires login via lazer.
    std::optional<std::string> cursor_string; // Cursor for pagination.
};

struct OsuSearchBeatmapsetResponse {
    std::vector<Beatmapset> beatmapsets;
    OsuSearchBeatmapsetResponseMeta search;
    std::optional<int32_t> recommended_difficulty;
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
    std::string build; // Build version.
};

using OsuGetChangelogBuildResponse = Build; // includes changelog_entries, changelog_entries.github_user, versions

struct OsuGetChangelogListingRequest {
    std::optional<std::string> from; // Minimum build version.
    std::optional<int32_t> max_id; // Maximum build ID.
    std::optional<std::string> stream; // Stream name to return builds from.
    std::optional<std::string> to; // Maximum build version.
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

class OsuV2API : public OAuthApi {
public:
    OsuV2API();
    ~OsuV2API() = default;

    std::optional<OsuGetBeatmapsResponse> get_beatmaps(const OsuGetBeatmapsRequest& request);
    std::optional<OsuGetBeatmapResponse> get_beatmap(const OsuGetBeatmapRequest& request);
    std::optional<OsuGetBeatmapPacksResponse> get_beatmap_packs(const OsuGetBeatmapPacksRequest& request);
    std::optional<OsuGetBeatmapPackResponse> get_beatmap_pack(const OsuGetBeatmapPackRequest& request);
    std::optional<OsuBeatmapLookupResponse> lookup_beatmap(const OsuBeatmapLookupRequest& request);
    std::optional<OsuGetUserBeatmapScoreResponse> get_user_beatmap_score(const OsuGetUserBeatmapScoreRequest& request);
    std::optional<OsuGetUserBeatmapScoresResponse> get_user_beatmap_scores(const OsuGetUserBeatmapScoresRequest& request);
    std::optional<OsuGetBeatmapScoresResponse> get_beatmap_scores(const OsuGetBeatmapScoresRequest& request);
    std::optional<OsuGetBeatmapAttributesResponse> get_beatmap_attributes(const OsuGetBeatmapAttributesRequest& request);
    std::optional<OsuGetBeatmapsetDiscussionPostsResponse>
    get_beatmapset_discussion_posts(const OsuGetBeatmapsetDiscussionPostsRequest& request);
    std::optional<OsuGetBeatmapsetDiscussionVotesResponse>
    get_beatmapset_discussion_votes(const OsuGetBeatmapsetDiscussionVotesRequest& request);
    std::optional<OsuGetBeatmapsetDiscussionsResponse>
    get_beatmapset_discussions(const OsuGetBeatmapsetDiscussionsRequest& request);
    std::optional<OsuSearchBeatmapsetResponse> search_beatmapsets(const OsuSearchBeatmapsetRequest& request);
    std::optional<OsuBeatmapsetLookupResponse> lookup_beatmapset(const OsuBeatmapsetLookupRequest& request);
    std::optional<OsuGetBeatmapsetResponse> get_beatmapset(const OsuGetBeatmapsetRequest& request);
    std::optional<OsuGetEventsResponse> get_events(const OsuGetEventsRequest& request);
    std::optional<OsuGetTopicListingResponse> get_topic_listing(const OsuGetTopicListingRequest& request);
    std::optional<OsuGetTopicAndPostsResponse> get_topic_and_posts(const OsuGetTopicAndPostsRequest& request);
    std::optional<OsuGetForumListingResponse> get_forum_listing(const OsuGetForumListingRequest& request);
    std::optional<OsuGetForumAndTopicsResponse> get_forum_and_topics(const OsuGetForumAndTopicsRequest& request);
    std::optional<OsuSearchResponse> search(const OsuSearchRequest& request);
    std::optional<OsuGetMatchesListingResponse> get_matches_listing(const OsuGetMatchesListingRequest& request);
    std::optional<OsuGetMatchResponse> get_match(const OsuGetMatchRequest& request);
};

inline void to_json(nlohmann::json& j, const OsuAuthorizeRequest& r) {
    j = {{"client_id", r.client_id}, {"response_type", r.response_type}};
    if (r.redirect_uri) j["redirect_uri"] = *r.redirect_uri;
    if (r.scope) j["scope"] = *r.scope;
    if (r.state) j["state"] = *r.state;
}

inline void to_json(nlohmann::json& j, const OsuAuthRequest& r) {
    j = {{"client_id", r.client_id}, {"client_secret", r.client_secret}, {"code", r.code}, {"grant_type", r.grant_type}};
    if (r.redirect_uri) j["redirect_uri"] = *r.redirect_uri;
}

inline void to_json(nlohmann::json& j, const OsuClientCredentialsRequest& r) {
    j = {
        {"client_id", r.client_id},
        {"client_secret", r.client_secret},
        {"grant_type", r.grant_type},
        {"scope", query::string_set_to_string(r.scope, " ")}
    };
}

inline void to_json(nlohmann::json& j, const OsuGetBeatmapPacksRequest& r) {
    j = {{"type", r.type}};
    if (r.cursor_string) j["cursor_string"] = *r.cursor_string;
}

inline void to_json(nlohmann::json& j, const OsuBeatmapLookupRequest& r) {
    j = nlohmann::json::object();
    if (r.checksum) j["checksum"] = *r.checksum;
    if (r.filename) j["filename"] = *r.filename;
    if (r.id) j["id"] = *r.id;
}

inline void to_json(nlohmann::json& j, const OsuGetBeatmapsRequest& r) {
    j = {{"ids", r.ids}};
}

inline void to_json(nlohmann::json& j, const OsuGetBeatmapRequest& r) {
    j = {{"beatmap", r.beatmap}};
}

inline void from_json(const nlohmann::json& j, Mod& r) {
    if (j.is_string()) {
        r.acronym = j.get<std::string>();
        r.settings = nlohmann::json::object();
        return;
    }

    r.acronym = j.value("acronym", "");
    r.settings = j.value("settings", nlohmann::json::object());
}

inline void from_json(const nlohmann::json& j, BeatmapPack& r) {
    r.tag = j.value("tag", "");
    r.name = j.value("name", "");
    r.pack_type = j.value("pack_type", "");
    r.date = j.value("date", "");
    r.url = j.value("url", "");
    r.beatmap_ids = j.value("beatmap_ids", std::vector<int32_t>{});
}

inline void from_json(const nlohmann::json& j, UserCountry& r);
inline void from_json(const nlohmann::json& j, UserCover& r);
inline void from_json(const nlohmann::json& j, UserLevel& r);
inline void from_json(const nlohmann::json& j, UserRank& r);
inline void from_json(const nlohmann::json& j, UserStatistics& r);

inline void from_json(const nlohmann::json& j, User& r) {
    r.id = j.value("id", 0);
    r.username = j.value("username", "");
    r.country_code = j.value("country_code", "");
    r.avatar_url = j.value("avatar_url", "");

    if (j.contains("country") && j.at("country").is_string()) {
        r.country = j.at("country").get<std::string>();
    }

    if (j.contains("profile_colour") && !j.at("profile_colour").is_null()) {
        r.profile_colour = j.at("profile_colour").get<std::string>();
    }

    r.is_active = j.value("is_active", false);
    r.is_bot = j.value("is_bot", false);
    r.is_online = j.value("is_online", false);
    r.is_supporter = j.value("is_supporter", false);

    if (j.contains("country") && j.at("country").is_object()) {
        if (j.at("country").contains("code")) {
            r.country_info = j.at("country").get<UserCountry>();
        }
    }

    if (j.contains("cover") && j.at("cover").is_object()) {
        r.cover = j.at("cover").get<UserCover>();
    }
}

inline void from_json(const nlohmann::json& j, UserCountry& r) {
    r.code = j.value("code", "");
    r.name = j.value("name", "");
}

inline void from_json(const nlohmann::json& j, UserCover& r) {
    if (j.contains("custom_url") && !j.at("custom_url").is_null()) {
        r.custom_url = j.at("custom_url").get<std::string>();
    }

    r.url = j.value("url", "");
}

inline void from_json(const nlohmann::json& j, UserLevel& r) {
    r.current = j.value("current", 0);
    r.progress = j.value("progress", 0.0);
}

inline void from_json(const nlohmann::json& j, UserRank& r) {
    if (j.contains("global") && !j.at("global").is_null()) r.global = j.at("global").get<int32_t>();
    if (j.contains("country") && !j.at("country").is_null()) r.country = j.at("country").get<int32_t>();
}

inline void from_json(const nlohmann::json& j, UserStatistics& r) {
    r.pp = j.value("pp", 0.0);
    r.ppv1 = j.value("ppv1", 0.0);
    r.accuracy = j.value("accuracy", 0.0);
    r.global_rank = j.value("global_rank", int64_t{0});
    r.country_rank = j.value("country_rank", 0);
    r.play_count = j.value("play_count", 0);
    r.play_time = j.value("play_time", int64_t{0});
    r.ranked_score = j.value("ranked_score", int64_t{0});
    r.total_score = j.value("total_score", int64_t{0});
    r.total_hits = j.value("total_hits", int64_t{0});
    r.maximum_combo = j.value("maximum_combo", 0);
    if (j.contains("level") && !j.at("level").is_null()) r.level = j.at("level").get<UserLevel>();
    if (j.contains("rank") && !j.at("rank").is_null()) r.rank = j.at("rank").get<UserRank>();
}

inline void from_json(const nlohmann::json& j, UserExtended& r) {
    from_json(j, static_cast<User&>(r));
    r.join_date = j.value("join_date", "");
    r.last_visit = j.value("last_visit", "");
    r.occupation = j.value("occupation", "");
    r.interests = j.value("interests", "");
    r.playstyle = j.value("playstyle", "");
    r.twitter = j.value("twitter", "");
    r.website = j.value("website", "");

    if (j.contains("statistics") && !j.at("statistics").is_null()) {
        r.statistics = j.at("statistics").get<UserStatistics>();
    }

    r.account_history = j.value("account_history", std::vector<std::string>{});
}

inline void from_json(const nlohmann::json& j, Score& r) {
    r.id = j.value("id", int64_t{0});
    r.user_id = j.value("user_id", 0);
    r.accuracy = j.value("accuracy", 0.0);
    r.max_combo = j.value("max_combo", 0);
    r.rank = j.value("rank", "");
    r.score = j.value("score", int64_t{0});

    if (j.contains("pp") && !j.at("pp").is_null()) {
        r.pp = j.at("pp").get<double>();
    }

    r.perfect = j.value("perfect", false);
    r.created_at = j.value("created_at", "");
    r.mode = j.value("mode", "");
    r.mods = j.value("mods", std::vector<Mod>{});

    if (j.contains("user") && !j.at("user").is_null()) {
        r.user = std::make_shared<User>(j.at("user").get<User>());
    }
}

inline void from_json(const nlohmann::json& j, OsuClientCredentialsResponse& r) {
    r.access_token = j.value("access_token", "");
    r.expires_in = j.value("expires_in", 0);
    r.token_type = j.value("token_type", "");
}

inline void from_json(const nlohmann::json& j, OsuAuthResponse& r) {
    r.access_token = j.value("access_token", "");
    r.expires_in = j.value("expires_in", 0);
    r.refresh_token = j.value("refresh_token", "");
    r.token_type = j.value("token_type", "");
}

inline void from_json(const nlohmann::json& json, Beatmap& beatmap) {
    beatmap.id = json.value("id", 0);
    beatmap.beatmapset_id = json.value("beatmapset_id", 0);

    if (json.contains("checksum") && !json.at("checksum").is_null()) {
        beatmap.checksum = json.at("checksum").get<std::string>();
    }

    beatmap.mode = json.value("mode", "");
    beatmap.status = json.value("status", "");
    beatmap.version = json.value("version", "");
    beatmap.accuracy = json.value("accuracy", 0.0);
    beatmap.ar = json.value("ar", 0.0);

    if (json.contains("bpm") && !json.at("bpm").is_null()) {
        beatmap.bpm = json.at("bpm").get<double>();
    }

    beatmap.cs = json.value("cs", 0.0);
    beatmap.drain = json.value("drain", 0.0);
    beatmap.difficulty_rating = json.value("difficulty_rating", 0.0);
    beatmap.total_length = json.value("total_length", 0);
    beatmap.user_id = json.value("user_id", 0);

    if (json.contains("max_combo") && !json.at("max_combo").is_null()) {
        beatmap.max_combo = json.at("max_combo").get<int32_t>();
    }
}

inline void from_json(const nlohmann::json& json, BeatmapExtended& beatmap) {
    from_json(json, static_cast<Beatmap&>(beatmap));

    if (json.contains("last_updated") && !json.at("last_updated").is_null()) {
        beatmap.last_updated = json.at("last_updated").get<std::string>();
    }

    if (json.contains("passcount") && !json.at("passcount").is_null()) {
        beatmap.passcount = json.at("passcount").get<int32_t>();
    }

    if (json.contains("playcount") && !json.at("playcount").is_null()) {
        beatmap.playcount = json.at("playcount").get<int32_t>();
    }
}

inline void from_json(const nlohmann::json& j, BeatmapsetCovers& r) {
    r.cover = j.value("cover", "");
    r.card = j.value("card", "");
    r.list = j.value("list", "");
    r.slimcover = j.value("slimcover", "");
    r.cover_2x = j.value("cover@2x", "");
    r.card_2x = j.value("card@2x", "");
    r.list_2x = j.value("list@2x", "");
    r.slimcover_2x = j.value("slimcover@2x", "");
}

inline void from_json(const nlohmann::json& j, OsuGetBeatmapsResponse& r) {
    r.beatmaps = j.value("beatmaps", std::vector<BeatmapExtended>{});
}

inline void from_json(const nlohmann::json& j, Beatmapset& r) {
    r.id = j.value("id", 0);
    r.artist = j.value("artist", "");
    r.artist_unicode = j.value("artist_unicode", "");
    r.creator = j.value("creator", "");
    r.favourite_count = j.value("favourite_count", 0);
    r.play_count = j.value("play_count", 0);
    r.source = j.value("source", "");
    r.status = j.value("status", "");
    r.title = j.value("title", "");
    r.title_unicode = j.value("title_unicode", "");
    r.user_id = j.value("user_id", 0);

    if (j.contains("covers") && !j.at("covers").is_null()) {
        r.covers = j.at("covers").get<BeatmapsetCovers>();
    }

    if (j.contains("beatmaps") && !j.at("beatmaps").is_null()) {
        r.beatmaps = j.at("beatmaps").get<std::vector<BeatmapExtended>>();
    }
}

inline void from_json(const nlohmann::json& j, BeatmapDifficultyAttributes& r) {
    r.max_combo = j.value("max_combo", 0.0);
    r.star_rating = j.value("star_rating", 0.0);
}

inline void from_json(const nlohmann::json& j, Cursor& r) {
    r.id = j.value("id", 0);
    r.page = j.value("page", "");
}

inline void from_json(const nlohmann::json& j, Event& r) {
    r.id = j.value("id", int64_t{0});
    r.created_at = j.value("created_at", "");
    r.type = j.value("type", "");
    if (j.contains("user") && !j.at("user").is_null()) r.user = std::make_shared<User>(j.at("user").get<User>());
}

inline void from_json(const nlohmann::json& j, Forum& r) {
    r.id = j.value("id", 0);
    r.name = j.value("name", "");
    r.description = j.value("description", "");
}

inline void from_json(const nlohmann::json& j, ForumTopic& r) {
    r.id = j.value("id", 0);
    r.forum_id = j.value("forum_id", 0);
    r.title = j.value("title", "");
    r.created_at = j.value("created_at", "");
    r.last_post_at = j.value("last_post_at", "");
    r.is_locked = j.value("is_locked", false);
    r.is_sticky = j.value("is_sticky", false);
}

inline void from_json(const nlohmann::json& j, ForumPost& r) {
    r.id = j.value("id", 0);
    r.topic_id = j.value("topic_id", 0);

    if (j.contains("body") && !j.at("body").is_null()) {
        r.body = j.at("body");
    }

    r.created_at = j.value("created_at", "");
    if (j.contains("user") && !j.at("user").is_null()) r.user = std::make_shared<User>(j.at("user").get<User>());
}

inline void from_json(const nlohmann::json& j, BeatmapsetDiscussion& r) {
    r.id = j.value("id", 0);

    if (j.contains("beatmap_id") && !j.at("beatmap_id").is_null()) {
        r.beatmap_id = j.at("beatmap_id").get<int32_t>();
    }

    r.beatmapset_id = j.value("beatmapset_id", 0);
    r.user_id = j.value("user_id", 0);
    r.message_type = j.value("message_type", "");
    r.timestamp = j.value("created_at", "");
    r.resolved = j.value("resolved", false);
}

inline void from_json(const nlohmann::json& j, BeatmapsetDiscussionPost& r) {
    from_json(j, static_cast<ForumPost&>(r));
}

inline void from_json(const nlohmann::json& j, BeatmapsetDiscussionVote& r) {
    r.id = j.value("id", 0);
    r.user_id = j.value("user_id", 0);
    r.score = j.value("score", 0);
}

inline void from_json(const nlohmann::json& j, Build& r) {
    r.id = j.value("id", 0);
    r.version = j.value("version", "");
    r.display_version = j.value("display_version", "");
    r.update_stream = j.value("update_stream", "");
    r.created_at = j.value("created_at", "");
}

inline void from_json(const nlohmann::json& j, UpdateStream& r) {
    r.name = j.value("name", "");
    r.user_count = j.value("user_count", 0);

    if (j.contains("latest_build") && !j.at("latest_build").is_null()) {
        r.latest_build = std::make_shared<Build>(j.at("latest_build").get<Build>());
    }
}

inline void from_json(const nlohmann::json& j, WikiPage& r) {
    r.locale = j.value("locale", "");
    r.title = j.value("title", "");
    r.path = j.value("path", "");
}

inline void from_json(const nlohmann::json& j, Match& r) {
    r.id = j.value("id", int64_t{0});
    r.start_time = j.value("start_time", "");

    if (j.contains("end_time") && !j.at("end_time").is_null()) {
        r.end_time = j.at("end_time").get<std::string>();
    }

    r.name = j.value("name", "");
}

inline void from_json(const nlohmann::json& j, MatchEvent& r) {
    r.id = j.value("id", int64_t{0});
    r.match_id = j.value("match_id", int64_t{0});

    if (j.contains("detail") && !j.at("detail").is_null()) {
        r.detail = j.at("detail");
    }

    r.timestamp = j.value("timestamp", "");
}

inline void from_json(const nlohmann::json& j, OsuGetBeatmapPacksResponse& r) {
    r.beatmap_packs = j.value("beatmap_packs", std::vector<BeatmapPack>{});
}

inline void from_json(const nlohmann::json& j, BeatmapUserScore& r) {
    r.position = j.value("position", 0);
    if (j.contains("score") && !j.at("score").is_null()) r.score = j.at("score").get<Score>();
}

inline void from_json(const nlohmann::json& j, BeatmapScores& r) {
    r.scores = j.value("scores", std::vector<Score>{});

    if (j.contains("beatmap") && !j.at("beatmap").is_null()) {
        r.beatmap = std::make_shared<Beatmap>(j.at("beatmap").get<Beatmap>());
    }

    if (j.contains("beatmapset") && !j.at("beatmapset").is_null()) {
        r.beatmapset = std::make_shared<Beatmapset>(j.at("beatmapset").get<Beatmapset>());
    }
}

inline void from_json(const nlohmann::json& j, OsuGetUserBeatmapScoresResponse& r) {
    r.scores = j.value("scores", std::vector<Score>{});
}

inline void from_json(const nlohmann::json& j, OsuGetBeatmapAttributesResponse& r) {
    if (j.contains("attributes") && !j.at("attributes").is_null()) {
        r.attributes = std::make_shared<BeatmapDifficultyAttributes>(j.at("attributes").get<BeatmapDifficultyAttributes>());
    }
}

inline void from_json(const nlohmann::json& j, OsuSearchBeatmapsetCursor& r) {
    r.approved_date = j.value("approved_date", 0);
    r.id = j.value("id", 0);
}

inline void from_json(const nlohmann::json& j, OsuSearchBeatmapsetResponseMeta& r) {
    r.sort = j.value("sort", "");
}

inline void from_json(const nlohmann::json& j, OsuSearchBeatmapsetResponse& r) {
    r.beatmapsets = j.value("beatmapsets", std::vector<Beatmapset>{});
    r.total = j.value("total", 0);

    if (j.contains("search") && !j.at("search").is_null()) {
        r.search = j.at("search").get<OsuSearchBeatmapsetResponseMeta>();
    }

    if (j.contains("recommended_difficulty") && !j.at("recommended_difficulty").is_null()) {
        r.recommended_difficulty = j.at("recommended_difficulty").get<int32_t>();
    }

    if (j.contains("error") && !j.at("error").is_null()) {
        r.error = j.at("error").get<std::string>();
    }

    if (j.contains("cursor") && !j.at("cursor").is_null()) {
        r.cursor = j.at("cursor").get<OsuSearchBeatmapsetCursor>();
    }

    if (j.contains("cursor_string") && !j.at("cursor_string").is_null()) {
        r.cursor_string = j.at("cursor_string").get<std::string>();
    }
}

inline void from_json(const nlohmann::json& j, OsuGetBeatmapsetDiscussionPostsResponse& r) {
    r.beatmapsets = j.value("beatmapsets", std::vector<Beatmapset>{});
    r.posts = j.value("posts", std::vector<BeatmapsetDiscussionPost>{});
    r.users = j.value("users", std::vector<User>{});

    if (j.contains("cursor_string") && !j.at("cursor_string").is_null()) {
        r.cursor_string = j.at("cursor_string").get<std::string>();
    }
}

inline void from_json(const nlohmann::json& j, OsuGetBeatmapsetDiscussionVotesResponse& r) {
    r.discussions = j.value("discussions", std::vector<BeatmapsetDiscussion>{});
    r.users = j.value("users", std::vector<User>{});
    r.votes = j.value("votes", std::vector<BeatmapsetDiscussionVote>{});

    if (j.contains("cursor_string") && !j.at("cursor_string").is_null()) {
        r.cursor_string = j.at("cursor_string").get<std::string>();
    }
}

inline void from_json(const nlohmann::json& j, OsuGetBeatmapsetDiscussionsResponse& r) {
    r.beatmaps = j.value("beatmaps", std::vector<BeatmapExtended>{});
    r.discussions = j.value("discussions", std::vector<BeatmapsetDiscussion>{});
    r.included_discussions = j.value("included_discussions", std::vector<BeatmapsetDiscussion>{});
    r.reviews_config_max_blocks = j.value("reviews_config_max_blocks", 0);
    r.users = j.value("users", std::vector<User>{});

    if (j.contains("cursor_string") && !j.at("cursor_string").is_null()) {
        r.cursor_string = j.at("cursor_string").get<std::string>();
    }
}

inline void from_json(const nlohmann::json& j, OsuGetEventsResponse& r) {
    if (j.contains("cursor_string") && !j.at("cursor_string").is_null())
        r.cursor_string = j.at("cursor_string").get<std::string>();
    r.events = j.value("events", std::vector<Event>{});
}

inline void from_json(const nlohmann::json& j, OsuGetTopicListingResponse& r) {
    r.topics = j.value("topics", std::vector<ForumTopic>{});
    if (j.contains("cursor_string") && !j.at("cursor_string").is_null())
        r.cursor_string = j.at("cursor_string").get<std::string>();
}

inline void from_json(const nlohmann::json& j, OsuGetTopicAndPostsResponse& r) {
    if (j.contains("cursor_string") && !j.at("cursor_string").is_null())
        r.cursor_string = j.at("cursor_string").get<std::string>();
    r.posts = j.value("posts", std::vector<ForumPost>{});
    if (j.contains("topic") && !j.at("topic").is_null()) r.topic = std::make_shared<ForumTopic>(j.at("topic").get<ForumTopic>());
}

inline void from_json(const nlohmann::json& j, CommentBundle& r) {
    r.users = j.value("users", std::vector<User>{});
    r.comments = j.value("comments", std::vector<ForumPost>{});
    if (j.contains("cursor") && !j.at("cursor").is_null()) r.cursor = j.at("cursor").get<std::string>();
}

inline void from_json(const nlohmann::json& j, OsuCreateTopicResponse& r) {
    if (j.contains("topic") && !j.at("topic").is_null()) r.topic = std::make_shared<ForumTopic>(j.at("topic").get<ForumTopic>());
    if (j.contains("post") && !j.at("post").is_null()) r.post = std::make_shared<ForumPost>(j.at("post").get<ForumPost>());
}

inline void from_json(const nlohmann::json& j, OsuGetForumListingResponse& r) {
    r.forums = j.value("forums", std::vector<Forum>{});
}

inline void from_json(const nlohmann::json& j, OsuGetForumAndTopicsResponse& r) {
    if (j.contains("forum") && !j.at("forum").is_null()) r.forum = std::make_shared<Forum>(j.at("forum").get<Forum>());
    r.topics = j.value("topics", std::vector<ForumTopic>{});
    r.pinned_topics = j.value("pinned_topics", std::vector<ForumTopic>{});
}

template <typename T>
inline void from_json(const nlohmann::json& j, OsuSearchResult<T>& r) {
    r.data = j.value("data", std::vector<T>{});
    r.total = j.value("total", 0);
}

inline void from_json(const nlohmann::json& j, OsuSearchResponse& r) {
    if (j.contains("user") && !j.at("user").is_null()) r.user = j.at("user").get<OsuSearchResult<User>>();
    if (j.contains("wiki_page") && !j.at("wiki_page").is_null()) r.wiki_page = j.at("wiki_page").get<OsuSearchResult<WikiPage>>();
}

inline void from_json(const nlohmann::json& j, OsuGetMatchesListingResponse& r) {
    if (j.contains("cursor") && !j.at("cursor").is_null()) {
        r.cursor = std::make_shared<Cursor>(j.at("cursor").get<Cursor>());
    }

    if (j.contains("cursor_string") && !j.at("cursor_string").is_null()) {
        r.cursor_string = j.at("cursor_string").get<std::string>();
    }

    r.matches = j.value("matches", std::vector<Match>{});
    const auto params = j.value("params", nlohmann::json::object());
    r.params_limit = params.value("limit", 0);
    r.params_sort = params.value("sort", "");

    if (params.contains("active") && !params.at("active").is_null()) {
        r.params_active = params.at("active").get<bool>();
    }
}

inline void from_json(const nlohmann::json& j, OsuGetMatchResponse& r) {
    if (j.contains("match") && !j.at("match").is_null()) r.match = std::make_shared<Match>(j.at("match").get<Match>());
    r.events = j.value("events", std::vector<MatchEvent>{});
    r.users = j.value("users", std::vector<User>{});
    r.first_event_id = j.value("first_event_id", 0);
    r.latest_event_id = j.value("latest_event_id", 0);
}
