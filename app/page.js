'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function GrocerySearch() {
  // --- STATES (Frozen + New) ---
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [existingStores, setExistingStores] = useState([]);
  const [existingBrands, setExistingBrands] = useState([]);
  
  const initialForm = { store_name: '', item_name: '', brand: '', price: '', weight_value: '', weight_unit: 'kg', pin: '' };
  const [formData, setFormData] = useState(initialForm);
  const [compareResults, setCompareResults] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });

  const ADMIN_PIN = '1234'; 

  // --- CORE LOGIC: SEARCH ---
  const fetchPrices = useCallback(async (query = searchTerm) => {
    if (query.length < 2) { setResults([]); return; }
    const { data } = await supabase.from('prices').select('*').ilike('item_name', `%${query}%`).order('price_kg', { ascending: true });
    if (data) setResults(data);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => fetchPrices(), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchPrices]);

  // --- LOGIC: SHOPPING LIST ---
  const fetchShoppingList = useCallback(async () => {
    const { data } = await supabase.from('shopping_list').select('*').order('created_at', { ascending: false });
    if (data) setShoppingList(data);
  }, []);

  useEffect(() => {
    if (activeTab === 'list') fetchShoppingList();
  }, [activeTab, fetchShoppingList]);

  const toggleBought = async (item) => {
    await supabase.from('shopping_list').update({ is_bought: !item.is_bought }).eq('id', item.id);
    fetchShoppingList();
  };

  const addItemToList = async (name, store = '', price = 0) => {
    await supabase.from('shopping_list').insert([{ item_name: name, store_name: store, estimated_price: price }]);
    fetchShoppingList();
    if (activeTab === 'search') alert(`'${name}' added to list!`);
  };

  const removeFromList = async (id) => {
    await supabase.from('shopping_list').delete().eq('id', id);
    fetchShoppingList();
  };

  // --- LOGIC: SUGGESTIONS & COMPARE ---
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

  useEffect(() => {
    const liveCompare = async () => {
      if (formData.item_name.length < 2) { setCompareResults([]); return; }
      const { data } = await supabase.from('prices').select('*').ilike('item_name', `%${formData.item_name}%`).order('price_kg', { ascending: true }).limit(5);
      if (data) setCompareResults(data);
    };
    if (isCompareOpen) liveCompare();
  }, [formData.item_name, isCompareOpen]);

  // --- ACTIONS: SAVE & DELETE ---
  const startEdit = (item) => {
    setEditingId(item.id);
    setFormData({ ...item, pin: '', brand: item.brand || '' });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (formData.pin !== ADMIN_PIN) { setMessage({ text: 'Incorrect PIN!', type: 'error' }); return; }
    const payload = { store_name: formData.store_name, item_name: formData.item_name, brand: formData.brand, price: parseFloat(formData.price), weight_value: parseFloat(formData.weight_value), weight_unit: formData.weight_unit };
    const action = editingId ? supabase.from('prices').update(payload).eq('id', editingId) : supabase.from('prices').insert([payload]);
    const { error } = await action;
    if (error) { setMessage({ text: error.message, type: 'error' }); } 
    else { setMessage({ text: 'Success! 🎉', type: 'success' }); fetchPrices(); setTimeout(() => closeModal(), 1000); }
  };

  const handleDelete = async () => {
    if (formData.pin !== ADMIN_PIN) { setMessage({ text: 'Enter PIN to delete!', type: 'error' }); return; }
    if (!confirm('Delete permanently?')) return;
    const { error } = await supabase.from('prices').delete().eq('id', editingId);
    if (!error) { setMessage({ text: 'Deleted! 🗑️', type: 'success' }); fetchPrices(); setTimeout(() => closeModal(), 1000); }
  };

  const closeModal = () => { setIsModalOpen(false); setIsCompareOpen(false); setEditingId(null); setFormData(initialForm); setMessage({ text: '', type: '' }); };

  const calcCurrentPriceKg = () => {
    if (!formData.price || !formData.weight_value) return 0;
    const factor = formData.weight_unit === 'kg' ? 1 : formData.weight_unit === 'lb' ? 0.45359 : 0.001;
    return formData.price / (formData.weight_value * factor);
  };

  return (
    <div style={{ maxWidth: '950px', margin: '20px auto', padding: '15px', fontFamily: 'sans-serif', color: '#333' }}>
      <h1 style={{ textAlign: 'center', color: '#16a34a' }}>🥘 Naju's Grocery Shopping App</h1>
      
      {/* TAB NAVIGATION */}
      <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '2px solid #eee' }}>
        <button onClick={() => setActiveTab('search')} style={{ ...tabStyle, fontWeight: activeTab === 'search' ? 'bold' : 'normal', borderBottom: activeTab === 'search' ? '3px solid #16a34a' : 'none' }}>🔍 Price Search</button>
        <button onClick={() => setActiveTab('list')} style={{ ...tabStyle, fontWeight: activeTab === 'list' ? 'bold' : 'normal', borderBottom: activeTab === 'list' ? '3px solid #16a34a' : 'none' }}>📝 My List ({shoppingList.filter(i => !i.is_bought).length})</button>
      </div>

      {/* --- TAB: SEARCH --- */}
      {activeTab === 'search' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <input type="text" placeholder="Search item..." style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} onChange={(e) => setSearchTerm(e.target.value)} />
            <button onClick={() => { setEditingId(null); setFormData(initialForm); setIsModalOpen(true); }} style={btnPlusStyle}>+</button>
            <button onClick={() => { setFormData(initialForm); setIsCompareOpen(true); }} style={{...btnPlusStyle, backgroundColor: '#1e40af', fontSize: '14px'}}>Compare</button>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #eee' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                  <th style={thStyle}>Item Name</th><th style={thStyle}>Store</th><th style={thStyle}>Brand</th><th style={thStyle}>Pack Price</th><th style={thStyle}>$/lb</th><th style={thStyle}>$/kg</th><th style={{...thStyle, textAlign:'center'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item, index) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee', backgroundColor: index === 0 ? '#dcfce7' : 'white' }}>
                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>{item.item_name} {index === 0 && '⭐'}</td>
                    <td style={tdStyle}>{item.store_name}</td>
                    <td style={tdStyle}>{item.brand}</td>
                    <td style={tdStyle}>{item.weight_value}{item.weight_unit} @ ${parseFloat(item.price).toFixed(2)}</td>
                    <td style={tdStyle}>${parseFloat(item.price_lb || 0).toFixed(2)}</td>
                    <td style={tdStyle}>${parseFloat(item.price_kg || 0).toFixed(2)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button onClick={() => addItemToList(item.item_name, item.store_name, item.price_kg)} title="Add to List" style={{ cursor:'pointer', border:'none', background:'none', fontSize:'16px', marginRight:'10px' }}>🛒</button>
                      <button onClick={() => startEdit(item)} title="Edit Price" style={{ cursor:'pointer', border:'none', background:'none', fontSize:'16px' }}>✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- TAB: MY LIST --- */}
      {activeTab === 'list' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <input id="quick-add" placeholder="Quick add item name..." style={{...inputStyle, flex: 1}} onKeyPress={(e) => { if(e.key === 'Enter') { addItemToList(e.target.value); e.target.value = ''; }}} />
            <button onClick={() => { const v = document.getElementById('quick-add').value; if(v){ addItemToList(v); document.getElementById('quick-add').value=''; }}} style={btnPlusStyle}>+</button>
          </div>

          {[...new Set(shoppingList.map(i => i.store_name || 'Generic List'))].sort().map(store => (
            <div key={store} style={{ marginBottom: '20px', border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#f8f9fa', padding: '10px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>📍 {store}</div>
              {shoppingList.filter(item => (item.store_name || 'Generic List') === store).map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '12px', borderBottom: '1px solid #f9f9f9', backgroundColor: item.is_bought ? '#fafafa' : 'white' }}>
                  <input type="checkbox" checked={item.is_bought} onChange={() => toggleBought(item)} style={{ width:'20px', height:'20px', cursor:'pointer' }} />
                  <div style={{ flex: 1, marginLeft: '12px', textDecoration: item.is_bought ? 'line-through' : 'none', color: item.is_bought ? '#999' : '#333' }}>
                    <strong>{item.item_name}</strong> {item.brand && <span style={{fontSize:'12px', color:'#666'}}>- {item.brand}</span>}
                  </div>
                  <button onClick={() => removeFromList(item.id)} style={{ border:'none', background:'none', cursor:'pointer', fontSize:'16px' }}>🗑️</button>
                </div>
              ))}
            </div>
          ))}
          {shoppingList.length === 0 && <p style={{ textAlign:'center', color:'#999', marginTop: '40px' }}>Your list is empty. Add items from Search or use Quick Add above.</p>}
        </div>
      )}

      {/* --- POPUPS: COMPARE & MODALS (Kept Frozen) --- */}
      {isCompareOpen && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '650px' }}>
            <h3 style={{ marginTop: 0 }}>🔍 Live Compare</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
               <div style={fGroup}><label>Item</label><input list="item-list" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} style={inputStyle} /></div>
               <div style={fGroup}><label>Store</label><input list="store-list" value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} style={inputStyle} /></div>
               <div style={fGroup}><label>Brand</label><input list="brand-list" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr', gap: '10px', marginBottom: '15px' }}>
               <div style={fGroup}><label>Price ($)</label><input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={{...inputStyle, border: '1px solid #3b82f6'}} /></div>
               <div style={fGroup}><label>Weight</label><input type="number" step="0.01" value={formData.weight_value} onChange={e => setFormData({...formData, weight_value: e.target.value})} style={{...inputStyle, border: '1px solid #3b82f6'}} /></div>
               <div style={fGroup}><label>Unit</label><select value={formData.weight_unit} onChange={e => setFormData({...formData, weight_unit: e.target.value})} style={inputStyle}><option value="kg">kg</option><option value="lb">lb</option></select></div>
            </div>
            {calcCurrentPriceKg() > 0 && <div style={{ padding: '8px', backgroundColor: '#eff6ff', borderRadius: '8px', marginBottom: '10px', border: '1px solid #3b82f6', textAlign:'center' }}><span>Current: </span><strong>${calcCurrentPriceKg().toFixed(2)}/kg</strong></div>}
            <div style={{ borderTop: '1px solid #eee', paddingTop: '10px' }}>
              <div style={{fontSize:'12px', fontWeight:'bold', marginBottom:'5px', color:'#666'}}>Database matches:</div>
              {compareResults.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px', fontSize: '12px', backgroundColor: idx === 0 ? '#dcfce7' : '#fff', borderBottom: '1px solid #f0f0f0' }}>
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

      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit Item' : 'Add New Item'}</h2>
            <form onSubmit={handleSave} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={fGroup}><label>Store</label><input required list="store-list" value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} style={inputStyle} /></div>
              <div style={fGroup}><label>Item Name</label><input required placeholder="Item Name" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} style={inputStyle} /></div>
              <div style={fGroup}><label>Brand</label><input placeholder="Brand" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} style={inputStyle} /></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{...fGroup, flex: 1.5}}><label>Weight</label><input required type="number" step="0.01" value={formData.weight_value} onChange={e => setFormData({...formData, weight_value: e.target.value})} style={inputStyle} /></div>
                <div style={fGroup}><label>Unit</label><select value={formData.weight_unit} onChange={e => setFormData({...formData, weight_unit: e.target.value})} style={inputStyle}><option value="kg">kg</option><option value="lb">lb</option><option value="g">g</option></select></div>
              </div>
              <div style={fGroup}><label>Total Price ($)</label><input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={inputStyle} /></div>
              <div style={fGroup}><label>Security PIN</label>
                <input type="text" required placeholder="PIN" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} 
                  style={{...inputStyle, border: '1px solid #ffcfcf', WebkitTextSecurity: 'disc', MozTextSecurity: 'disc', textSecurity: 'disc'}} 
                />
              </div>
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

      <datalist id="store-list">{existingStores.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="brand-list">{existingBrands.map(b => <option key={b} value={b} />)}</datalist>
      <datalist id="item-list">{results.map(i => <option key={i.id} value={i.item_name} />)}</datalist>
    </div>
  );
}

// STYLES
const tabStyle = { flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px' };
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