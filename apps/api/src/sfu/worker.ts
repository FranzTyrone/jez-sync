import * as mediasoup from "mediasoup";

let worker: mediasoup.types.Worker;

export async function createWorker() {
  worker = await mediasoup.createWorker({
    logLevel: "warn",
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });

  worker.on("died", () => {
    console.error("mediasoup worker died, exiting in 2 seconds...");
    setTimeout(() => process.exit(1), 2000);
  });

  console.log("mediasoup Worker created, PID:", worker.pid);
  return worker;
}

export function getWorker() {
  if (!worker) {
    throw new Error("mediasoup worker not yet created");
  }
  return worker;
}