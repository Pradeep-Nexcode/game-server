import { useState, useEffect } from 'react';
import { Socket } from '@heroiclabs/nakama-js';

interface MatchmakingProps {
    socket: Socket;
    onMatchFound: (matchId: string) => void;
}

export default function Matchmaking({ socket, onMatchFound }: MatchmakingProps) {
    const [query, setQuery] = useState('*');
    const [minCount, setMinCount] = useState(2);
    const [maxCount, setMaxCount] = useState(4);
    const [ticket, setTicket] = useState<string | null>(null);
    const [status, setStatus] = useState('Idle');
    
    // Match Listing
    const [matches, setMatches] = useState<any[]>([]);
    const [listing, setListing] = useState(false);

    useEffect(() => {
        if (!socket) return;

        socket.onmatchmakermatched = async (matched) => {
            console.log("Matched!", matched);
            setStatus('Matched! Joining...');
            try {
                const match = await socket.joinMatch(matched.match_id || matched.token);
                console.log("Joined match:", match);
                onMatchFound(match.match_id);
            } catch (err: any) {
                console.error("Failed to join match", err);
                setStatus("Error joining: " + err.message);
            }
        };

        return () => {
             // socket.onmatchmakermatched = null;
        }
    }, [socket, onMatchFound]);

    const findMatch = async () => {
        setStatus('Searching...');
        try {
            const result = await socket.addMatchmaker(query, minCount, maxCount);
            setTicket(result.ticket);
            setStatus('Ticket: ' + result.ticket);
        } catch (err: any) {
            setStatus('Error: ' + err.message);
        }
    }

    const cancelMatch = async () => {
        if (!ticket) return;
        try {
            await socket.removeMatchmaker(ticket);
            setTicket(null);
            setStatus('Cancelled');
        } catch (err: any) {
            setStatus('Error cancelling: ' + err.message);
        }
    }

    const listMatches = async () => {
        setListing(true);
        try {
            // listMatches(limit, authoritative, label, minSize, maxSize, query)
            const result = await socket.listMatches(10, true, undefined, 0, 10, query);
            setMatches(result.matches || []);
        } catch (err: any) {
            console.error("List matches failed", err);
        } finally {
            setListing(false);
        }
    }

    const joinMatch = async (matchId: string, spectate: boolean) => {
        try {
            const metadata = spectate ? { spectator: "true" } : {};
            const match = await socket.joinMatch(matchId, undefined, metadata);
            onMatchFound(match.match_id);
        } catch (err: any) {
            alert("Failed to join: " + err.message);
        }
    }

    return (
        <div className="p-4 border border-gray-700 rounded bg-gray-900 text-white mt-4">
            <h2 className="text-xl font-bold mb-4">⚔️ Matchmaking</h2>
            
            {/* Matchmaker Section */}
            <div className="mb-6 border-b border-gray-700 pb-4">
                <h3 className="font-bold text-gray-400 mb-2">Auto-Match</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs text-gray-400">Query</label>
                        <input 
                            className="w-full bg-gray-800 border border-gray-600 p-1 rounded text-sm" 
                            value={query} 
                            onChange={e => setQuery(e.target.value)} 
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400">Min/Max</label>
                        <div className="flex gap-1">
                            <input 
                                className="w-1/2 bg-gray-800 border border-gray-600 p-1 rounded text-sm" 
                                type="number" 
                                value={minCount} 
                                onChange={e => setMinCount(Number(e.target.value))} 
                            />
                            <input 
                                className="w-1/2 bg-gray-800 border border-gray-600 p-1 rounded text-sm" 
                                type="number" 
                                value={maxCount} 
                                onChange={e => setMaxCount(Number(e.target.value))} 
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    {!ticket ? (
                        <button onClick={findMatch} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded flex-1 font-bold">
                            Find Match
                        </button>
                    ) : (
                        <button onClick={cancelMatch} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded flex-1 font-bold">
                            Cancel
                        </button>
                    )}
                </div>
                <div className="mt-2 text-sm text-yellow-400 font-mono break-all">{status}</div>
            </div>

            {/* Match List Section */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-gray-400">Active Matches</h3>
                    <button onClick={listMatches} className="text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600">
                        Refresh
                    </button>
                </div>
                
                {listing && <div className="text-xs text-gray-500">Loading...</div>}
                
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {matches.length === 0 && !listing && <div className="text-xs text-gray-600 italic">No matches found</div>}
                    {matches.map(m => (
                        <div key={m.match_id} className="bg-gray-800 p-2 rounded text-xs flex justify-between items-center">
                            <div>
                                <div className="font-mono text-green-400">{m.match_id.substring(0, 8)}...</div>
                                <div className="text-gray-500">{m.size} players</div>
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => joinMatch(m.match_id, false)}
                                    className="bg-blue-900 hover:bg-blue-800 px-2 py-1 rounded text-blue-200"
                                >
                                    Join
                                </button>
                                <button 
                                    onClick={() => joinMatch(m.match_id, true)}
                                    className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-200"
                                >
                                    Spectate
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
