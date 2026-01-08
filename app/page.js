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
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const initialForm = { store_name: '', item_name: '', brand: '', price: '', weight_value: '', weight_unit: 'kg', pin: '' };
  const [formData, setFormData] = useState(initialForm);
  const [message, setMessage] = useState({ text: '', type: '' });

  // 1. Search Logic
  useEffect(() => {
    const fetchPrices = async () => {
      if (searchTerm.length < 2) { setResults([]); return; }
      const { data } = await supabase
        .from('prices')
        .select('*')
        .ilike('item_name', `%${searchTerm}%`)
        .order('price_kg', { ascending: true }); // Using price_kg as we discussed
      if (data) setResults(data);
    };
    const timer = setTimeout(() => fetchPrices(), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Save Logic
  const handleSave = async (e) => {
    e.preventDefault();
    
    // Simple Security Check (Change '3044' to your preferred PIN)
    if (formData.pin !== '3044') {
      setMessage({ text: 'Incorrect Security PIN!', type: 'error' });
      return;
    }

    const { error } = await supabase.from('prices').insert([{
      store_name: formData.store_name,
      item_name: formData.item_name,
      brand: formData.brand,
      price: parseFloat(formData.price),
      weight_value: parseFloat(formData.weight_value),
      weight_unit: formData.weight_unit
      // Note: trigger handles price_lb, price_kg, and normalized_price_per_gram
    }]);

    if (error) {
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
    } else {
      setMessage({ text: 'Item saved successfully! 🎉', type: 'success' });
      setTimeout(() => { setIsModalOpen(false); setFormData(initialForm); setMessage({text:'', type:''}); }, 1500);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '15px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#16a34a' }}>🥘 My Grocery Saver</h1>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search for an item..."
          style={{ flex: 1, padding: '15px', fontSize: '16px', borderRadius: '10px', border: '1px solid #ddd' }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ padding: '0 20px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '20px' }}
        >
          +
        </button>
      </div>

      {/* Results Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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

      {/* --- ADD ITEM POPUP (MODAL) --- */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginTop: 0 }}>Add New Item</h2>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input required placeholder="Store Name" value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} style={inputStyle} />
              <input required placeholder="Item Name (e.g. Chicken Breast)" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} style={inputStyle} />
              <input placeholder="Brand (Optional)" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} style={inputStyle} />
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <input required type="number" step="0.01" placeholder="Weight" value={formData.weight_value} onChange={e => setFormData({...formData, weight_value: e.target.value})} style={{...inputStyle, flex: 1}} />
                <select value={formData.weight_unit} onChange={e => setFormData({...formData, weight_unit: e.target.value})} style={{...inputStyle, width: '80px'}}>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="lb">lb</option>
                  <option value="oz">oz</option>
                </select>
              </div>

              <input required type="number" step="0.01" placeholder="Total Price ($)" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={inputStyle} />
              
              <hr style={{ border: '0.5px solid #eee', margin: '10px 0' }} />
              <input type="password" placeholder="Security PIN" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} style={{...inputStyle, border: '1px solid #ffcfcf'}} />

              {message.text && <p style={{ color: message.type === 'error' ? 'red' : 'green', fontSize: '14px', textAlign: 'center' }}>{message.text}</p>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Save</button>
                <button type="button" onClick={() => setFormData(initialForm)} style={{ flex: 1, padding: '12px', backgroundColor: '#eee', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Clear</button>
                <button type="button" onClick={() => {setIsModalOpen(false); setMessage({text:'', type:''})}} style={{ flex: 1, padding: '12px', backgroundColor: '#ff4d4d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' };