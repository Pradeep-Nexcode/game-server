import { client } from "./client";
import { Session, Socket } from "@heroiclabs/nakama-js";

let socket: Socket | null = null;

export const getSocket = () => socket;

export const createSocket = (useSSL: boolean = false, verbose: boolean = true) => {
    socket = client.createSocket(useSSL, verbose);
    return socket;
}

export const connectSocket = async (session: Session) => {
    if (!socket) {
        createSocket(false, true);
    }
    if (!socket) throw new Error("Failed to create socket");
    
    try {
        await socket.connect(session, true);
        console.log("Socket connected");
        return socket;
    } catch (err) {
        console.error("Socket connection failed:", err);
        throw err;
    }
}

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
