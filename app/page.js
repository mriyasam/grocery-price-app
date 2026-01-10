"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default function GrocerySearch() {
    // --- STATES ---
    const [activeTab, setActiveTab] = useState("search");
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState([]);
    const [shoppingList, setShoppingList] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCompareOpen, setIsCompareOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [existingStores, setExistingStores] = useState([]);
    const [existingBrands, setExistingBrands] = useState([]);

	const initialForm = { 
		store_name: '', 
		item_name: '', 
		brand: '', 
		price: '', 
		weight_value: '', 
		weight_unit: 'kg', 
		pin: '',
		is_watched: false, // New
		external_url: '',  // New
		store_id: ''       // New
	};
    const [formData, setFormData] = useState(initialForm);
    const [compareResults, setCompareResults] = useState([]);
    const [message, setMessage] = useState({ text: "", type: "" });

    const ADMIN_PIN = "3044";

    // --- CORE LOGIC: SEARCH & REFRESH ---
    const fetchPrices = useCallback(
        async (query = searchTerm) => {
            if (query.length < 2) {
                setResults([]);
                return;
            }
            const { data } = await supabase
                .from("prices")
                .select("*")
                .ilike("item_name", `%${query}%`)
                .order("price_kg", { ascending: true, nullsFirst: false })
                .order("price_ct", { ascending: true, nullsFirst: false });
            if (data) setResults(data);
        },
        [searchTerm],
    );

    useEffect(() => {
        const timer = setTimeout(() => fetchPrices(), 300);
        return () => clearTimeout(timer);
    }, [searchTerm, fetchPrices]);

    // --- LOGIC: SHOPPING LIST ---
    const fetchShoppingList = useCallback(async () => {
        const { data } = await supabase
            .from("shopping_list")
            .select("*")
            .order("created_at", { ascending: false });
        if (data) setShoppingList(data);
    }, []);

    useEffect(() => {
        if (activeTab === "list") fetchShoppingList();
    }, [activeTab, fetchShoppingList]);

    const toggleBought = async (item) => {
        await supabase
            .from("shopping_list")
            .update({ is_bought: !item.is_bought })
            .eq("id", item.id);
        fetchShoppingList();
    };

    const addItemToList = async (name, store = "", price = 0) => {
        await supabase
            .from("shopping_list")
            .insert([
                { item_name: name, store_name: store, estimated_price: price },
            ]);
        fetchShoppingList();
        if (activeTab === "search") alert(`'${name}' added to list!`);
    };

    const removeFromList = async (id) => {
        await supabase.from("shopping_list").delete().eq("id", id);
        fetchShoppingList();
    };

    // --- LOGIC: SUGGESTIONS & COMPARE ---
    useEffect(() => {
        const fetchSuggestions = async () => {
            const { data } = await supabase
                .from("prices")
                .select("store_name, brand")
                .limit(100);
            if (data) {
                setExistingStores([...new Set(data.map((s) => s.store_name))]);
                setExistingBrands([
                    ...new Set(data.map((s) => s.brand).filter(Boolean)),
                ]);
            }
        };
        if (isModalOpen || isCompareOpen) fetchSuggestions();
    }, [isModalOpen, isCompareOpen]);

    useEffect(() => {
        const liveCompare = async () => {
            if (formData.item_name.length < 2) {
                setCompareResults([]);
                return;
            }
            const { data } = await supabase
                .from("prices")
                .select("*")
                .ilike("item_name", `%${formData.item_name}%`)
                .order("price_kg", { ascending: true })
                .limit(5);
            if (data) setCompareResults(data);
        };
        const timer = setTimeout(() => {
            if (isCompareOpen) liveCompare();
        }, 300);
        return () => clearTimeout(timer);
    }, [formData.item_name, isCompareOpen]);

    // --- ACTIONS: SAVE, EDIT, DELETE ---
	const startEdit = (item) => {
		setEditingId(item.id);
		setFormData({ 
		  ...item, 
		  pin: "", // Ensures the PIN is always blank when opening
		  brand: item.brand || "", 
		  // Ensure the new automation fields are loaded with fallbacks if they are empty
		  is_watched: item.is_watched || false, 
		  external_url: item.external_url || "", 
		  store_id: item.store_id || ""
		});
		setIsModalOpen(true);
	};

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (formData.pin !== ADMIN_PIN) {
            setMessage({ text: "Incorrect PIN!", type: "error" });
            return;
        }
	const payload = {
		  store_name: formData.store_name,
		  item_name: formData.item_name,
		  brand: formData.brand,
		  price: parseFloat(formData.price),
		  weight_value: parseFloat(formData.weight_value),
		  weight_unit: formData.weight_unit,
		  is_watched: formData.is_watched,   // New
		  external_url: formData.external_url, // New
		  store_id: formData.store_id          // New
		};
        const action = editingId
            ? supabase.from("prices").update(payload).eq("id", editingId)
            : supabase.from("prices").insert([payload]);
        const { error } = await action;
        if (error) {
            setMessage({ text: error.message, type: "error" });
        } else {
            setMessage({ text: "Success! 🎉", type: "success" });
            fetchPrices();
            setTimeout(() => closeModal(), 1000);
        }
    };

    const handleDelete = async () => {
        if (formData.pin !== ADMIN_PIN) {
            setMessage({ text: "Enter PIN to delete!", type: "error" });
            return;
        }
        if (!confirm("Delete permanently?")) return;
        const { error } = await supabase
            .from("prices")
            .delete()
            .eq("id", editingId);
        if (!error) {
            setMessage({ text: "Deleted! 🗑️", type: "success" });
            fetchPrices();
            setTimeout(() => closeModal(), 1000);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setIsCompareOpen(false);
        setEditingId(null);
        setFormData(initialForm);
        setMessage({ text: "", type: "" });
    };

    const calcCurrentPriceKg = () => {
        if (!formData.price || !formData.weight_value) return 0;
        const factor =
            formData.weight_unit === "kg"
                ? 1
                : formData.weight_unit === "lb"
                  ? 0.45359
                  : 0.001;
        return formData.price / (formData.weight_value * factor);
    };

    return (
        <div
            style={{
                maxWidth: "950px",
                margin: "20px auto",
                padding: "15px",
                fontFamily: "sans-serif",
                color: "#333",
            }}
        >
            <h1 style={{ textAlign: "center", color: "#16a34a" }}>
                🥘 Naju's Grocery Shopping App
            </h1>

            {/* TAB NAVIGATION */}
            <div
                style={{
                    display: "flex",
                    marginBottom: "20px",
                    borderBottom: "2px solid #eee",
                }}
            >
                <button
                    onClick={() => setActiveTab("search")}
                    style={{
                        ...tabStyle,
                        fontWeight: activeTab === "search" ? "bold" : "normal",
                        borderBottom:
                            activeTab === "search"
                                ? "3px solid #16a34a"
                                : "none",
                    }}
                >
                    🔍 Price Search
                </button>
                <button
                    onClick={() => setActiveTab("list")}
                    style={{
                        ...tabStyle,
                        fontWeight: activeTab === "list" ? "bold" : "normal",
                        borderBottom:
                            activeTab === "list" ? "3px solid #16a34a" : "none",
                    }}
                >
                    📝 My List (
                    {shoppingList.filter((i) => !i.is_bought).length})
                </button>
            </div>

            {/* --- TAB: SEARCH --- */}
            {activeTab === "search" && (
                <>
                    <div
                        style={{
                            display: "flex",
                            gap: "8px",
                            marginBottom: "20px",
                        }}
                    >
                        <input
                            type="text"
                            placeholder="Search item..."
                            style={{
                                flex: 1,
                                padding: "12px",
                                borderRadius: "10px",
                                border: "1px solid #ddd",
                            }}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button
                            onClick={() => {
                                setEditingId(null);
                                setFormData(initialForm);
                                setIsModalOpen(true);
                            }}
                            style={btnPlusStyle}
                        >
                            +
                        </button>
                        <button
                            onClick={() => {
                                setFormData(initialForm);
                                setIsCompareOpen(true);
                            }}
                            style={{
                                ...btnPlusStyle,
                                backgroundColor: "#1e40af",
                                fontSize: "14px",
                            }}
                        >
                            Compare
                        </button>
                    </div>

                    <div
                        style={{
                            overflowX: "auto",
                            borderRadius: "8px",
                            border: "1px solid #eee",
                        }}
                    >
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: "13px",
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        background: "#f8f9fa",
                                        borderBottom: "2px solid #eee",
                                    }}
                                >
                                    <th style={thStyle}>Item Name</th>
                                    <th style={thStyle}>Store</th>
                                    <th style={thStyle}>Brand</th>
                                    <th style={thStyle}>Pack Price</th>
                                    <th style={thStyle}>$/lb</th>
                                    <th style={thStyle}>$/kg</th>
                                    <th
                                        style={{
                                            ...thStyle,
                                            textAlign: "center",
                                        }}
                                    >
                                        Edit
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        style={{
                                            borderBottom: "1px solid #eee",
                                            backgroundColor:
                                                index === 0
                                                    ? "#dcfce7"
                                                    : "white",
                                        }}
                                    >
                                        <td
                                            style={{
                                                ...tdStyle,
                                                fontWeight: "bold",
                                            }}
                                        >
                                            {item.item_name}{" "}
                                            {index === 0 && "⭐"}
                                        </td>
                                        <td style={tdStyle}>
                                            {item.store_name}
                                        </td>
                                        <td style={tdStyle}>{item.brand}</td>
                                        <td style={tdStyle}>
                                            {item.weight_value}
                                            {item.weight_unit} @ $
                                            {parseFloat(item.price).toFixed(2)}
                                        </td>
                                        <td style={tdStyle}>
                                            {item.price_ct
                                                ? "-"
                                                : `$${parseFloat(item.price_lb || 0).toFixed(2)}`}
                                        </td>
                                        <td style={tdStyle}>
                                            {item.price_ct ? (
                                                <span
                                                    style={{
                                                        color: "#1e40af",
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    $
                                                    {parseFloat(
                                                        item.price_ct,
                                                    ).toFixed(2)}
                                                    /ct
                                                </span>
                                            ) : (
                                                `$${parseFloat(item.price_kg || 0).toFixed(2)}`
                                            )}
                                        </td>
                                        <td
                                            style={{
                                                ...tdStyle,
                                                textAlign: "center",
                                            }}
                                        >
                                            <button
                                                onClick={() =>
                                                    addItemToList(
                                                        item.item_name,
                                                        item.store_name,
                                                        item.price_ct ||
                                                            item.price_kg,
                                                    )
                                                }
                                                title="Add to List"
                                                style={{
                                                    cursor: "pointer",
                                                    border: "none",
                                                    background: "none",
                                                    fontSize: "16px",
                                                    marginRight: "10px",
                                                }}
                                            >
                                                🛒
                                            </button>
                                            <button
                                                onClick={() => startEdit(item)}
                                                title="Edit Price"
                                                style={{
                                                    cursor: "pointer",
                                                    border: "none",
                                                    background: "none",
                                                    fontSize: "16px",
                                                }}
                                            >
                                                ✏️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* --- TAB: MY LIST --- */}
            {activeTab === "list" && (
                <div>
                    <div
                        style={{
                            display: "flex",
                            gap: "8px",
                            marginBottom: "20px",
                        }}
                    >
                        <input
                            id="quick-add"
                            placeholder="Quick add item..."
                            style={{ ...inputStyle, flex: 1 }}
                            onKeyPress={(e) => {
                                if (e.key === "Enter") {
                                    addItemToList(e.target.value);
                                    e.target.value = "";
                                }
                            }}
                        />
                        <button
                            onClick={() => {
                                const v =
                                    document.getElementById("quick-add").value;
                                if (v) {
                                    addItemToList(v);
                                    document.getElementById("quick-add").value =
                                        "";
                                }
                            }}
                            style={btnPlusStyle}
                        >
                            +
                        </button>
                    </div>
                    {[
                        ...new Set(
                            shoppingList.map(
                                (i) => i.store_name || "Generic List",
                            ),
                        ),
                    ]
                        .sort()
                        .map((store) => (
                            <div
                                key={store}
                                style={{
                                    marginBottom: "20px",
                                    border: "1px solid #eee",
                                    borderRadius: "10px",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        backgroundColor: "#f8f9fa",
                                        padding: "10px",
                                        fontWeight: "bold",
                                        borderBottom: "1px solid #eee",
                                    }}
                                >
                                    📍 {store}
                                </div>
                                {shoppingList
                                    .filter(
                                        (item) =>
                                            (item.store_name ||
                                                "Generic List") === store,
                                    )
                                    .map((item) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                padding: "12px",
                                                borderBottom:
                                                    "1px solid #f9f9f9",
                                                backgroundColor: item.is_bought
                                                    ? "#fafafa"
                                                    : "white",
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={item.is_bought}
                                                onChange={() =>
                                                    toggleBought(item)
                                                }
                                                style={{
                                                    width: "20px",
                                                    height: "20px",
                                                    cursor: "pointer",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    flex: 1,
                                                    marginLeft: "12px",
                                                    textDecoration:
                                                        item.is_bought
                                                            ? "line-through"
                                                            : "none",
                                                    color: item.is_bought
                                                        ? "#999"
                                                        : "#333",
                                                }}
                                            >
                                                <strong>
                                                    {item.item_name}
                                                </strong>{" "}
                                                {item.brand && (
                                                    <span
                                                        style={{
                                                            fontSize: "12px",
                                                            color: "#666",
                                                        }}
                                                    >
                                                        - {item.brand}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() =>
                                                    removeFromList(item.id)
                                                }
                                                style={{
                                                    border: "none",
                                                    background: "none",
                                                    cursor: "pointer",
                                                    fontSize: "16px",
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        ))}
                </div>
            )}

            {/* --- POPUP: COMPARE (Truly Responsive Layout) --- */}
            {isCompareOpen && (
                <div style={modalOverlayStyle}>
                    <div
                        style={{
                            ...modalContentStyle,
                            maxWidth: "550px",
                            maxHeight: "95vh",
                            overflowY: "auto",
                            padding: "15px",
                        }}
                    >
                        <h3 style={{ marginTop: 0, textAlign: "center" }}>
                            🔍 Live Compare
                        </h3>

                        {/* ROW 1: Item, Store, Brand (Wraps on Mobile) */}
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px",
                                marginBottom: "10px",
                            }}
                        >
                            <div style={{ ...fGroup, flex: "1 1 140px" }}>
                                <label>Item</label>
                                <input
                                    list="item-list"
                                    value={formData.item_name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            item_name: e.target.value,
                                        })
                                    }
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ ...fGroup, flex: "1 1 140px" }}>
                                <label>Store</label>
                                <input
                                    list="store-list"
                                    value={formData.store_name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            store_name: e.target.value,
                                        })
                                    }
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ ...fGroup, flex: "1 1 140px" }}>
                                <label>Brand</label>
                                <input
                                    list="brand-list"
                                    value={formData.brand}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            brand: e.target.value,
                                        })
                                    }
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {/* ROW 2: Price, Weight, Unit (Wraps on Mobile) */}
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px",
                                marginBottom: "15px",
                            }}
                        >
                            <div style={{ ...fGroup, flex: "1 1 100px" }}>
                                <label>Price ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            price: e.target.value,
                                        })
                                    }
                                    style={{
                                        ...inputStyle,
                                        border: "1px solid #3b82f6",
                                    }}
                                />
                            </div>
                            <div style={{ ...fGroup, flex: "1 1 100px" }}>
                                <label>Weight</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.weight_value}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            weight_value: e.target.value,
                                        })
                                    }
                                    style={{
                                        ...inputStyle,
                                        border: "1px solid #3b82f6",
                                    }}
                                />
                            </div>
                            <div style={{ ...fGroup, flex: "1 1 80px" }}>
                                <label>Unit</label>
                                <select
                                    value={formData.weight_unit}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            weight_unit: e.target.value,
                                        })
                                    }
                                    style={inputStyle}
                                >
                                    <option value="kg">kg</option>
                                    <option value="lb">lb</option>
                                    <option value="ct">ct</option>
                                </select>
                            </div>
                        </div>

                        {/* Current Selection Price Preview */}
                        {formData.price && formData.weight_value && (
                            <div
                                style={{
                                    padding: "10px",
                                    backgroundColor: "#eff6ff",
                                    borderRadius: "8px",
                                    marginBottom: "10px",
                                    border: "1px solid #3b82f6",
                                    textAlign: "center",
                                }}
                            >
                                <span style={{ fontSize: "12px" }}>
                                    Current Selection:{" "}
                                </span>
                                {formData.weight_unit === "ct" ? (
                                    <strong>
                                        $
                                        {(
                                            parseFloat(formData.price) /
                                            parseFloat(formData.weight_value)
                                        ).toFixed(2)}
                                        /ct
                                    </strong>
                                ) : (
                                    <>
                                        <strong>
                                            $
                                            {(
                                                calcCurrentPriceKg() * 0.45359
                                            ).toFixed(2)}
                                            /lb
                                        </strong>{" "}
                                        |{" "}
                                        <strong>
                                            ${calcCurrentPriceKg().toFixed(2)}
                                            /kg
                                        </strong>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Database Matches */}
                        <div
                            style={{
                                borderTop: "1px solid #eee",
                                paddingTop: "10px",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "11px",
                                    fontWeight: "bold",
                                    marginBottom: "5px",
                                    color: "#666",
                                }}
                            >
                                Database matches:
                            </div>
                            {compareResults.map((item, idx) => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        padding: "6px",
                                        fontSize: "11px",
                                        backgroundColor:
                                            idx === 0 ? "#dcfce7" : "#fff",
                                        borderBottom: "1px solid #f0f0f0",
                                    }}
                                >
                                    <span
                                        style={{ flex: 1, paddingRight: "5px" }}
                                    >
                                        <strong>{item.item_name}</strong> -{" "}
                                        {item.store_name}
                                    </span>
                                    <span
                                        style={{
                                            textAlign: "right",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {item.price_ct ? (
                                            <strong
                                                style={{ color: "#1e40af" }}
                                            >
                                                $
                                                {parseFloat(
                                                    item.price_ct,
                                                ).toFixed(2)}
                                                /ct
                                            </strong>
                                        ) : (
                                            <>
                                                <span
                                                    style={{
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    $
                                                    {parseFloat(
                                                        item.price_lb,
                                                    ).toFixed(2)}
                                                    /lb
                                                </span>{" "}
                                                |{" "}
                                                <span
                                                    style={{
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    $
                                                    {parseFloat(
                                                        item.price_kg,
                                                    ).toFixed(2)}
                                                    /kg
                                                </span>
                                            </>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: "8px",
                                marginTop: "15px",
                            }}
                        >
                            <button
                                onClick={() => {
                                    setIsCompareOpen(false);
                                    setIsModalOpen(true);
                                }}
                                style={btnSaveStyle}
                            >
                                Go to Save Page
                            </button>
                            <button onClick={closeModal} style={btnCancelStyle}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- POPUP: ADD / EDIT / DELETE --- */}
            {isModalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h2 style={{ marginTop: 0 }}>
                            {editingId ? "Edit Item" : "Add New Item"}
                        </h2>
                        <form
                            onSubmit={handleSave}
                            autoComplete="off"
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                            }}
                        >
                            <div style={fGroup}>
                                <label>Store</label>
                                <input
                                    required
                                    list="store-list"
                                    value={formData.store_name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            store_name: e.target.value,
                                        })
                                    }
                                    style={inputStyle}
                                />
                            </div>
                            <div style={fGroup}>
                                <label>Item Name</label>
                                <input
                                    required
                                    placeholder="Item Name"
                                    value={formData.item_name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            item_name: e.target.value,
                                        })
                                    }
                                    style={inputStyle}
                                />
                            </div>
                            <div style={fGroup}>
                                <label>Brand</label>
                                <input
                                    placeholder="Brand"
                                    value={formData.brand}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            brand: e.target.value,
                                        })
                                    }
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <div style={{ ...fGroup, flex: 1.5 }}>
                                    <label>Weight</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        value={formData.weight_value}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                weight_value: e.target.value,
                                            })
                                        }
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={fGroup}>
                                    <label>Unit</label>
                                    <select
                                        value={formData.weight_unit}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                weight_unit: e.target.value,
                                            })
                                        }
                                        style={inputStyle}
                                    >
                                        <option value="kg">kg</option>
                                        <option value="lb">lb</option>
                                        <option value="g">g</option>
                                        <option value="ct">ct</option>
                                    </select>
                                </div>
                            </div>
                            <div style={fGroup}>
                                <label>Total Price ($)</label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            price: e.target.value,
                                        })
                                    }
                                    style={inputStyle}
                                />
                            </div>
							{/* --- PASTE THE AUTOMATION SECTION HERE --- */}
							<div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7', marginBottom: '10px' }}>
							  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
								<input 
								  type="checkbox" 
								  checked={formData.is_watched} 
								  onChange={e => setFormData({...formData, is_watched: e.target.checked})} 
								  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
								/>
								<label style={{ fontSize: '13px', color: '#16a34a', fontWeight: 'bold' }}>Enable Weekly Price Auto-Update</label>
							  </div>
							  <div style={fGroup}>
								<label>Walmart/Store URL</label>
								<input 
								  placeholder="https://www.walmart.ca/en/ip/..." 
								  value={formData.external_url} 
								  onChange={e => setFormData({...formData, external_url: e.target.value})} 
								  style={inputStyle} 
								/>
							  </div>
							  <div style={{ ...fGroup, marginTop: '8px' }}>
								<label>Store ID (e.g. 1187 for 110 Watt)</label>
								<input 
								  placeholder="Local store number" 
								  value={formData.store_id} 
								  onChange={e => setFormData({...formData, store_id: e.target.value})} 
								  style={inputStyle} 
								/>
							  </div>
							</div>
                            <div style={fGroup}>
                                <label>Security PIN</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="PIN"
                                    value={formData.pin}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            pin: e.target.value,
                                        })
                                    }
                                    style={{
                                        ...inputStyle,
                                        border: "1px solid #ffcfcf",
                                        WebkitTextSecurity: "disc",
                                        MozTextSecurity: "disc",
                                        textSecurity: "disc",
                                    }}
                                />
                            </div>
                            {message.text && (
                                <p
                                    style={{
                                        color:
                                            message.type === "error"
                                                ? "red"
                                                : "green",
                                        textAlign: "center",
                                        fontSize: "14px",
                                    }}
                                >
                                    {message.text}
                                </p>
                            )}
                            <div
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                }}
                            >
                                <button type="submit" style={btnSaveStyle}>
                                    {editingId ? "Update" : "Save"}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        style={btnDeleteStyle}
                                    >
                                        Delete
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData(initialForm);
                                        setMessage({ text: "", type: "" });
                                    }}
                                    style={btnClearStyle}
                                >
                                    Clear
                                </button>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    style={btnCancelStyle}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <datalist id="store-list">
                {existingStores.map((s) => (
                    <option key={s} value={s} />
                ))}
            </datalist>
            <datalist id="brand-list">
                {existingBrands.map((b) => (
                    <option key={b} value={b} />
                ))}
            </datalist>
            <datalist id="item-list">
                {results.map((i) => (
                    <option key={i.id} value={i.item_name} />
                ))}
            </datalist>
        </div>
    );
}

// STYLES
const tabStyle = {
    flex: 1,
    padding: "12px",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: "15px",
};
const fGroup = {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    fontSize: "11px",
    fontWeight: "bold",
};
const inputStyle = {
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #ddd",
    fontSize: "14px",
};
const thStyle = { padding: "10px", textAlign: "left", fontWeight: "bold" };
const tdStyle = { padding: "10px" };
const modalOverlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
};
const modalContentStyle = {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "15px",
    width: "95%",
    maxWidth: "400px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
};
const btnPlusStyle = {
    padding: "10px 15px",
    backgroundColor: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "20px",
    fontWeight: "bold",
};
const btnSaveStyle = {
    flex: "1 1 100%",
    padding: "12px",
    backgroundColor: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    marginBottom: "5px",
};
const btnDeleteStyle = {
    flex: 1,
    padding: "10px",
    backgroundColor: "white",
    color: "#ff4d4d",
    border: "1px solid #ff4d4d",
    borderRadius: "8px",
    cursor: "pointer",
};
const btnClearStyle = {
    flex: 1,
    padding: "10px",
    backgroundColor: "#eee",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
};
const btnCancelStyle = {
    flex: 1,
    padding: "10px",
    backgroundColor: "#ff4d4d",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
};
