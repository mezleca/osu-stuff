#include "filter.hpp"

#include "../../utils/binary.hpp"
#include "../../utils/query.hpp"
#include "../detail.hpp"

#include <initializer_list>
#include <ranges>

static constexpr float DEFAULT_RANGE_TOLERANCE = 0.05f;

[[nodiscard]] auto trim_spaces(std::string_view value) -> std::string {
    size_t start = 0;
    size_t end = value.size();

    while (start < end && value[start] == ' ') {
        start++;
    }

    while (end > start && value[end - 1] == ' ') {
        end--;
    }

    return std::string(value.substr(start, end - start));
}

[[nodiscard]] auto token_to_text(const QueryToken& token) -> std::string {
    std::string value = token.value;

    if (value.find(' ') != std::string::npos) {
        value = "\"" + value + "\"";
    }

    switch (token.op) {
        case QueryOp::EQ:
            return token.key + "=" + value;
        case QueryOp::NEQ:
            return token.key + "!=" + value;
        case QueryOp::GT:
            return token.key + ">" + value;
        case QueryOp::GTE:
            return token.key + ">=" + value;
        case QueryOp::LT:
            return token.key + "<" + value;
        case QueryOp::LTE:
            return token.key + "<=" + value;
        default:
            return token.key;
    }
}

[[nodiscard]] auto parse_status_value(std::string_view value) -> int {
    if (value == "u" || value == "unknown") {
        return static_cast<int>(BeatmapStatus::UKNOWN);
    }

    if (value == "n" || value == "notsubmitted" || value == "unsubmitted") {
        return static_cast<int>(BeatmapStatus::UNSUBMITTED);
    }

    if (value == "graveyard") {
        return static_cast<int>(BeatmapStatus::GRAVEYARD);
    }

    if (value == "wip") {
        return static_cast<int>(BeatmapStatus::WIP);
    }

    if (value == "p" || value == "pending") {
        return static_cast<int>(BeatmapStatus::PENDING);
    }

    if (value == "r" || value == "ranked") {
        return static_cast<int>(BeatmapStatus::RANKED);
    }

    if (value == "a" || value == "approved") {
        return static_cast<int>(BeatmapStatus::APPROVED);
    }

    if (value == "qualified") {
        return static_cast<int>(BeatmapStatus::QUALIFIED);
    }

    if (value == "l" || value == "loved") {
        return static_cast<int>(BeatmapStatus::LOVED);
    }

    return binary::convert_to<int>(value, static_cast<int>(BeatmapStatus::UKNOWN));
}

void FilterCriteria::reset() {
    title.clear();
    artist.clear();
    creator.clear();
    difficulty.clear();
    source.clear();
    query.clear();
    status.clear();
    star_rating.clear();
    approach_rate.clear();
    circle_size.clear();
    overall_difficulty.clear();
    hp_drain.clear();
    sort = SortMode::Title;
}

bool FilterCriteria::try_update_criteria_text(CriteriaText& text, QueryOp op, std::string_view value) {
    text.clear();

    if (op != QueryOp::EQ && op != QueryOp::NEQ) {
        return false;
    }

    text.exclude = op == QueryOp::NEQ;
    text.value = trim_spaces(value);
    return !text.value.empty();
}

bool FilterCriteria::try_update_criteria_range(CriteriaRange& range, QueryOp op, std::string_view value) {
    const float parsed_value = binary::convert_to<float>(value, 0.0f);

    range.clear();

    switch (op) {
        case QueryOp::EQ:
        case QueryOp::NEQ: {
            range.has_min = true;
            range.has_max = true;
            range.min = parsed_value - DEFAULT_RANGE_TOLERANCE;
            range.max = parsed_value + DEFAULT_RANGE_TOLERANCE;
            range.invert = op == QueryOp::NEQ;
            return true;
        }

        case QueryOp::GTE: {
            range.has_min = true;
            range.min = parsed_value - DEFAULT_RANGE_TOLERANCE;
            return true;
        }

        case QueryOp::GT: {
            range.has_min = true;
            range.min = parsed_value + DEFAULT_RANGE_TOLERANCE;
            return true;
        }

        case QueryOp::LTE: {
            range.has_max = true;
            range.max = parsed_value + DEFAULT_RANGE_TOLERANCE;
            return true;
        }

        case QueryOp::LT: {
            range.has_max = true;
            range.max = parsed_value - DEFAULT_RANGE_TOLERANCE;
            return true;
        }

        default:
            return false;
    }
}

bool FilterCriteria::try_update_criteria_set(CriteriaSet<int>& set, QueryOp op, std::string_view value) {
    set.clear();

    if (op != QueryOp::EQ && op != QueryOp::NEQ) {
        return false;
    }

    set.exclude = op == QueryOp::NEQ;

    for (const auto& part : value | std::views::split(',')) {
        const std::string_view raw_value(part.begin(), part.end());
        const std::string normalized_value = trim_spaces(raw_value);

        if (normalized_value.empty()) {
            continue;
        }

        set.values.push_back(parse_status_value(normalized_value));
    }

    return set.has_filter();
}

bool FilterCriteria::try_update_criteria(const QueryToken& token) {
    if (token.key == "artist") {
        return try_update_criteria_text(artist, token.op, token.value);
    }

    if (token.key == "title") {
        return try_update_criteria_text(title, token.op, token.value);
    }

    if (token.key == "source") {
        return try_update_criteria_text(source, token.op, token.value);
    }

    if (token.key == "creator" || token.key == "author" || token.key == "mapper") {
        return try_update_criteria_text(creator, token.op, token.value);
    }

    if (token.key == "difficulty" || token.key == "diff") {
        return try_update_criteria_text(difficulty, token.op, token.value);
    }

    if (token.key == "ar") {
        return try_update_criteria_range(approach_rate, token.op, token.value);
    }

    if (token.key == "cs") {
        return try_update_criteria_range(circle_size, token.op, token.value);
    }

    if (token.key == "od") {
        return try_update_criteria_range(overall_difficulty, token.op, token.value);
    }

    if (token.key == "hp" || token.key == "dr") {
        return try_update_criteria_range(hp_drain, token.op, token.value);
    }

    if (token.key == "star" || token.key == "stars" || token.key == "sr") {
        return try_update_criteria_range(star_rating, token.op, token.value);
    }

    if (token.key == "status") {
        return try_update_criteria_set(status, token.op, token.value);
    }

    return false;
}

bool FilterCriteria::parse_query(std::string_view source_query) {
    reset();

    const ParsedQuery parsed = query::parse(source_query);
    std::string remaining_query = trim_spaces(parsed.content);

    for (const auto& token : parsed.tokens) {
        if (try_update_criteria(token)) {
            continue;
        }

        if (!remaining_query.empty()) {
            remaining_query += ' ';
        }

        remaining_query += token_to_text(token);
    }

    query = trim_spaces(remaining_query);
    return true;
}

bool FilterCriteria::matches_text(std::string_view source, const CriteriaText& text) const {
    if (!text.has_filter()) {
        return true;
    }

    if (source.empty()) {
        return text.exclude;
    }

    const bool found = binary::normalize_and_lower(source).find(text.value) != std::string::npos;
    return text.exclude ? !found : found;
}

bool FilterCriteria::matches_text_any(std::initializer_list<std::string_view> values, const CriteriaText& text) const {
    if (!text.has_filter()) {
        return true;
    }

    if (text.exclude) {
        for (std::string_view value : values) {
            if (!matches_text(value, text)) {
                return false;
            }
        }

        return true;
    }

    for (std::string_view value : values) {
        if (matches_text(value, text)) {
            return true;
        }
    }

    return false;
}
