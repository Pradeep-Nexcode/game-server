import { useState, useEffect, useRef } from 'react';
import { Socket } from '@heroiclabs/nakama-js';
import { OpCode } from '../nakama/opcodes';

interface MatchProps {
    socket: Socket;
    matchId: string;
    onLeave: () => void;
}

interface PlayerState {
    id: string;
    x: number;
    y: number;
    z: number;
    skin?: string;
    weaponSkin?: string;
    isSpectator?: boolean;
}

export default function Match({ socket, matchId, onLeave }: MatchProps) {
    const [players, setPlayers] = useState<{[key: string]: PlayerState}>({});
    const [lastTick, setLastTick] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev.slice(-19), msg]); // Keep last 20
    };

    useEffect(() => {
        if (!socket) return;

        socket.onmatchdata = (matchData) => {
            // matchData.op_code, matchData.data
            // The server sends JSON in data usually, or bytes.
            // Nakama JS SDK decodes JSON automatically if it detects it, or returns Uint8Array.
            
            let payload: any;
            try {
                // If it's a byte array, decode it
                if (matchData.data instanceof Uint8Array) {
                    const text = new TextDecoder().decode(matchData.data);
                    payload = JSON.parse(text);
                } else {
                    payload = matchData.data;
                }
            } catch (e) {
                console.error("Failed to decode match data", e);
                return;
            }

            if (matchData.op_code === OpCode.STATE_UPDATE) {
                // payload is { op: OpCode.STATE_UPDATE, data: state } based on createStateUpdateMessage?
                // Actually server.ts says: JSON.stringify({ op: OpCode.STATE_UPDATE, data: state })
                // But wait, the socket sends the opcode as the Nakama opcode.
                // If the server uses dispatcher.broadcastMessage(OpCode.STATE_UPDATE, ...),
                // then matchData.op_code IS OpCode.STATE_UPDATE.
                // The payload IS the second argument.
                
                // Server code: dispatcher.broadcastMessage(OpCode.STATE_UPDATE, JSON.stringify({ event: "respawn" ... }))
                // OR buildSnapshot...
                
                // Let's assume the payload IS the snapshot for now.
                // We'll log it to debug.
                
                // Update players
                if (payload.players) {
                    // It's a snapshot
                    const newPlayers = { ...players }; // Merge logic needed for deltas?
                    // For now, let's assume full snapshot or simple replace
                    if (Array.isArray(payload.players)) {
                         payload.players.forEach((p: PlayerState) => {
                             newPlayers[p.id] = { ...newPlayers[p.id], ...p };
                         });
                    }
                    setPlayers(newPlayers);
                    setLastTick(payload.tick || 0);
                }
            } else if (matchData.op_code === OpCode.GAME_OVER) {
                addLog("GAME OVER: " + JSON.stringify(payload));
            } else {
                addLog(`Op ${matchData.op_code}: ${JSON.stringify(payload).substring(0, 50)}...`);
            }
        };

        return () => {
            socket.onmatchdata = null;
        }
    }, [socket, players]); // Dependency on players might cause frequent re-bind, better use ref or functional update

    const leaveMatch = async () => {
        await socket.leaveMatch(matchId);
        onLeave();
    }

    const sendMove = async () => {
        // Send a random move
        const opCode = OpCode.MOVE;
        const data = { x: Math.random() * 10, y: 0, z: Math.random() * 10 };
        await socket.sendMatchState(matchId, opCode, JSON.stringify(data));
        addLog(`Sent MOVE: ${JSON.stringify(data)}`);
    }

    return (
        <div className="p-4 border border-gray-700 rounded bg-gray-900 text-white mt-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">🎮 Match: {matchId.substring(0, 8)}...</h2>
                <div className="text-sm text-gray-400">Tick: {lastTick}</div>
                <button onClick={leaveMatch} className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm font-bold">
                    Leave
                </button>
            </div>

            <div className="flex-1 flex gap-4 min-h-0">
                {/* Visualizer */}
                <div className="flex-1 bg-gray-800 rounded relative overflow-hidden border border-gray-600" style={{ minHeight: '300px' }}>
                    <div className="absolute top-2 left-2 text-xs text-gray-500">Map Visualizer (Top Down)</div>
                    {Object.values(players).map(p => (
                        <div 
                            key={p.id}
                            className="absolute w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border border-white transition-all duration-200"
                            style={{
                                left: `${(p.x || 0) * 5 + 50}%`, // Scale arbitrary for debug
                                top: `${(p.z || 0) * 5 + 50}%`,
                                backgroundColor: p.isSpectator ? 'gray' : (p.skin === 'gold_skin' ? '#ffd700' : 'blue'),
                                transform: 'translate(-50%, -50%)'
                            }}
                            title={JSON.stringify(p, null, 2)}
                        >
                            {p.id.substring(0, 2)}
                        </div>
                    ))}
                </div>

                {/* Data Panel */}
                <div className="w-64 flex flex-col gap-2">
                    <div className="bg-black/50 p-2 rounded text-xs font-mono h-48 overflow-y-auto">
                        {logs.map((l, i) => <div key={i}>{l}</div>)}
                        <div ref={logsEndRef} />
                    </div>
                    
                    <div className="p-2 bg-gray-800 rounded">
                        <h4 className="font-bold text-sm mb-2">Controls</h4>
                        <button onClick={sendMove} className="w-full bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-sm mb-2">
                            Send Random Move
                        </button>
                    </div>

                    <div className="p-2 bg-gray-800 rounded flex-1 overflow-y-auto">
                        <h4 className="font-bold text-sm mb-2">Players ({Object.keys(players).length})</h4>
                        {Object.values(players).map(p => (
                            <div key={p.id} className="text-xs border-b border-gray-700 pb-1 mb-1">
                                <div className="font-bold text-green-400">{p.id.substring(0, 8)}</div>
                                <div>Pos: {p.x?.toFixed(1)}, {p.z?.toFixed(1)}</div>
                                {p.skin && <div className="text-yellow-400">Skin: {p.skin}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
