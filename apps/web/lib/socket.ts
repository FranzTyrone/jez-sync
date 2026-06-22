import { io, Socket } from "socket.io-client";
import { getApiUrl } from "./config";

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(getApiUrl(), {
      autoConnect: false,
    });
  }
  return socketInstance;
}

export function resetSocket() {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }
}