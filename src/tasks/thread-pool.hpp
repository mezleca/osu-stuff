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

struct ThreadPool {
public:
    void initialize();
    ~ThreadPool();

    template <class F, class... Args>
    auto enqueue(F&& f, Args&&... args) -> std::future<std::invoke_result_t<F, Args...>> {
        using return_type = std::invoke_result_t<F, Args...>;

        auto task =
            std::make_shared<std::packaged_task<return_type()>>(std::bind(std::forward<F>(f), std::forward<Args>(args)...));

        auto result = task->get_future();

        {
            std::unique_lock<std::mutex> lock(queue_mutex);

            if (stop) {
                throw std::runtime_error("enqueue on stopped ThreadPool");
            }

            tasks.emplace([task] { (*task)(); });
        }

        cv.notify_one();
        return result;
    }

private:
    bool stop = false;
    std::vector<std::thread> workers;
    std::queue<std::function<void()>> tasks;
    std::mutex queue_mutex;
    std::condition_variable cv;
};
