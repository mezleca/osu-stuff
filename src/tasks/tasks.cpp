#include "tasks.hpp"

#include <utility>

void TaskSchedulerState::add(std::function<void()> callback) {
    std::scoped_lock lock(m_mutex);
    if (m_accepting) {
        m_callbacks.push(std::move(callback));
    }
}

std::queue<std::function<void()>> TaskSchedulerState::take_callbacks() {
    std::queue<std::function<void()>> callbacks;

    std::scoped_lock lock(m_mutex);
    callbacks.swap(m_callbacks);
    return callbacks;
}

void TaskSchedulerState::close() {
    std::scoped_lock lock(m_mutex);
    m_accepting = false;
    while (!m_callbacks.empty()) {
        m_callbacks.pop();
    }
}

TaskContext::TaskContext(
    std::shared_ptr<TaskSlotState> slot, std::shared_ptr<TaskSchedulerState> scheduler, uint64_t generation,
    TaskUpdateHandler update_handler
)
    : m_slot(std::move(slot)), m_scheduler(std::move(scheduler)), m_generation(generation),
      m_update_handler(std::move(update_handler)) {}

bool TaskContext::cancelled() const {
    std::scoped_lock lock(m_slot->mutex);
    return !m_slot->alive || m_slot->generation != m_generation || m_slot->cancellation_requested;
}

bool TaskContext::wait_for(std::chrono::milliseconds duration) const {
    std::unique_lock lock(m_slot->mutex);
    const bool interrupted = m_slot->cancellation_changed.wait_for(lock, duration, [this] {
        return !m_slot->alive || m_slot->generation != m_generation || m_slot->cancellation_requested;
    });
    return !interrupted;
}

void TaskContext::send_update(std::string update) const {
    if (!m_update_handler || cancelled()) {
        return;
    }

    m_scheduler->add([slot = std::weak_ptr<TaskSlotState>(m_slot), generation = m_generation,
                      handler = m_update_handler, update = std::move(update)]() mutable {
        const auto state = slot.lock();
        if (state == nullptr) {
            return;
        }

        {
            std::scoped_lock lock(state->mutex);
            if (!state->alive || !state->running || state->generation != generation) {
                return;
            }
        }

        handler(std::move(update));
    });
}

TaskScheduler::TaskScheduler() : m_state(std::make_shared<TaskSchedulerState>()) {
    m_workers.initialize();
}

TaskScheduler::~TaskScheduler() {
    m_state->close();
}

void TaskScheduler::drain() {
    auto callbacks = m_state->take_callbacks();
    while (!callbacks.empty()) {
        callbacks.front()();
        callbacks.pop();
    }
}

TaskSlot::TaskSlot(TaskScheduler& scheduler) : m_scheduler(scheduler), m_state(std::make_shared<TaskSlotState>()) {}

TaskSlot::~TaskSlot() {
    {
        std::scoped_lock lock(m_state->mutex);
        m_state->alive = false;
        m_state->cancellation_requested = true;
    }
    m_state->cancellation_changed.notify_all();
}

bool TaskSlot::running() const {
    std::scoped_lock lock(m_state->mutex);
    return m_state->running;
}

bool TaskSlot::cancel() {
    {
        std::scoped_lock lock(m_state->mutex);
        if (!m_state->running || m_state->cancellation_requested) {
            return false;
        }

        m_state->cancellation_requested = true;
    }

    m_state->cancellation_changed.notify_all();
    return true;
}
