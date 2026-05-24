#include "thread_pool.hpp"

#include <algorithm>

void ThreadPool::initialize() {
    if (!workers.empty()) {
        return;
    }

    const auto thread_count = static_cast<int>(std::thread::hardware_concurrency());
    const auto count = std::clamp(thread_count, 1, 4);

    for (int i = 0; i < count; i++) {
        workers.emplace_back([this]() {
            while (true) {
                std::unique_ptr<TaskBase> task;

                {
                    std::unique_lock<std::mutex> lock(queue_mutex);

                    cv.wait(lock, [this] { return stop || !tasks.empty(); });

                    if (stop && tasks.empty()) {
                        break;
                    }

                    task = std::move(tasks.front());
                    tasks.pop();
                }

                task->execute();
            }
        });
    }
}

ThreadPool::~ThreadPool() {
    {
        std::unique_lock<std::mutex> lock(queue_mutex);
        stop = true;
    }

    cv.notify_all();

    for (std::thread& t : workers) {
        t.join();
    }
}
