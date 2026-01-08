'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function GrocerySearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false); // New State
  const [existingStores, setExistingStores] = useState([]);
  const [existingBrands, setExistingBrands] = useState([]); // New State
  const [editingId, setEditingId] = useState(null);
  
  const initialForm = { store_name: '', item_name: '', brand: '', price: '', weight_value: '', weight_unit: 'kg', pin: '' };
  const [formData, setFormData] = useState(initialForm);
  const [compareResults, setCompareResults] = useState([]); // New State for comparison
  const [message, setMessage] = useState({ text: '', type: '' });

  const ADMIN_PIN = '3044'; 

  // --- REUSABLE FETCH FUNCTION (Fixes the Refresh Bug) ---
  const fetchPrices = useCallback(async (query = searchTerm) => {
    if (query.length < 2) { setResults([]); return; }
    const { data } = await supabase
      .from('prices')
      .select('*')
      .ilike('item_name', `%${query}%`)
      .order('price_kg', { ascending: true });
    if (data) setResults(data);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => fetchPrices(), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchPrices]);

  // Fetch Suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data } = await supabase.from('prices').select('store_name, brand');
      if (data) {
        setExistingStores([...new Set(data.map(s => s.store_name))]);
        setExistingBrands([...new Set(data.map(s => s.brand).filter(Boolean))]);
      }
    };
    if (isModalOpen || isCompareOpen) fetchSuggestions();
  }, [isModalOpen, isCompareOpen]);

  // LIVE SEARCH FOR COMPARE MODAL
  useEffect(() => {
    const liveCompare = async () => {
      if (formData.item_name.length < 2) { setCompareResults([]); return; }
      const { data } = await supabase
        .from('prices')
        .select('*')
        .ilike('item_name', `%${formData.item_name}%`)
        .order('price_kg', { ascending: true });
      if (data) setCompareResults(data);
    };
    if (isCompareOpen) liveCompare();
  }, [formData.item_name, isCompareOpen]);

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
      ? supabase.from('prices').update(payload).eq('id', editingId)
      : supabase.from('prices').insert([payload]);

    const { error } = await action;

    if (error) {
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
    } else {
      setMessage({ text: 'Success! 🎉', type: 'success' });
      fetchPrices(); // REFRESH DATA IMMEDIATELY
      setTimeout(() => closeModal(), 1000);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsCompareOpen(false);
    setEditingId(null);
    setFormData(initialForm);
    setMessage({ text: '', type: '' });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '15px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#16a34a' }}>🥘 My Grocery Saver</h1>
      
      {/* Search Controls */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search..."
          style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button onClick={() => { setEditingId(null); setFormData(initialForm); setIsModalOpen(true); }} style={btnPlusStyle}>+</button>
        <button onClick={() => { setFormData(initialForm); setIsCompareOpen(true); }} style={{...btnPlusStyle, backgroundColor: '#3b82f6', fontSize: '14px'}}>Compare</button>
      </div>

      {/* Main Results Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
              <th style={thStyle}>Store</th>
              <th style={thStyle}>Item</th>
              <th style={thStyle}>$/lb</th>
              <th style={thStyle}>$/kg</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item, index) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee', backgroundColor: index === 0 ? '#dcfce7' : 'white' }}>
                <td style={tdStyle}>{item.store_name}</td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 'bold' }}>{item.item_name} {index === 0 && '⭐'}</div>
                  <div style={{ fontSize: '11px' }}>{item.brand} ({item.weight_value}{item.weight_unit} @ ${item.price})</div>
                </td>
                <td style={tdStyle}>${parseFloat(item.price_lb || 0).toFixed(2)}</td>
                <td style={tdStyle}>${parseFloat(item.price_kg || 0).toFixed(2)}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}><button onClick={() => { setEditingId(item.id); setFormData({...item, pin:''}); setIsModalOpen(true); }} style={{ border: 'none', background: 'none' }}>✏️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- MODAL: COMPARE (THE NEW FEATURE) --- */}
      {isCompareOpen && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '500px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>🔍 Compare In-Store</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
               <div style={fGroup}><label>Item Name</label><input list="item-list" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} style={inputStyle} /></div>
               <div style={fGroup}><label>Store</label><input list="store-list" value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} style={inputStyle} /></div>
               <div style={fGroup}><label>Brand</label><input list="brand-list" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} style={inputStyle} /></div>
               <div style={fGroup}><label>Price ($)</label><input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={inputStyle} /></div>
               <div style={fGroup}><label>Weight</label><input type="number" value={formData.weight_value} onChange={e => setFormData({...formData, weight_value: e.target.value})} style={inputStyle} /></div>
               <div style={fGroup}><label>Unit</label><select value={formData.weight_unit} onChange={e => setFormData({...formData, weight_unit: e.target.value})} style={inputStyle}><option value="kg">kg</option><option value="lb">lb</option><option value="g">g</option></select></div>
            </div>

            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '8px', textAlign: 'center' }}>
              <strong>Cheapest in database for "{formData.item_name}":</strong>
              {compareResults.length > 0 ? (
                <div style={{ color: '#16a34a', fontWeight: 'bold' }}>${parseFloat(compareResults[0].price_kg).toFixed(2)}/kg at {compareResults[0].store_name}</div>
              ) : <div style={{ color: '#666' }}>No matches found</div>}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
               <button onClick={() => { setIsCompareOpen(false); setIsModalOpen(true); }} style={btnSaveStyle}>Add to Database</button>
               <button onClick={closeModal} style={btnCancelStyle}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD / EDIT --- */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2>{editingId ? 'Edit Item' : 'Add New Item'}</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input required list="store-list" placeholder="Store Name" value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} style={inputStyle} />
              <input required placeholder="Item Name" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} style={inputStyle} />
              <input placeholder="Brand" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} style={inputStyle} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input required type="number" step="0.01" placeholder="Weight" value={formData.weight_value} onChange={e => setFormData({...formData, weight_value: e.target.value})} style={{...inputStyle, flex: 1}} />
                <select value={formData.weight_unit} onChange={e => setFormData({...formData, weight_unit: e.target.value})} style={inputStyle}><option value="kg">kg</option><option value="g">g</option><option value="lb">lb</option></select>
              </div>
              <input required type="number" step="0.01" placeholder="Price ($)" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={inputStyle} />
              <input type="password" required placeholder="Security PIN" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} style={{...inputStyle, border: '1px solid #ffcfcf'}} />
              {message.text && <p style={{ color: message.type === 'error' ? 'red' : 'green', textAlign: 'center' }}>{message.text}</p>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" style={btnSaveStyle}>Save</button>
                <button type="button" onClick={closeModal} style={btnCancelStyle}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <datalist id="store-list">{existingStores.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="brand-list">{existingBrands.map(b => <option key={b} value={b} />)}</datalist>
      <datalist id="item-list">{results.map(i => <option key={i.id} value={i.item_name} />)}</datalist>
    </div>
  );
}

// STYLES
const fGroup = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold' };
const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' };
const thStyle = { padding: '10px', textAlign: 'left', fontSize: '13px' };
const tdStyle = { padding: '10px', fontSize: '13px' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { backgroundColor: 'white', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '400px' };
const btnPlusStyle = { padding: '10px 15px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' };
const btnSaveStyle = { flex: 1, padding: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnCancelStyle = { flex: 1, padding: '12px', backgroundColor: '#ff4d4d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' };