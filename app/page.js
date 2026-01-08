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
  const [existingStores, setExistingStores] = useState([]);
  const [editingId, setEditingId] = useState(null); // Track if we are editing an existing item
  
  const initialForm = { store_name: '', item_name: '', brand: '', price: '', weight_value: '', weight_unit: 'kg', pin: '' };
  const [formData, setFormData] = useState(initialForm);
  const [message, setMessage] = useState({ text: '', type: '' });

  const ADMIN_PIN = '1234'; // Change this to your preferred PIN

  // 1. Fetch search results (Ordered by cheapest kg price)
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

  // 2. Fetch existing store names for the suggestion dropdown
  useEffect(() => {
    const fetchStores = async () => {
      const { data } = await supabase.from('prices').select('store_name');
      if (data) {
        const uniqueStores = [...new Set(data.map(s => s.store_name))];
        setExistingStores(uniqueStores);
      }
    };
    if (isModalOpen) fetchStores();
  }, [isModalOpen]);

  // 3. Open Modal in "Edit Mode"
  const startEdit = (item) => {
    setEditingId(item.id);
    setFormData({ 
      store_name: item.store_name, 
      item_name: item.item_name, 
      brand: item.brand || '', 
      price: item.price, 
      weight_value: item.weight_value, 
      weight_unit: item.weight_unit, 
      pin: '' 
    });
    setIsModalOpen(true);
  };

  // 4. Save Logic (Handles both NEW items and UPDATES)
  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.pin !== ADMIN_PIN) {
      setMessage({ text: 'Incorrect Security PIN!', type: 'error' });
      return;
    }

    const payload = {
      store_name: formData.store_name,
      item_name: formData.item_name,
      brand: formData.brand,
      price: parseFloat(formData.price),
      weight_value: parseFloat(formData.weight_value),
      weight_unit: formData.weight_unit
    };

    const action = editingId 
      ? supabase.from('prices').update(payload).eq('id', editingId) // Update if we have an ID
      : supabase.from('prices').insert([payload]);               // Otherwise, Insert new

    const { error } = await action;

    if (error) {
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
    } else {
      setMessage({ text: editingId ? 'Update successful!' : 'Saved successfully!', type: 'success' });
      setTimeout(() => closeModal(), 1500);
    }
  };

  // 5. Delete Logic
  const handleDelete = async () => {
    if (formData.pin !== ADMIN_PIN) {
      setMessage({ text: 'Enter PIN first to delete!', type: 'error' });
      return;
    }
    if (!confirm('Are you sure you want to delete this item permanently?')) return;

    const { error } = await supabase.from('prices').delete().eq('id', editingId);

    if (error) {
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
    } else {
      setMessage({ text: 'Item deleted! 🗑️', type: 'success' });
      setTimeout(() => closeModal(), 1000);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialForm);
    setMessage({ text: '', type: '' });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '15px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#16a34a' }}>🥘 My Grocery Saver</h1>
      
      {/* Search Bar & Add Button */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search (chicken, rice, beef)..."
          style={{ flex: 1, padding: '15px', fontSize: '16px', borderRadius: '10px', border: '1px solid #ddd' }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button onClick={() => { setEditingId(null); setFormData(initialForm); setIsModalOpen(true); }} style={btnPlusStyle}>+</button>
      </div>

      {/* Results Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
              <th style={thStyle}>Store</th>
              <th style={thStyle}>Item Info</th>
              <th style={thStyle}>$/lb</th>
              <th style={thStyle}>$/kg</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item, index) => (
              <tr key={item.id} style={{ 
                borderBottom: '1px solid #eee', 
                backgroundColor: index === 0 ? '#dcfce7' : 'white',
                borderLeft: index === 0 ? '5px solid #16a34a' : 'none'
              }}>
                <td style={tdStyle}>{item.store_name}</td>
                <td style={tdStyle}>
                   <div style={{ fontWeight: 'bold' }}>{item.item_name} {index === 0 && '⭐'}</div>
                   <div style={{ fontSize: '12px', color: '#666' }}>{item.brand} ({item.weight_value}{item.weight_unit} @ ${item.price})</div>
                </td>
                <td style={tdStyle}>${parseFloat(item.price_lb || 0).toFixed(2)}</td>
                <td style={tdStyle}>${parseFloat(item.price_kg || 0).toFixed(2)}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <button onClick={() => startEdit(item)} style={{ cursor: 'pointer', fontSize: '18px', border: 'none', background: 'none' }}>✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- POPUP WINDOW (Add/Edit/Delete) --- */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit Item' : 'Add New Item'}</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Store Suggestion Input */}
              <input required list="store-list" placeholder="Store Name" value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} style={inputStyle} />
              <datalist id="store-list">{existingStores.map(store => <option key={store} value={store} />)}</datalist>

              <input required placeholder="Item Name" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} style={inputStyle} />
              <input placeholder="Brand (Optional)" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} style={inputStyle} />
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <input required type="number" step="0.01" placeholder="Weight" value={formData.weight_value} onChange={e => setFormData({...formData, weight_value: e.target.value})} style={{...inputStyle, flex: 1}} />
                <select value={formData.weight_unit} onChange={e => setFormData({...formData, weight_unit: e.target.value})} style={{...inputStyle, width: '80px'}}>
                  <option value="kg">kg</option><option value="g">g</option><option value="lb">lb</option><option value="oz">oz</option>
                </select>
              </div>

              <input required type="number" step="0.01" placeholder="Total Pack Price ($)" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={inputStyle} />
              
              <hr style={{ border: 'none', borderBottom: '1px solid #eee', margin: '5px 0' }} />
              <input type="password" required placeholder="Security PIN to save/delete" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} style={{...inputStyle, border: '1px solid #ffcfcf'}} />

              {message.text && <p style={{ color: message.type === 'error' ? 'red' : 'green', fontSize: '14px', textAlign: 'center' }}>{message.text}</p>}

              <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap' }}>
                {/* Save Button */}
                <button type="submit" style={btnSaveStyle}>{editingId ? 'Update Item' : 'Save New Item'}</button>
                
                {/* Delete Button (Only shows when editing) */}
                {editingId && <button type="button" onClick={handleDelete} style={btnDeleteStyle}>Delete</button>}
                
                <button type="button" onClick={() => setFormData(initialForm)} style={btnClearStyle}>Clear</button>
                <button type="button" onClick={closeModal} style={btnCancelStyle}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Internal Styles
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' };
const thStyle = { padding: '12px', textAlign: 'left', fontSize: '14px' };
const tdStyle = { padding: '12px', fontSize: '14px' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { backgroundColor: 'white', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };
const btnPlusStyle = { padding: '0 20px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '24px' };
const btnSaveStyle = { flex: '1 1 100%', padding: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '5px' };
const btnDeleteStyle = { flex: 1, padding: '10px', backgroundColor: 'white', color: '#ff4d4d', border: '1px solid #ff4d4d', borderRadius: '8px', cursor: 'pointer' };
const btnClearStyle = { flex: 1, padding: '10px', backgroundColor: '#eee', border: 'none', borderRadius: '8px', cursor: 'pointer' };
const btnCancelStyle = { flex: 1, padding: '10px', backgroundColor: '#ff4d4d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' };