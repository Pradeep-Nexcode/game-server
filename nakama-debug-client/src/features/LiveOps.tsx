import { useState } from 'react';
import { client } from '../nakama/client';
import { Session } from '@heroiclabs/nakama-js';

interface LiveOpsProps {
    session: Session;
}

export default function LiveOps({ session }: LiveOpsProps) {
    const [xpAmount, setXpAmount] = useState(100);
    const [seasonId, setSeasonId] = useState('season_1');
    const [cosmeticId, setCosmeticId] = useState('gold_skin');
    const [slot, setSlot] = useState('player_skin');
    const [log, setLog] = useState('');

    const callRpc = async (id: string, payload: any) => {
        setLog(`Calling ${id}...`);
        try {
            const result = await client.rpc(session, id, payload); // payload is object or string? SDK expects JSON object or string usually?
            // Wait, SDK rpc signature: (session, id, payload)
            // If payload is object, it might stringify it? Or we should stringify.
            // My server code expects JSON string: JSON.parse(payload).
            // So I must send string.
            const jsonPayload = JSON.stringify(payload);
            const res = await client.rpc(session, id, jsonPayload);
            
            // Result payload is also JSON string usually
            setLog(`✅ Success: ${JSON.stringify(res.payload)}`);
        } catch (err: any) {
            setLog(`❌ Failed: ${err.message}`);
        }
    }

    return (
        <div className="p-4 border border-gray-700 rounded bg-gray-900 text-white mt-4">
            <h2 className="text-xl font-bold mb-4">🛠️ Live Ops</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* XP Section */}
                <div className="bg-gray-800 p-3 rounded">
                    <h3 className="font-bold text-green-400 mb-2">Progression</h3>
                    <div className="flex gap-2 mb-2">
                        <input 
                            type="number" 
                            value={xpAmount} 
                            onChange={e => setXpAmount(Number(e.target.value))}
                            className="w-20 bg-gray-700 p-1 rounded"
                        />
                        <button 
                            onClick={() => callRpc('debug_add_xp', xpAmount)} // Note: server expects number payload string directly for this one specific RPC?
                            // server code: const amount = Number(payload) || 100;
                            // So I should send just the number as string.
                            // My callRpc helper stringifies. JSON.stringify(100) -> "100". Correct.
                            className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-sm"
                        >
                            Add XP
                        </button>
                    </div>
                </div>

                {/* Season Section */}
                <div className="bg-gray-800 p-3 rounded">
                    <h3 className="font-bold text-purple-400 mb-2">Seasons</h3>
                    <div className="flex flex-col gap-2">
                        <input 
                            value={seasonId} 
                            onChange={e => setSeasonId(e.target.value)}
                            className="bg-gray-700 p-1 rounded text-sm"
                            placeholder="Season ID"
                        />
                        <button 
                            onClick={() => callRpc('admin_start_season', { id: seasonId, name: "New Season", duration: 3600 })}
                            className="bg-purple-700 hover:bg-purple-600 px-3 py-1 rounded text-sm"
                        >
                            Start Season
                        </button>
                    </div>
                </div>

                {/* Cosmetics Section */}
                <div className="bg-gray-800 p-3 rounded">
                    <h3 className="font-bold text-yellow-400 mb-2">Cosmetics</h3>
                    <div className="flex flex-col gap-2">
                        <select 
                            value={slot} 
                            onChange={e => setSlot(e.target.value)}
                            className="bg-gray-700 p-1 rounded text-sm"
                        >
                            <option value="player_skin">Skin</option>
                            <option value="weapon_skin">Weapon</option>
                            <option value="emote">Emote</option>
                        </select>
                        <input 
                            value={cosmeticId} 
                            onChange={e => setCosmeticId(e.target.value)}
                            className="bg-gray-700 p-1 rounded text-sm"
                            placeholder="Cosmetic ID"
                        />
                        <button 
                            onClick={() => callRpc('equip_cosmetic', { slot, cosmeticId })}
                            className="bg-yellow-700 hover:bg-yellow-600 px-3 py-1 rounded text-sm"
                        >
                            Equip
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-4 p-2 bg-black/40 font-mono text-xs rounded break-all">
                {log || "Ready"}
            </div>
        </div>
    )
}
