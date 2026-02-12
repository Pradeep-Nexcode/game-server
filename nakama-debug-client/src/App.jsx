import { useEffect, useState } from "react";
import client from "./lib/nakama";
import Menu from "./components/Menu";
import Lobby from "./components/Lobby";
import Game from "./components/Game";

// OpCodes
const OP_CODE = {
  CHAT: 1,
  READY_TOGGLE: 2,
  START_GAME: 3,
  LOBBY_STATE_UPDATE: 100,
  ERROR: 0
};

function App() {
  const [session, setSession] = useState(null);
  const [socket, setSocket] = useState(null);

  // UI State: menu | lobby | game
  const [screen, setScreen] = useState("menu");

  // Match State
  const [matchId, setMatchId] = useState("");
  const [inputMatchId, setInputMatchId] = useState("");
  const [lobbyState, setLobbyState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const deviceId = crypto.randomUUID();
        const session = await client.authenticateDevice(deviceId, true);
        setSession(session);

        const socket = client.createSocket(false, false);
        await socket.connect(session, true);
        setSocket(socket);

        console.log("Connected as:", session.username, "ID:", session.user_id);

        socket.onmatchdata = (data) => {
          const opCode = data.op_code;
          const payloadString = new TextDecoder().decode(data.data);
          const payload = payloadString ? JSON.parse(payloadString) : null;

          if (opCode === 100) {
            console.log("[SERVER SNAPSHOT] OpCode 100:", payload);
            setLobbyState(payload);

            // 🔥 Navigation Logic
            if (payload.phase === "in_game") {
              setScreen("game");
            } else if (payload.phase === "lobby") {
              setScreen("lobby");
            }
          } else if (opCode === OP_CODE.CHAT) {
            console.log("[CHAT] Received:", payload);
            setMessages(prev => [...prev, payload]);
          } else if (opCode === OP_CODE.ERROR) {
            console.error("[MATCH ERROR]:", payload.message);
            setError(payload.message);
            setTimeout(() => setError(null), 3000);
          }
        };

      } catch (e) {
        console.error("Connection failed:", e);
      }
    }

    init();
  }, []);

  const createMatch = async () => {
    if (!socket) return;
    try {
      // 🔥 Step 1: Call RPC to create an AUTHORITATIVE match on the server
      const response = await client.rpc(session, "create_match", {});
      const matchId = response.payload.match_id;

      console.log("Authoritative match created via RPC:", matchId);

      // 🔥 Step 2: Join the authoritative match
      const match = await socket.joinMatch(matchId);

      setMatchId(match.match_id);
      setScreen("lobby");

      // Removed local pre-population. Server is source of truth.
      console.log("Joined authoritative match:", match.match_id);
    } catch (e) {
      console.error("Failed to create match:", e);
    }
  };

  const joinMatch = async (id) => {
    if (!socket || !id) return;
    try {
      const match = await socket.joinMatch(id);
      setMatchId(match.match_id);
      setScreen("lobby");

      // Removed local pre-population. Server is source of truth.
      console.log("Joined match:", match.match_id);
    } catch (e) {
      console.error("Failed to join match:", e);
      setError("Match not found or full");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleReady = async () => {
    if (!socket || !matchId) return;
    console.log("[LOBBY] Sending READY toggle to server...");
    try {
      // 🔥 FIX: Remove JSON.stringify. Nakama SDK handles serialization.
      await socket.sendMatchState(
        matchId,
        OP_CODE.READY_TOGGLE,
        JSON.stringify({ type: "READY" })
      );

    } catch (err) {
      console.error("[LOBBY] Failed to send READY:", err);
    }
  };

  const handleStart = async () => {
    if (!socket || !matchId) return;
    // 🔥 FIX: Remove JSON.stringify
    await socket.sendMatchState(matchId, OP_CODE.START_GAME, {});
  };

  const sendMessage = async (content) => {
    if (!socket || !matchId) return;
    // 🔥 FIX: Remove JSON.stringify
    await socket.sendMatchState(matchId, OP_CODE.CHAT, JSON.stringify({ content }));

  };

  const leaveMatch = async () => {
    if (!socket || !matchId) return;
    try {
      await socket.leaveMatch(matchId);
    } catch (e) {
      console.error("Error leaving match:", e);
    }
    setMatchId("");
    setLobbyState(null);
    setMessages([]);
    setScreen("menu");
  };

  if (!session) return (
    <div className="h-screen bg-gray-900 flex flex-col items-center justify-center text-white space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-400 font-medium animate-pulse">Connecting to server...</p>
    </div>
  );

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
          {/* ARENA PRO */}
        </h1>
        <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] mt-1 font-bold">Multiplayer System v2.0</p>
      </div>

      {error && (
        <div className="fixed top-8 bg-red-500/90 text-white px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-top-full duration-300 z-50 flex items-center space-x-2 border border-red-400/50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Screen Router */}
      {screen === "menu" && (
        <Menu
          onCreateMatch={createMatch}
          onJoinMatch={joinMatch}
          inputMatchId={inputMatchId}
          setInputMatchId={setInputMatchId}
        />
      )}

      {screen === "lobby" && (
        <Lobby
          lobbyState={lobbyState}
          session={session}
          onReady={handleReady}
          onStart={handleStart}
          onLeave={leaveMatch}
          matchId={matchId}
        />
      )}

      {screen === "game" && (
        <Game
          lobbyState={lobbyState}
          session={session}
          messages={messages}
          onSendMessage={sendMessage}
          onLeave={leaveMatch}
        />
      )}
    </div>
  );
}

export default App;
