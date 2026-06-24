#pragma once

#include <condition_variable>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <queue>
#include <stdexcept>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

struct TaskBase {
    virtual void execute() = 0;
    virtual ~TaskBase() = default;
};

template <typename F>
struct Task : TaskBase {
public:
    explicit Task(F&& f) : func(std::move(f)) {
    }
    void execute() {
        func();
    }

private:
    F func;
};

struct ThreadPool {
public:
    void initialize();
    ~ThreadPool();

    template <class F, class... Args>
    auto enqueue(F&& f, Args&&... args) -> std::future<std::invoke_result_t<F, Args...>> {
        using return_type = std::invoke_result_t<F, Args...>;

        auto task = std::make_shared<std::packaged_task<return_type()>>(
            std::bind(std::forward<F>(f), std::forward<Args>(args)...));

        auto result = task->get_future();

        {
            std::unique_lock<std::mutex> lock(queue_mutex);

            if (stop) {
                throw std::runtime_error("enqueue on stopped ThreadPool");
            }

            auto wrapped_task = [task]() { (*task)(); };

            tasks.emplace(std::make_unique<Task<decltype(wrapped_task)>>(std::move(wrapped_task)));
        }

        cv.notify_one();
        return result;
    }

private:
    bool stop = false;
    std::vector<std::thread> workers;
    std::queue<std::unique_ptr<TaskBase>> tasks;
    std::mutex queue_mutex;
    std::condition_variable cv;
} inline g_thread_pool;
