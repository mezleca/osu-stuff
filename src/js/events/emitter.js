export class event_emitter {
  constructor() {
      this.listeners = {};
  }

  on(event, callback) {
      if (!this.listeners[event]) {
          this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
  }

  emit(event, ...args) {
      if (this.listeners[event]) {
          this.listeners[event].forEach(callback => callback(...args));
      }
  }

  remove_listener(event, callback) {
      if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter(cb => cb != callback);
      }
  }

  remove_all_listeners(event) {
      if (event) {
          delete this.listeners[event];
          return;
      }
      this.listeners = {};
  }
}

export const events = new event_emitter();
