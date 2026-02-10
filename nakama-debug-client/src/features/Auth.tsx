import { useState } from 'react';
import { client } from '../nakama/client';
import { Session } from '@heroiclabs/nakama-js';

interface AuthProps {
    onSession: (session: Session) => void;
}

export default function Auth({ onSession }: AuthProps) {
    const [deviceId, setDeviceId] = useState('debug-device-' + Math.floor(Math.random() * 1000));
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleDeviceLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const session = await client.authenticateDevice(deviceId, true, deviceId);
            onSession(session);
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const session = await client.authenticateEmail(email, password, true, email);
            onSession(session);
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 border border-gray-700 rounded bg-gray-900 text-white">
            <h2 className="text-xl font-bold mb-4">🔐 Authentication</h2>
            
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Device Login (Quick)</h3>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={deviceId} 
                        onChange={e => setDeviceId(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-600 p-2 rounded"
                        placeholder="Device ID"
                    />
                    <button 
                        onClick={handleDeviceLogin}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold"
                    >
                        {loading ? '...' : 'Login'}
                    </button>
                </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Email Login</h3>
                <div className="flex flex-col gap-2">
                    <input 
                        type="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)}
                        className="bg-gray-800 border border-gray-600 p-2 rounded"
                        placeholder="Email"
                    />
                    <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)}
                        className="bg-gray-800 border border-gray-600 p-2 rounded"
                        placeholder="Password"
                    />
                    <button 
                        onClick={handleEmailLogin}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-bold"
                    >
                        {loading ? '...' : 'Login with Email'}
                    </button>
                </div>
            </div>

            {error && <div className="mt-4 text-red-400 bg-red-900/30 p-2 rounded">{error}</div>}
        </div>
    );
}
