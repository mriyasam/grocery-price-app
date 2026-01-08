'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function GrocerySearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const fetchPrices = async () => {
      if (searchTerm.length < 2) { setResults([]); return; }
      const { data } = await supabase
        .from('prices')
        .select('*')
        .ilike('item_name', `%${searchTerm}%`)
        .order('price_kg', { ascending: true });
      if (data) setResults(data);
    };
    const timer = setTimeout(() => fetchPrices(), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '15px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#16a34a' }}>🛒 Price Compare</h1>
      <input
        type="text"
        placeholder="Search for an item..."
        style={{ width: '100%', padding: '15px', fontSize: '16px', borderRadius: '10px', border: '1px solid #ddd', marginBottom: '20px' }}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Store</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Item</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>$/lb</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>$/kg</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item, index) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee', backgroundColor: index === 0 ? '#dcfce7' : 'white' }}>
                <td style={{ padding: '12px' }}>{item.store_name}</td>
                <td style={{ padding: '12px' }}>{item.item_name}</td>
                <td style={{ padding: '12px' }}>${parseFloat(item.price_lb || 0).toFixed(2)}</td>
                <td style={{ padding: '12px' }}>${parseFloat(item.price_kg || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}