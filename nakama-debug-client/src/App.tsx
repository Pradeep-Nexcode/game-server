import { useState } from 'react'
import Auth from './features/Auth'
import Matchmaking from './features/Matchmaking'
import Match from './features/Match'
import LiveOps from './features/LiveOps'
import Inventory from './features/Inventory'
import { connectSocket, disconnectSocket } from './nakama/socket'
import { Session, Socket } from '@heroiclabs/nakama-js'

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  const handleSession = async (s: Session) => {
    console.log("Session authenticated:", s);
    setSession(s);
    try {
        const sock = await connectSocket(s);
        setSocket(sock);
    } catch (e) {
        console.error("Socket connect failed", e);
        alert("Socket connection failed. Check console.");
        setSession(null);
    }
  }

  const handleLogout = () => {
      disconnectSocket();
      setSocket(null);
      setSession(null);
      setMatchId(null);
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans p-4">
      <header className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            Nakama Debug Client
        </h1>
        {session && (
            <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400 font-mono">
                    {session.username || session.user_id.substring(0, 8)}...
                </span>
                <button onClick={handleLogout} className="text-red-400 text-sm hover:underline font-bold">
                    LOGOUT
                </button>
            </div>
        )}
      </header>

      {!session ? (
        <div className="max-w-md mx-auto">
            <Auth onSession={handleSession} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                {matchId && socket ? (
                    <Match 
                        socket={socket} 
                        matchId={matchId} 
                        onLeave={() => setMatchId(null)} 
                    />
                ) : (
                    socket && <Matchmaking socket={socket} onMatchFound={setMatchId} />
                )}
            </div>
            
            <div className="space-y-6">
                <LiveOps session={session} />
                <Inventory session={session} />
                
                {/* Debug Info Panel */}
                <div className="p-4 border border-gray-700 rounded bg-gray-900 text-xs font-mono text-gray-500">
                    <h3 className="font-bold text-gray-400 mb-2">Debug Info</h3>
                    <div>Socket: {socket ? 'Connected' : 'Disconnected'}</div>
                    <div>Match ID: {matchId || 'None'}</div>
                    <div>Host: {import.meta.env.VITE_NAKAMA_HOST || '127.0.0.1'}</div>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}

export default App
