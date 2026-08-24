#pragma once

#include "thread-pool.hpp"

#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <exception>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <queue>
#include <string>
#include <type_traits>
#include <utility>

enum class TaskStatus {
    Success,
    Failure,
    Cancelled,
};

template <typename T = void>
struct TaskResult {
    TaskStatus status;
    std::optional<T> value;
    std::optional<std::string> reason;

    static TaskResult success(T value) {
        return {TaskStatus::Success, std::move(value), std::nullopt};
    }

    static TaskResult failure(std::optional<std::string> reason = std::nullopt) {
        return {TaskStatus::Failure, std::nullopt, std::move(reason)};
    }

    static TaskResult cancelled(std::optional<std::string> reason = std::nullopt) {
        return {TaskStatus::Cancelled, std::nullopt, std::move(reason)};
    }
};

template <>
struct TaskResult<void> {
    TaskStatus status;
    std::optional<std::string> reason;

    static TaskResult success() {
        return {TaskStatus::Success, std::nullopt};
    }

    static TaskResult failure(std::optional<std::string> reason = std::nullopt) {
        return {TaskStatus::Failure, std::move(reason)};
    }

    static TaskResult cancelled(std::optional<std::string> reason = std::nullopt) {
        return {TaskStatus::Cancelled, std::move(reason)};
    }
};

using TaskUpdateHandler = std::function<void(std::string)>;

struct TaskSlotState {
    mutable std::mutex mutex;
    std::condition_variable cancellation_changed;
    uint64_t generation = 0;
    bool running = false;
    bool cancellation_requested = false;
    bool alive = true;
};

class TaskSchedulerState {
public:
    void add(std::function<void()> callback);
    std::queue<std::function<void()>> take_callbacks();
    void close();

private:
    std::mutex m_mutex;
    std::queue<std::function<void()>> m_callbacks;
    bool m_accepting = true;
};

class TaskContext {
public:
    [[nodiscard]] bool cancelled() const;
    [[nodiscard]] bool wait_for(std::chrono::milliseconds duration) const;
    void send_update(std::string update) const;

private:
    friend class TaskScheduler;

    TaskContext(
        std::shared_ptr<TaskSlotState> slot, std::shared_ptr<TaskSchedulerState> scheduler, uint64_t generation,
        TaskUpdateHandler update_handler
    );

    std::shared_ptr<TaskSlotState> m_slot;
    std::shared_ptr<TaskSchedulerState> m_scheduler;
    uint64_t m_generation;
    TaskUpdateHandler m_update_handler;
};

class TaskSlot;

class TaskScheduler {
public:
    TaskScheduler();
    ~TaskScheduler();

    TaskScheduler(const TaskScheduler&) = delete;
    TaskScheduler& operator=(const TaskScheduler&) = delete;

    void drain();

private:
    friend class TaskSlot;

    template <typename Work, typename Completion>
    bool
    start(const std::shared_ptr<TaskSlotState>& slot, Work&& work, Completion&& completion, TaskUpdateHandler update_handler) {
        using Result = std::invoke_result_t<Work, TaskContext&>;

        uint64_t generation;
        {
            std::scoped_lock lock(slot->mutex);
            if (!slot->alive || slot->running) {
                return false;
            }

            // reserve the slot before enqueueing so duplicate starts are rejected atomically.
            slot->running = true;
            slot->cancellation_requested = false;
            generation = ++slot->generation;
        }

        try {
            static_cast<void>(m_workers.enqueue([slot, scheduler = m_state, generation, work = std::forward<Work>(work),
                                                 completion = std::forward<Completion>(completion),
                                                 update_handler = std::move(update_handler)]() mutable {
                TaskContext context(slot, scheduler, generation, std::move(update_handler));
                Result result = [&]() -> Result {
                    try {
                        return std::invoke(work, context);
                    } catch (const std::exception& error) {
                        return Result::failure(error.what());
                    } catch (...) {
                        return Result::failure("unknown task failure");
                    }
                }();

                if (context.cancelled()) {
                    result = Result::cancelled();
                }

                // queue completion so user handlers only run from drain().
                scheduler->add([slot, generation, completion = std::move(completion), result = std::move(result)]() mutable {
                    bool should_complete;
                    {
                        std::scoped_lock lock(slot->mutex);
                        if (slot->generation != generation || !slot->running) {
                            return;
                        }

                        slot->running = false;
                        should_complete = slot->alive;
                    }

                    if (should_complete) {
                        std::invoke(completion, std::move(result));
                    }
                });
            }));
        } catch (...) {
            std::scoped_lock lock(slot->mutex);
            slot->running = false;
            throw;
        }

        return true;
    }

    std::shared_ptr<TaskSchedulerState> m_state;
    ThreadPool m_workers;
};

class TaskSlot {
public:
    explicit TaskSlot(TaskScheduler& scheduler);
    ~TaskSlot();

    TaskSlot(const TaskSlot&) = delete;
    TaskSlot& operator=(const TaskSlot&) = delete;

    template <typename Work, typename Completion>
    bool start(Work&& work, Completion&& completion, TaskUpdateHandler update_handler = {}) {
        return m_scheduler.start(
            m_state, std::forward<Work>(work), std::forward<Completion>(completion), std::move(update_handler)
        );
    }

    template <typename Work>
    bool start(Work&& work, TaskUpdateHandler update_handler = {}) {
        using Result = std::invoke_result_t<Work, TaskContext&>;
        return start(std::forward<Work>(work), [](Result) {}, std::move(update_handler));
    }

    [[nodiscard]] bool running() const;
    bool cancel();

private:
    TaskScheduler& m_scheduler;
    std::shared_ptr<TaskSlotState> m_state;
};
