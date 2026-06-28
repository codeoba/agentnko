import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Mail, Shield, Circle } from 'lucide-react';

export default function TeamInbox({ apiFetch }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'agent' });

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/team');
      setAgents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await apiFetch('/api/team/invite', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      alert(`✅ Mwaliko umetumwa!\nInvite Token: ${data.invite_token}`);
      setShowForm(false);
      setForm({ name: '', email: '', role: 'agent' });
      await loadAgents();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Ondoa agent huyu?')) return;
    try {
      await apiFetch(`/api/team/${id}`, { method: 'DELETE' });
      setAgents(agents.filter(a => a.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleToggleStatus(agent) {
    const newStatus = agent.status === 'online' ? 'offline' : 'online';
    try {
      await apiFetch(`/api/team/${agent.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setAgents(agents.map(a => a.id === agent.id ? { ...a, status: newStatus } : a));
    } catch (err) {
      console.error(err);
    }
  }

  const onlineCount = agents.filter(a => a.status === 'online').length;

  return (
    <div className="team-inbox">
      <div className="section-header">
        <div>
          <h2 className="section-title"><Users size={22} /> Team Inbox</h2>
          <p className="section-subtitle">Simamia timu yako ya agents</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Alika Agent
        </button>
      </div>

      {/* Team Stats */}
      <div className="team-stats-row">
        <div className="team-stat">
          <Circle size={12} fill="#10b981" color="#10b981" />
          <span>{onlineCount} Online</span>
        </div>
        <div className="team-stat">
          <Circle size={12} fill="#6b7280" color="#6b7280" />
          <span>{agents.length - onlineCount} Offline</span>
        </div>
        <div className="team-stat">
          <Users size={14} />
          <span>{agents.length} Jumla</span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="team-info-banner">
        <Shield size={18} />
        <div>
          <strong>Multi-Agent Inbox</strong>
          <p>Agents wanaweza kushirikiana kujibu wateja kwenye platform moja. Kila agent anapewa token ya kujiunga na mfumo.</p>
        </div>
      </div>

      {/* Invite Form */}
      {showForm && (
        <div className="team-form-card">
          <h3>👤 Alika Agent Mpya</h3>
          <form onSubmit={handleInvite}>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Jina la Agent</label>
                <input type="text" className="form-input" placeholder="Jina Kamili" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Barua Pepe</label>
                <input type="email" className="form-input" placeholder="agent@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Jukumu</label>
                <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="agent">Agent (Kujibu tu)</option>
                  <option value="supervisor">Supervisor (Kusimamia)</option>
                  <option value="manager">Manager (Usimamizi Wote)</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Ghairi</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Mail size={16} /> {saving ? 'Inatuma mwaliko...' : 'Tuma Mwaliko'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Agents List */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : agents.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>Hakuna agents bado</h3>
          <p>Alika agent wa kwanza wa timu yako</p>
        </div>
      ) : (
        <div className="agents-list">
          {agents.map(agent => (
            <div key={agent.id} className="agent-card">
              <div className="agent-avatar" style={{ backgroundColor: agent.status === 'online' ? '#10b981' : '#6b7280' }}>
                {agent.name[0].toUpperCase()}
              </div>
              <div className="agent-info">
                <div className="agent-name">{agent.name}</div>
                <div className="agent-email">{agent.email}</div>
                <div className="agent-role-badge">{agent.role}</div>
              </div>
              <div className="agent-status-section">
                <button
                  className={`agent-status-toggle ${agent.status === 'online' ? 'online' : 'offline'}`}
                  onClick={() => handleToggleStatus(agent)}
                >
                  <Circle size={10} fill="currentColor" />
                  {agent.status === 'online' ? 'Online' : 'Offline'}
                </button>
                {!agent.joined_at && (
                  <span className="agent-pending-badge">⏳ Inasubiri kukubali</span>
                )}
              </div>
              <button className="btn-icon danger" onClick={() => handleDelete(agent.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
