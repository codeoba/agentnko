import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Trash2, ChevronDown, Package, TrendingUp, AlertCircle } from 'lucide-react';

const STATUS_PIPELINE = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUS_META = {
  pending: { label: 'Inasubiri', icon: '⏳', cls: 'status-pending', color: '#f59e0b' },
  processing: { label: 'Inaandaliwa', icon: '⚙️', cls: 'status-processing', color: '#3b82f6' },
  shipped: { label: 'Imesafirishwa', icon: '🚚', cls: 'status-shipped', color: '#8b5cf6' },
  delivered: { label: 'Imefikia', icon: '✅', cls: 'status-delivered', color: '#10b981' },
  cancelled: { label: 'Imefutwa', icon: '❌', cls: 'status-cancelled', color: '#ef4444' },
};

export default function OrderManager({ apiFetch }) {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [contacts, setContacts] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [form, setForm] = useState({
    contact_id: '', delivery_type: 'delivery', delivery_address: '',
    items: [], notes: '', discount: 0
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [o, s, c, p] = await Promise.all([
        apiFetch('/api/orders'),
        apiFetch('/api/orders/stats'),
        apiFetch('/api/crm/contacts'),
        apiFetch('/api/catalog'),
      ]);
      setOrders(o);
      setStats(s);
      setContacts(c);
      setProducts(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    setForm(f => ({
      ...f,
      items: [...f.items, { product_id: '', name: '', price: 0, quantity: 1 }]
    }));
  }

  function updateItem(i, key, val) {
    setForm(f => {
      const items = [...f.items];
      if (key === 'product_id') {
        const product = products.find(p => String(p.id) === String(val));
        items[i] = { ...items[i], product_id: val, name: product?.name || '', price: product?.price || 0 };
      } else {
        items[i] = { ...items[i], [key]: val };
      }
      return { ...f, items };
    });
  }

  function removeItem(i) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }

  function getSubtotal() {
    return form.items.reduce((s, it) => s + (parseFloat(it.price || 0) * parseInt(it.quantity || 1)), 0);
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          contact_id: form.contact_id || null,
        }),
      });
      setShowForm(false);
      setForm({ contact_id: '', delivery_type: 'delivery', delivery_address: '', items: [], notes: '', discount: 0 });
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(orderId, newStatus) {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, tracking_number: trackingInput || undefined }),
      });
      setTrackingInput('');
      await loadAll();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(orders.find(o => o.id === orderId));
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(orderId) {
    if (!confirm('Futa order hii?')) return;
    try {
      await apiFetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      setOrders(orders.filter(o => o.id !== orderId));
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
    } catch (err) {
      alert(err.message);
    }
  }

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);
  const subtotal = getSubtotal();
  const total = subtotal - parseFloat(form.discount || 0);

  return (
    <div className="order-manager">
      <div className="section-header">
        <div>
          <h2 className="section-title"><ShoppingBag size={22} /> Order Management</h2>
          <p className="section-subtitle">Simamia orders za wateja wako</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Order Mpya
        </button>
      </div>

      {/* Stats */}
      <div className="order-stats-bar">
        {Object.entries(STATUS_META).map(([key, meta]) => {
          const s = stats.by_status?.[key];
          return (
            <div key={key} className={`order-stat-chip ${meta.cls}`} onClick={() => setFilterStatus(key === filterStatus ? 'all' : key)}>
              <span>{meta.icon}</span>
              <span className="order-stat-count">{s?.count || 0}</span>
              <span>{meta.label}</span>
            </div>
          );
        })}
        <div className="order-stat-chip revenue">
          <TrendingUp size={16} />
          <span>TZS {(stats.total_revenue || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="order-form-card">
          <h3>📦 Order Mpya</h3>
          <form onSubmit={handleCreateOrder}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Contact (optional)</label>
                <select className="form-input" value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })}>
                  <option value="">-- Chagua Contact --</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.phone_number}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Aina ya Uwasilishaji</label>
                <select className="form-input" value={form.delivery_type} onChange={e => setForm({ ...form, delivery_type: e.target.value })}>
                  <option value="delivery">🚚 Delivery</option>
                  <option value="pickup">🏪 Pick-up</option>
                </select>
              </div>
            </div>
            {form.delivery_type === 'delivery' && (
              <div className="form-group">
                <label>Anwani ya Delivery</label>
                <input type="text" className="form-input" placeholder="Eneo la delivery" value={form.delivery_address} onChange={e => setForm({ ...form, delivery_address: e.target.value })} />
              </div>
            )}

            {/* Items */}
            <div className="order-items-section">
              <div className="items-header">
                <span>Bidhaa</span>
                <button type="button" className="btn-small" onClick={addItem}><Plus size={14} /> Ongeza Bidhaa</button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} className="order-item-row">
                  <select className="form-input" value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                    <option value="">-- Chagua Bidhaa --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (TZS {p.price?.toLocaleString()})</option>
                    ))}
                  </select>
                  <input type="text" className="form-input item-name-input" placeholder="Jina" value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} />
                  <input type="number" className="form-input item-price-input" placeholder="Bei" value={item.price} onChange={e => updateItem(i, 'price', e.target.value)} />
                  <input type="number" className="form-input item-qty-input" min={1} value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                  <button type="button" className="btn-icon danger" onClick={() => removeItem(i)}><Trash2 size={14} /></button>
                </div>
              ))}
              {form.items.length > 0 && (
                <div className="order-totals">
                  <div className="order-total-row"><span>Subtotal:</span><span>TZS {subtotal.toLocaleString()}</span></div>
                  <div className="order-total-row">
                    <span>Punguzo (TZS):</span>
                    <input type="number" className="form-input discount-input" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} min={0} />
                  </div>
                  <div className="order-total-row total-final"><span>Jumla:</span><span>TZS {Math.max(0, total).toLocaleString()}</span></div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Maelezo (optional)</label>
              <input type="text" className="form-input" placeholder="Maelezo ya order" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Ghairi</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Inaunda...' : 'Unda Order'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="order-filter-tabs">
        <button className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilterStatus('all')}>Zote ({orders.length})</button>
        {STATUS_PIPELINE.map(s => (
          <button key={s} className={`filter-tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
            {STATUS_META[s].icon} {STATUS_META[s].label}
          </button>
        ))}
      </div>

      <div className="orders-content-grid">
        {/* Orders List */}
        <div className="orders-list">
          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state"><Package size={48} /><p>Hakuna orders</p></div>
          ) : (
            filteredOrders.map(order => {
              const meta = STATUS_META[order.status] || STATUS_META.pending;
              return (
                <div key={order.id} className={`order-item ${selectedOrder?.id === order.id ? 'selected' : ''}`} onClick={() => setSelectedOrder(order)}>
                  <div className="order-item-header">
                    <span className="order-number">#{order.order_number}</span>
                    <span className={`order-status-badge ${meta.cls}`}>{meta.icon} {meta.label}</span>
                  </div>
                  <div className="order-item-contact">
                    {order.contact_name ? `👤 ${order.contact_name}` : '👤 Mgeni'}
                    {order.contact_phone && <span className="order-phone"> — {order.contact_phone}</span>}
                  </div>
                  <div className="order-item-meta">
                    <span>💰 TZS {(order.total || 0).toLocaleString()}</span>
                    <span>{order.delivery_type === 'delivery' ? '🚚 Delivery' : '🏪 Pick-up'}</span>
                    <span>📅 {new Date(order.created_at).toLocaleDateString('sw-TZ')}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Order Detail */}
        <div className="order-detail-panel">
          {selectedOrder ? (
            <>
              <div className="order-detail-header">
                <h3>Order #{selectedOrder.order_number}</h3>
                <span className={`order-status-badge ${STATUS_META[selectedOrder.status]?.cls}`}>
                  {STATUS_META[selectedOrder.status]?.icon} {STATUS_META[selectedOrder.status]?.label}
                </span>
              </div>

              {/* Status Pipeline */}
              <div className="order-pipeline">
                {STATUS_PIPELINE.filter(s => s !== 'cancelled').map((s, i) => {
                  const past = STATUS_PIPELINE.indexOf(selectedOrder.status) >= i;
                  return (
                    <div key={s} className={`pipeline-step ${past ? 'done' : ''}`}>
                      <div className="pipeline-dot" />
                      <div className="pipeline-label">{STATUS_META[s].label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Order Info */}
              <div className="order-detail-info">
                <div className="detail-row"><span>Contact</span><strong>{selectedOrder.contact_name || 'Mgeni'} {selectedOrder.contact_phone ? `(${selectedOrder.contact_phone})` : ''}</strong></div>
                <div className="detail-row"><span>Delivery</span><strong>{selectedOrder.delivery_type === 'delivery' ? '🚚 Delivery' : '🏪 Pick-up'}</strong></div>
                {selectedOrder.delivery_address && <div className="detail-row"><span>Anwani</span><strong>{selectedOrder.delivery_address}</strong></div>}
                <div className="detail-row"><span>Subtotal</span><strong>TZS {(selectedOrder.subtotal || 0).toLocaleString()}</strong></div>
                {selectedOrder.discount > 0 && <div className="detail-row"><span>Punguzo</span><strong>-TZS {selectedOrder.discount.toLocaleString()}</strong></div>}
                <div className="detail-row total-row"><span>Jumla</span><strong>TZS {(selectedOrder.total || 0).toLocaleString()}</strong></div>
                {selectedOrder.tracking_number && <div className="detail-row"><span>Tracking</span><strong>{selectedOrder.tracking_number}</strong></div>}
                {selectedOrder.notes && <div className="detail-row"><span>Maelezo</span><strong>{selectedOrder.notes}</strong></div>}
              </div>

              {/* Status Actions */}
              <div className="order-actions-section">
                <h4>Badilisha Hali</h4>
                {selectedOrder.status === 'pending' && (
                  <button className="btn-status processing" onClick={() => handleStatusChange(selectedOrder.id, 'processing')}>⚙️ Anza Kuandaa</button>
                )}
                {selectedOrder.status === 'processing' && (
                  <div>
                    <input type="text" className="form-input" placeholder="Tracking number (optional)" value={trackingInput} onChange={e => setTrackingInput(e.target.value)} />
                    <button className="btn-status shipped" onClick={() => handleStatusChange(selectedOrder.id, 'shipped')}>🚚 Imesafirishwa</button>
                  </div>
                )}
                {selectedOrder.status === 'shipped' && (
                  <button className="btn-status delivered" onClick={() => handleStatusChange(selectedOrder.id, 'delivered')}>✅ Imefikia</button>
                )}
                {['pending', 'processing'].includes(selectedOrder.status) && (
                  <button className="btn-status cancel" onClick={() => handleStatusChange(selectedOrder.id, 'cancelled')}>❌ Futa Order</button>
                )}
                <button className="btn-icon danger" onClick={() => handleDelete(selectedOrder.id)} style={{ marginTop: 12 }}>
                  <Trash2 size={16} /> Futa kabisa
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state"><AlertCircle size={40} /><p>Chagua order kuona maelezo</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
