export async function readCalendarReceipt(child, url) {
  let nextId = 0;
  let buffer = Buffer.alloc(0);
  const pending = new Map();
  const fail = (error) => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  };
  child.stdio[3].on("error", fail);
  child.stdio[4].on("error", fail);
  child.stdio[4].on("close", () => fail(new Error("Chrome protocol pipe closed before response")));
  child.stdio[4].on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let end;
    while ((end = buffer.indexOf(0)) !== -1) {
      const messageBytes = buffer.subarray(0, end);
      buffer = buffer.subarray(end + 1);
      let message;
      try {
        message = JSON.parse(messageBytes.toString("utf8"));
      } catch (error) {
        fail(error);
        return;
      }
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.accept(message.result);
    }
  });
  const write = (message) => child.stdio[3].write(JSON.stringify(message) + "\0");
  const send = (method, params = {}, sessionId) => new Promise((accept, reject) => {
    const id = ++nextId;
    pending.set(id, { accept, reject });
    write({ id, method, params, ...(sessionId ? { sessionId } : {}) });
  });
  const { targetId } = await send("Target.createTarget", { url });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  let receipt;
  while (!receipt) {
    const result = await send("Runtime.evaluate", {
      expression: '(() => { const r = document.querySelector("#calendar-test-result"); return r ? {status:r.dataset.status, encoded:r.textContent} : null; })()',
      returnByValue: true,
    }, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    receipt = result.result.value;
    if (!receipt) await new Promise((accept) => setTimeout(accept, 50));
  }
  write({ id: ++nextId, method: "Browser.close" });
  return receipt;
}
