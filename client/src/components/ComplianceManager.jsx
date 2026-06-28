import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, UserX, AlertTriangle, RefreshCw } from 'lucide-react';

export default function ComplianceManager({ apiFetch }) {
  const [optOuts, setOptOuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addPhone, setAddPhone] = useState('');
  const [addReason, setAddReason] = useState('');
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadOptOuts();
  }, []);

  async function loadOptOuts() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/opt-outs');
      setOptOuts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addPhone.trim()) return;
    setAdding(true);
    try {
      await apiFetch('/api/opt-outs', {
        method: 'POST',
        body: JSON.stringify({ phone_number: addPhone.trim(), reason: addReason || 'manual' }),
      });
      setAddPhone('');
      setAddReason('');
      await loadOptOuts();
    } catch (err) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(phone) {
    if (!confirm(`Ondoa ${phone} kutoka opt-out list?`)) return;
    try {
      await apiFetch(`/api/opt-outs/${encodeURIComponent(phone)}`, { method: 'DELETE' });
      setOptOuts(optOuts.filter(o => o.phone_number !== phone));
    } catch (err) {
      alert(err.message);
    }
  }

  const filtered = optOuts.filter(o =>
    !search || o.phone_number.includes(search)
  );

  return (
    <div className="compliance-manager">
      <div className="section-header">
        <div>
          <h2 className="section-title"><Shield size={22} /> Compliance & Opt-Out</h2>
          <p className="section-subtitle">Simamia contacts walioomba kuacha kupokea messages</p>
        </div>
        <button className="btn-secondary" onClick={loadOptOuts}>
          <RefreshCw size={16} /> Onyesha upya
        </button>
      </div>

      {/* Info Card */}
      <div className="compliance-info-card">
        <AlertTriangle size={20} />
        <div>
          <h4>Jinsi Opt-Out Inavyofanya Kazi</h4>
          <ul>
            <li>Contacts wanaotuma <strong>STOP, UNSUBSCRIBE, ACHA, NIACHE</strong> — wanaongezwa kiotomatiki</li>
            <li>Contacts waliopo kwenye orodha hii hawatapata messages yoyote (campaigns, scheduled, broadcast)</li>
            <li>Unaweza kuwaondoa wakitaka tena kupokea messages</li>
          </ul>
        </div>
      </div>

      {/* Stats */}
      <div className="compliance-stats">
        <div className="compliance-stat-card">
          <UserX size={24} />
          <div>
            <div className="compliance-stat-num">{optOuts.length}</div>
            <div className="compliance-stat-label">Contacts walioomba kuacha</div>
          </div>
        </div>
      </div>

      {/* Add Manually */}
      <div className="add-optout-card">
        <h3>➕ Ongeza Manually</h3>
        <form onSubmit={handleAdd} className="add-optout-form">
          <input
            type="text"
            className="form-input"
            placeholder="Namba ya simu (255712345678)"
            value={addPhone}
            onChange={e => setAddPhone(e.target.value)}
            required
          />
          <input
            type="text"
            className="form-input"
            placeholder="Sababu (optional)"
            value={addReason}
            onChange={e => setAddReason(e.target.value)}
          />
          <button type="submit" className="btn-danger" disabled={adding}>
            <UserX size={16} />
            {adding ? 'Inaongeza...' : 'Ongeza kwenye Opt-Out'}
          </button>
        </form>
      </div>

      {/* Search */}
      <div className="form-group">
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Tafuta kwa namba ya simu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Opt-out List */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Shield size={48} />
          <h3>{search ? 'Hakuna matokeo' : 'Orodha ya opt-out ni tupu'}</h3>
          <p>{search ? 'Jaribu namba tofauti' : 'Hakuna mtu aliyeomba kuacha kupokea messages bado'}</p>
        </div>
      ) : (
        <div className="optout-list">
          <div className="optout-list-header">
            <span>Namba ya Simu</span>
            <span>Sababu</span>
            <span>Tarehe</span>
            <span>Vitendo</span>
          </div>
          {filtered.map((o, i) => (
            <div key={i} className="optout-row">
              <div className="optout-phone">
                <UserX size={14} />
                {o.phone_number}
              </div>
              <div className="optout-reason">{o.reason || 'Haijulikani'}</div>
              <div className="optout-date">{new Date(o.opted_out_at).toLocaleDateString('sw-TZ')}</div>
              <button className="btn-icon-sm" onClick={() => handleRemove(o.phone_number)} title="Ondoa kutoka orodha">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
