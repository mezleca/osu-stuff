#include "tasks/tasks.hpp"

#include <catch2/catch_test_macros.hpp>
#include <atomic>
#include <chrono>
#include <future>
#include <string>
#include <thread>

using namespace std::chrono_literals;

static bool drain_scheduler_until(TaskScheduler& scheduler, const std::function<bool()>& condition) {
    const auto deadline = std::chrono::steady_clock::now() + 2s;

    while (!condition() && std::chrono::steady_clock::now() < deadline) {
        scheduler.drain();
        std::this_thread::yield();
    }

    scheduler.drain();
    return condition();
}

TEST_CASE("UI task slots reject duplicate work and return handlers to the caller thread", "[ui][tasks]") {
    TaskScheduler scheduler;
    TaskSlot slot(scheduler);
    std::promise<void> release;
    auto released = release.get_future().share();
    std::atomic<bool> worker_started = false;
    bool update_received = false;
    bool completed = false;
    int value = 0;
    const std::thread::id caller_thread = std::this_thread::get_id();

    REQUIRE(slot.start(
        [&worker_started, released](TaskContext& context) {
            worker_started = true;
            context.send_update("working");
            released.wait();
            return TaskResult<int>::success(42);
        },
        [&completed, &value, caller_thread](TaskResult<int> result) {
            REQUIRE(std::this_thread::get_id() == caller_thread);
            REQUIRE(result.status == TaskStatus::Success);
            REQUIRE(result.value.has_value());
            completed = true;
            value = *result.value;
        },
        [&update_received, caller_thread](std::string update) {
            REQUIRE(std::this_thread::get_id() == caller_thread);
            REQUIRE(update == "working");
            update_received = true;
        }
    ));

    REQUIRE_FALSE(slot.start([](TaskContext&) { return TaskResult<>::success(); }));
    REQUIRE(drain_scheduler_until(scheduler, [&worker_started, &update_received] { return worker_started && update_received; }));
    REQUIRE_FALSE(completed);

    release.set_value();
    REQUIRE(drain_scheduler_until(scheduler, [&completed] { return completed; }));
    REQUIRE(value == 42);
    REQUIRE_FALSE(slot.running());
}

TEST_CASE("UI task cancellation interrupts waits and reports cancellation", "[ui][tasks]") {
    TaskScheduler scheduler;
    TaskSlot slot(scheduler);
    std::atomic<bool> worker_started = false;
    bool completed = false;
    TaskStatus status = TaskStatus::Success;

    REQUIRE(slot.start(
        [&worker_started](TaskContext& context) {
            worker_started = true;
            static_cast<void>(context.wait_for(10s));
            return TaskResult<>::success();
        },
        [&completed, &status](TaskResult<> result) {
            completed = true;
            status = result.status;
        }
    ));

    REQUIRE(drain_scheduler_until(scheduler, [&worker_started] { return worker_started.load(); }));
    REQUIRE(slot.cancel());
    REQUIRE_FALSE(slot.cancel());
    REQUIRE(drain_scheduler_until(scheduler, [&completed] { return completed; }));
    REQUIRE(status == TaskStatus::Cancelled);
}

TEST_CASE("UI task exceptions become failed results", "[ui][tasks]") {
    TaskScheduler scheduler;
    TaskSlot slot(scheduler);
    bool completed = false;
    std::optional<std::string> reason;

    REQUIRE(slot.start(
        [](TaskContext&) -> TaskResult<> { throw std::runtime_error("request failed"); },
        [&completed, &reason](TaskResult<> result) {
            REQUIRE(result.status == TaskStatus::Failure);
            completed = true;
            reason = std::move(result.reason);
        }
    ));

    REQUIRE(drain_scheduler_until(scheduler, [&completed] { return completed; }));
    REQUIRE(reason == "request failed");
}
