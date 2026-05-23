#pragma once

#include <algorithm>
#include <initializer_list>
#include <string>
#include <string_view>
#include <vector>

#include "../../utils/query.hpp"

enum class SortMode : int {
    Artist = 0,
    Title,
    Bpm,
    Duration,
    Length,
};

struct CriteriaRange {
    float min = 0;
    float max = 0;
    bool has_min = false;
    bool has_max = false;
    bool invert = false;

    void clear() {
        min = 0;
        max = 0;
        has_min = false;
        has_max = false;
        invert = false;
    }

    [[nodiscard]] bool has_filter() const {
        return has_min || has_max;
    }

    [[nodiscard]] bool matches(double value) const {
        bool result = true;

        if (has_min) {
            result = result && value >= min;
        }

        if (has_max) {
            result = result && value <= max;
        }

        return invert ? !result : result;
    }
};

struct CriteriaText {
    std::string value;
    bool exclude = false;

    void clear() {
        value.clear();
        exclude = false;
    }

    [[nodiscard]] bool has_filter() const {
        return !value.empty();
    }
};

template <typename T>
struct CriteriaSet {
    std::vector<T> values;
    bool exclude = false;

    void clear() {
        values.clear();
        exclude = false;
    }

    [[nodiscard]] bool has_filter() const {
        return !values.empty();
    }

    [[nodiscard]] bool matches(T value) const {
        const bool found = std::find(values.begin(), values.end(), value) != values.end();
        return exclude ? !found : found;
    }
};

struct FilterCriteria {
    CriteriaText title;
    CriteriaText artist;
    CriteriaText creator;
    CriteriaText difficulty;
    CriteriaText source;

    std::string query;

    CriteriaSet<int> status;

    CriteriaRange star_rating;
    CriteriaRange approach_rate;
    CriteriaRange circle_size;
    CriteriaRange overall_difficulty;
    CriteriaRange hp_drain;

    SortMode sort = SortMode::Title;

    void reset();

    bool try_update_criteria_text(CriteriaText& text, QueryOp op, std::string_view value);
    bool try_update_criteria_range(CriteriaRange& range, QueryOp op, std::string_view value);
    bool try_update_criteria_set(CriteriaSet<int>& text, QueryOp op, std::string_view value);

    [[nodiscard]] bool matches_text(std::string_view source, const CriteriaText& text) const;
    [[nodiscard]] bool matches_text_any(std::initializer_list<std::string_view> values, const CriteriaText& text) const;

    bool try_update_criteria(const QueryToken& token);
    bool parse_query(std::string_view query);
};
