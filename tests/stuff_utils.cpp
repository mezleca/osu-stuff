#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <latch>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <vector>

#include "utils/thread_pool.hpp"

constexpr int TASK_COUNT = 16;
constexpr int PRODUCER_COUNT = 4;
constexpr int TASKS_PER_PRODUCER = 8;
constexpr auto WAIT_TIMEOUT = std::chrono::seconds(2);

TEST_CASE("thread pool", "[utils][thread_pool]") {
    SECTION("executes queued backlog after workers become available") {
        ThreadPool pool;
        pool.initialize();

        const int worker_count = std::clamp(static_cast<int>(std::thread::hardware_concurrency()), 1, 4);
        std::latch workers_started(worker_count);
        std::promise<void> unblock_promise;
        auto unblock = unblock_promise.get_future().share();

        std::vector<std::future<void>> held_futures;
        held_futures.reserve(worker_count);

        for (int i = 0; i < worker_count; i++) {
            held_futures.push_back(pool.enqueue([&workers_started, unblock]() {
                workers_started.count_down();
                unblock.wait();
            }));
        }

        workers_started.wait();

        std::atomic<int> backlog_count = 0;
        std::vector<std::future<int>> futures;
        futures.reserve(TASK_COUNT);

        for (int i = 0; i < TASK_COUNT; i++) {
            futures.push_back(pool.enqueue([&backlog_count, i]() {
                backlog_count.fetch_add(1);
                return i * 2;
            }));
        }

        REQUIRE(backlog_count.load() == 0);

        for (int i = 0; i < TASK_COUNT; i++) {
            REQUIRE(futures[i].wait_for(std::chrono::milliseconds(50)) == std::future_status::timeout);
        }

        unblock_promise.set_value();

        for (auto& f : held_futures) {
            REQUIRE(f.wait_for(WAIT_TIMEOUT) == std::future_status::ready);
            f.get();
        }

        for (int i = 0; i < TASK_COUNT; i++) {
            REQUIRE(futures[i].wait_for(WAIT_TIMEOUT) == std::future_status::ready);
            REQUIRE(futures[i].get() == i * 2);
        }

        REQUIRE(backlog_count.load() == TASK_COUNT);
    }

    SECTION("accepts concurrent enqueue from multiple producers") {
        ThreadPool pool;
        pool.initialize();

        std::atomic<int> task_count = 0;
        std::mutex futures_mutex;
        std::vector<std::future<int>> futures;
        futures.reserve(PRODUCER_COUNT * TASKS_PER_PRODUCER);
        std::vector<std::thread> producers;
        producers.reserve(PRODUCER_COUNT);

        for (int producer_index = 0; producer_index < PRODUCER_COUNT; producer_index++) {
            producers.emplace_back([&pool, &task_count, &futures, &futures_mutex, producer_index]() {
                for (int task_index = 0; task_index < TASKS_PER_PRODUCER; task_index++) {
                    auto future = pool.enqueue([&task_count, producer_index, task_index]() {
                        task_count.fetch_add(1);
                        return producer_index * 100 + task_index;
                    });

                    std::scoped_lock lock(futures_mutex);
                    futures.push_back(std::move(future));
                }
            });
        }

        for (auto& producer : producers) {
            producer.join();
        }

        for (auto& future : futures) {
            REQUIRE(future.wait_for(WAIT_TIMEOUT) == std::future_status::ready);
            REQUIRE(future.get() >= 0);
        }

        REQUIRE(task_count.load() == PRODUCER_COUNT * TASKS_PER_PRODUCER);
    }

    SECTION("propagates return values and exceptions through futures") {
        ThreadPool pool;
        pool.initialize();

        auto ret_future = pool.enqueue([]() { return 42; });
        auto throw_future = pool.enqueue([]() -> int { throw std::runtime_error("task failed"); });

        REQUIRE(ret_future.wait_for(WAIT_TIMEOUT) == std::future_status::ready);
        REQUIRE(ret_future.get() == 42);

        REQUIRE(throw_future.wait_for(WAIT_TIMEOUT) == std::future_status::ready);
        REQUIRE_THROWS_AS(throw_future.get(), std::runtime_error);
    }
}
