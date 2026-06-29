#pragma once

#include <climits>
#include <string>
#include <string_view>
#include <vector>

enum class QueryOp : int {
    INVALID = -1,
    EQ,
    NEQ,
    GT,
    LT,
    GTE,
    LTE
};

enum class ParseState : int {
    KEY = 0,
    VALUE
};

struct OpStartTable {
    bool data[256]{};

    constexpr OpStartTable() {
        data['>'] = true;
        data['<'] = true;
        data['='] = true;
        data['!'] = true;
    }

    constexpr bool operator[](unsigned char c) const {
        return data[c];
    }
};

constexpr OpStartTable OP_START_TABLE{};

struct QueryToken {
    std::string key;
    std::string value;
    QueryOp op;
};

struct QueryState {
    size_t key_start;
    size_t op_start;
    size_t op_end;
    size_t value_end;

    bool in_quotes = false;

    ParseState value = ParseState::KEY;
    QueryOp op = QueryOp::INVALID;
    QueryToken token = {};

    void reset() {
        value = ParseState::KEY;
        in_quotes = false;

        key_start = INT_MAX; // uhhh
        op_start = 0;
        op_end = 0;
        value_end = 0;
    }
};

struct ParsedQuery {
    std::vector<QueryToken> tokens;
    std::string content;
};

namespace query {
    inline std::pair<QueryOp, size_t> parse_operator(std::string_view sv, size_t pos) {
        char c1 = sv[pos];
        char c2 = sv[pos + 1];

        switch (c1) {
            case '>': {
                if (c2 == '=') {
                    return {QueryOp::GTE, 2};
                }

                return {QueryOp::GT, 1};
            }

            case '<': {
                if (c2 == '=') {
                    return {QueryOp::LTE, 2};
                }

                return {QueryOp::LT, 1};
            }

            case '=': {
                if (c2 == '=') { // variation
                    return {QueryOp::EQ, 2};
                }

                return {QueryOp::EQ, 1};
            }

            case '!': {
                if (c2 == '=') {
                    return {QueryOp::NEQ, 2};
                }

                return {QueryOp::INVALID, 1};
            }
        }

        return {QueryOp::INVALID, 0};
    }

    inline ParsedQuery parse(std::string_view data) {
        ParsedQuery result;
        QueryState m_state;

        m_state.reset();

        for (size_t i = 0; i < data.length(); i++) {
            bool is_last = data.length() - 1 == i;
            char c = data[i];

            switch (m_state.value) {
                case ParseState::KEY: {
                    if (m_state.key_start == INT_MAX) {
                        m_state.key_start = i;
                    }

                    // free text
                    if (c == ' ') {
                        result.content += data.substr(m_state.key_start, i - m_state.key_start);
                        result.content += ' ';
                        m_state.reset();
                        continue;
                    }

                    // is a operator?
                    if (m_state.key_start < i && OP_START_TABLE[static_cast<unsigned char>(c)]) {
                        auto [op, size] = parse_operator(data, i);

                        // invalidate duplicated op's
                        if (!is_last && c != '=' && data[i + 1] == c) {
                            result.content += data.substr(m_state.key_start, i - m_state.key_start);
                            m_state.reset();
                        } else {
                            m_state.op = op;
                            m_state.value = ParseState::VALUE;
                            m_state.op_start = i;
                            m_state.op_end = m_state.op_start + size;
                        }
                    }

                    // flush last word as free text if no operator found
                    if (is_last) {
                        result.content += data.substr(m_state.key_start);
                    }
                } break;
                case ParseState::VALUE: {
                    m_state.value_end = i;
                    bool is_char_quote = c == '"';

                    // skip on opening quote
                    if (!m_state.in_quotes && is_char_quote) {
                        m_state.in_quotes = true;
                        continue;
                    }

                    bool is_ending_quote = m_state.in_quotes && is_char_quote;
                    bool is_separator = !m_state.in_quotes && c == ' ';
                    bool is_unquoted_last = !m_state.in_quotes && is_last;
                    bool has_value = is_ending_quote || is_separator || is_unquoted_last;

                    if (!has_value) {
                        continue;
                    }

                    size_t value_start = m_state.op_end;
                    size_t value_length = m_state.value_end - value_start;

                    if (is_ending_quote) {
                        value_start += 1;
                        value_length -= 1;
                    } else if (is_unquoted_last) {
                        value_length += 1; // include last char
                    }

                    result.tokens.push_back({
                        .key = std::string(data.substr(m_state.key_start, m_state.op_start - m_state.key_start)),
                        .value = std::string(data.substr(value_start, value_length)),
                        .op = m_state.op,
                    });

                    m_state.reset();
                } break;
            }
        }

        return result;
    }
} // namespace query
