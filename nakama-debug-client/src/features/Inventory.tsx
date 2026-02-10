import { useState, useEffect } from 'react';
import { client } from '../nakama/client';
import { Session } from '@heroiclabs/nakama-js';

interface InventoryProps {
    session: Session;
}

export default function Inventory({ session }: InventoryProps) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            // Read from storage: collection "inventory", key "cosmetics"
            const objects = await client.readStorageObjects(session, [{
                collection: "inventory",
                key: "cosmetics",
                userId: session.user_id
            }]);
            
            if (objects.objects && objects.objects.length > 0) {
                setItems(objects.objects[0].value.owned || []);
            } else {
                setItems([]);
            }
        } catch (err) {
            console.error("Failed to fetch inventory", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, [session]);

    return (
        <div className="p-4 border border-gray-700 rounded bg-gray-900 text-white mt-4">
            <h2 className="text-xl font-bold mb-4">🎒 Inventory</h2>
            <button onClick={fetchInventory} className="text-xs bg-gray-700 px-2 py-1 rounded mb-2 hover:bg-gray-600">
                Refresh
            </button>
            
            {loading ? (
                <div>Loading...</div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {items.length === 0 && <div className="text-gray-500 italic">No items owned</div>}
                    {items.map((item: string, i) => (
                        <div key={i} className="bg-blue-900/50 border border-blue-700 px-3 py-1 rounded text-sm">
                            {item}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
