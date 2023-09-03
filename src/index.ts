type Executor = (
  resolve: (value?: unknown) => void,
  reject: (reason?: unknown) => void,
) => void;

type PromiseState = "pending" | "fulfilled" | "rejected";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ToyLevelPromise {
  #state: PromiseState;
  #value: unknown;
  #onFulfilled: (value?: unknown) => unknown = (value: unknown): unknown => {
    return value;
  };
  #onRejected: (reason?: unknown) => unknown = (reason: unknown): unknown => {
    throw reason;
  };
  children: ToyLevelPromise[] = [];

  constructor(executor: Executor) {
    if (typeof executor !== "function") {
      throw new TypeError("executor must be a function");
    }

    this.#state = "pending";
    this.#value = undefined;

    try {
      executor(this.resolve.bind(this), this.reject.bind(this));
    } catch (e) {
      this.reject(e);
    }
  }

  private resolve(value?: unknown): void {
    if (this.#state !== "pending") return;

    this.#state = "fulfilled";
    this.#value = value;

    queueMicrotask(() => {
      let result, error;
      try {
        result = this.#onFulfilled(this.#value);
      } catch (e) {
        error = e;
      }

      for (const child of this.children) {
        if (error) {
          child.reject(error);
        } else {
          child.resolve(result);
        }
      }
    });
  }

  private reject(reason?: unknown): void {
    if (this.#state !== "pending") return;

    this.#state = "rejected";
    this.#value = reason;

    queueMicrotask(() => {
      let result, error;
      try {
        result = this.#onRejected(this.#value);
      } catch (e) {
        error = e;
      }

      if (this.children.length === 0) {
        throw new Error("UnhandledPromiseRejectionWarning");
      }

      for (const child of this.children) {
        if (error) {
          child.reject(error);
        } else {
          child.resolve(result);
        }
      }
    });
  }

  public then(
    onFulfilled?: (value?: unknown) => unknown,
    onRejected?: (reason?: unknown) => unknown,
  ): ToyLevelPromise {
    if (typeof onFulfilled === "function") {
      this.#onFulfilled = onFulfilled;
    }
    if (typeof onRejected === "function") {
      this.#onRejected = onRejected;
    }

    const child = new ToyLevelPromise(() => {});

    switch (this.#state) {
      case "fulfilled":
        queueMicrotask(() => {
          try {
            const result = this.#onFulfilled(this.#value);
            child.resolve(result);
          } catch (e) {
            child.reject(e);
          }
        });
        break;
      case "rejected":
        queueMicrotask(() => {
          try {
            const result = this.#onRejected(this.#value);
            child.resolve(result);
          } catch (e) {
            child.reject(e);
          }
        });
        break;
      case "pending":
        this.children.push(child);
        break;
    }

    return child;
  }
}

const success = new ToyLevelPromise((resolve) => {
  setTimeout(() => {
    resolve("Hello World");
  }, 1000);
});

success.then((value) => {
  console.log(value);
});

const failure = new ToyLevelPromise((_, reject) => {
  setTimeout(() => {
    reject(new Error("Error"));
  }, 1000);
});

failure.then(undefined, (reason) => {
  console.log(reason);
});

const failure2 = new ToyLevelPromise((_, reject) => {
  setTimeout(() => {
    reject(new Error("Unhandled Error"));
  }, 1000);
});

failure2.then((value) => {
  console.log(value);
});
