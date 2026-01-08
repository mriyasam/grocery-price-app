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
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [existingStores, setExistingStores] = useState([]);
  const [existingBrands, setExistingBrands] = useState([]);
  
  const initialForm = { store_name: '', item_name: '', brand: '', price: '', weight_value: '', weight_unit: 'kg', pin: '' };
  const [formData, setFormData] = useState(initialForm);
  const [compareResults, setCompareResults] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });

  const ADMIN_PIN = '3044'; // Change this as needed

  // --- CORE LOGIC: SEARCH & REFRESH ---
  const fetchPrices = useCallback(async (query = searchTerm) => {
    if (query.length < 2) { setResults([]); return; }
    const { data } = await supabase.from('prices').select('*').ilike('item_name', `%${query}%`).order('price_kg', { ascending: true });
    if (data) setResults(data);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => fetchPrices(), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchPrices]);

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

  // LIVE SEARCH FOR COMPARE POPUP
  useEffect(() => {
    const liveCompare = async () => {
      if (formData.item_name.length < 2) { setCompareResults([]); return; }
      const { data } = await supabase.from('prices').select('*').ilike('item_name', `%${formData.item_name}%`).order('price_kg', { ascending: true }).limit(5);
      if (data) setCompareResults(data);
    };
    if (isCompareOpen) liveCompare();
  }, [formData.item_name, isCompareOpen]);

  // --- ACTIONS: SAVE, EDIT, DELETE ---
  const startEdit = (item) => {
    setEditingId(item.id);
    setFormData({ ...item, pin: '', brand: item.brand || '' });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (formData.pin !== ADMIN_PIN) { setMessage({ text: 'Incorrect PIN!', type: 'error' }); return; }
    
    const payload = { 
      store_name: formData.store_name, 
      item_name: formData.item_name, 
      brand: formData.brand, 
      price: parseFloat(formData.price), 
      weight_value: parseFloat(formData.weight_value), 
      weight_unit: formData.weight_unit 
    };

    const action = editingId ? supabase.from('prices').update(payload).eq('id', editingId) : supabase.from('prices').insert([payload]);
    const { error } = await action;

    if (error) { setMessage({ text: error.message, type: 'error' }); } 
    else { 
      setMessage({ text: 'Success! 🎉', type: 'success' }); 
      fetchPrices(); // REFRESH RESULTS AUTOMATICALLY
      setTimeout(() => closeModal(), 1000); 
    }
  };

  const handleDelete = async () => {
    if (formData.pin !== ADMIN_PIN) { setMessage({ text: 'Enter PIN to delete!', type: 'error' }); return; }
    if (!confirm('Delete permanently?')) return;
    const { error } = await supabase.from('prices').delete().eq('id', editingId);
    if (!error) { 
      setMessage({ text: 'Deleted! 🗑️', type: 'success' }); 
      fetchPrices(); 
      setTimeout(() => closeModal(), 1000); 
    }
  };

  const closeModal = () => { setIsModalOpen(false); setIsCompareOpen(false); setEditingId(null); setFormData(initialForm); setMessage({ text: '', type: '' }); };

  const calcCurrentPriceKg = () => {
    if (!formData.price || !formData.weight_value) return 0;
    const factor = formData.weight_unit === 'kg' ? 1 : formData.weight_unit === 'lb' ? 0.45359 : 0.001;
    return formData.price / (formData.weight_value * factor);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '20px auto', padding: '15px', fontFamily: 'sans-serif', color: '#333' }}>
      <h1 style={{ textAlign: 'center', color: '#16a34a' }}>🥘 Naju's Grocery Shopping App</h1>
      
      {/* Search Header */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input type="text" placeholder="Search item (chicken, rice...)" style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} onChange={(e) => setSearchTerm(e.target.value)} />
        <button onClick={() => { setEditingId(null); setFormData(initialForm); setIsModalOpen(true); }} style={btnPlusStyle}>+</button>
        <button onClick={() => { setFormData(initialForm); setIsCompareOpen(true); }} style={{...btnPlusStyle, backgroundColor: '#3b82f6', fontSize: '14px'}}>Compare</button>
      </div>

      {/* Main Grid: Reordered Columns */}
      <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
              <th style={thStyle}>Item Name</th>
              <th style={thStyle}>Store</th>
              <th style={thStyle}>Brand</th>
              <th style={thStyle}>Pack Price</th>
              <th style={thStyle}>$/lb</th>
              <th style={thStyle}>$/kg</th>
              <th style={{...thStyle, textAlign:'center'}}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item, index) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee', backgroundColor: index === 0 ? '#dcfce7' : 'white' }}>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{item.item_name} {index === 0 && '⭐'}</td>
                <td style={tdStyle}>{item.store_name}</td>
                <td style={tdStyle}>{item.brand}</td>
                <td style={tdStyle}>{item.weight_value}{item.weight_unit} @ ${item.price}</td>
                <td style={tdStyle}>${parseFloat(item.price_lb || 0).toFixed(2)}</td>
                <td style={tdStyle}>${parseFloat(item.price_kg || 0).toFixed(2)}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <button onClick={() => startEdit(item)} style={{ cursor:'pointer', border:'none', background:'none', fontSize:'16px' }}>✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- POPUP: COMPARE (Compact Layout) --- */}
      {isCompareOpen && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '650px', maxHeight: '95vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>🔍 Live Compare</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.5fr', gap: '8px', marginBottom: '15px' }}>
               <div style={fGroup}><label>Item</label><input list="item-list" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} style={inputStyle} /></div>
               <div style={fGroup}><label>Store</label><input list="store-list" value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} style={inputStyle} /></div>
               <div style={fGroup}><label>Brand</label><input list="brand-list" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} style={inputStyle} /></div>
               <div style={fGroup}><label>Price & Weight (Prominent)</label>
                  <div style={{display:'flex', gap:'4px'}}>
                    <input type="number" step="0.01" placeholder="$" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={{...inputStyle, width:'100%', border: '1px solid #3b82f6'}} />
                    <input type="number" placeholder="Qty" value={formData.weight_value} onChange={e => setFormData({...formData, weight_value: e.target.value})} style={{...inputStyle, width:'100%', border: '1px solid #3b82f6'}} />
                    <select value={formData.weight_unit} onChange={e => setFormData({...formData, weight_unit: e.target.value})} style={inputStyle}><option value="kg">kg</option><option value="lb">lb</option></select>
                  </div>
               </div>
            </div>

            {calcCurrentPriceKg() > 0 && (
              <div style={{ padding: '8px', backgroundColor: '#eff6ff', borderRadius: '8px', marginBottom: '10px', border: '1px solid #3b82f6', textAlign:'center' }}>
                <span style={{fontSize:'12px'}}>Current: </span><strong>${calcCurrentPriceKg().toFixed(2)}/kg</strong>
              </div>
            )}

            <div style={{ borderTop: '1px solid #eee', paddingTop: '10px' }}>
              <div style={{fontSize:'12px', fontWeight:'bold', marginBottom:'5px', color:'#666'}}>Database matches for comparison:</div>
              {compareResults.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px', fontSize: '13px', backgroundColor: idx === 0 ? '#dcfce7' : '#fff', borderBottom: '1px solid #f0f0f0' }}>
                  <span><strong>{item.item_name}</strong> - {item.store_name}</span>
                  <span><strong>${parseFloat(item.price_lb).toFixed(2)}/lb</strong> | <strong>${parseFloat(item.price_kg).toFixed(2)}/kg</strong></span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
               <button onClick={() => { setIsCompareOpen(false); setIsModalOpen(true); }} style={btnSaveStyle}>Go to Save Page</button>
               <button onClick={closeModal} style={btnCancelStyle}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- POPUP: ADD / EDIT / DELETE --- */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit Item' : 'Add New Item'}</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={fGroup}><label>Store</label><input required list="store-list" value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} style={inputStyle} /></div>
              <div style={fGroup}><label>Item Name</label><input required placeholder="Item Name" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} style={inputStyle} /></div>
              <div style={fGroup}><label>Brand</label><input placeholder="Brand" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} style={inputStyle} /></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{...fGroup, flex: 1}}><label>Weight</label><input required type="number" step="0.01" value={formData.weight_value} onChange={e => setFormData({...formData, weight_value: e.target.value})} style={inputStyle} /></div>
                <div style={fGroup}><label>Unit</label><select value={formData.weight_unit} onChange={e => setFormData({...formData, weight_unit: e.target.value})} style={inputStyle}><option value="kg">kg</option><option value="lb">lb</option><option value="g">g</option></select></div>
              </div>
              <div style={fGroup}><label>Total Price ($)</label><input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={inputStyle} /></div>
              <div style={fGroup}><label>Security PIN</label><input type="password" required placeholder="PIN" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} style={{...inputStyle, border: '1px solid #ffcfcf'}} /></div>
              
              {message.text && <p style={{ color: message.type === 'error' ? 'red' : 'green', textAlign: 'center', fontSize: '14px' }}>{message.text}</p>}
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="submit" style={btnSaveStyle}>{editingId ? 'Update' : 'Save'}</button>
                {editingId && <button type="button" onClick={handleDelete} style={btnDeleteStyle}>Delete</button>}
                <button type="button" onClick={() => setFormData(initialForm)} style={btnClearStyle}>Clear</button>
                <button type="button" onClick={closeModal} style={btnCancelStyle}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suggestion Lists */}
      <datalist id="store-list">{existingStores.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="brand-list">{existingBrands.map(b => <option key={b} value={b} />)}</datalist>
      <datalist id="item-list">{results.map(i => <option key={i.id} value={i.item_name} />)}</datalist>
    </div>
  );
}

// STYLES
const fGroup = { display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', fontWeight: 'bold' };
const inputStyle = { padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' };
const thStyle = { padding: '10px', textAlign: 'left', fontWeight: 'bold' };
const tdStyle = { padding: '10px' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { backgroundColor: 'white', padding: '20px', borderRadius: '15px', width: '95%', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' };
const btnPlusStyle = { padding: '10px 15px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' };
const btnSaveStyle = { flex: '1 1 100%', padding: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '5px' };
const btnDeleteStyle = { flex: 1, padding: '10px', backgroundColor: 'white', color: '#ff4d4d', border: '1px solid #ff4d4d', borderRadius: '8px', cursor: 'pointer' };
const btnClearStyle = { flex: 1, padding: '10px', backgroundColor: '#eee', border: 'none', borderRadius: '8px', cursor: 'pointer' };
const btnCancelStyle = { flex: 1, padding: '10px', backgroundColor: '#ff4d4d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' };